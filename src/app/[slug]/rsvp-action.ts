"use server";

import { logActivity } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { hashedClientIp } from "@/lib/net";
import { loadPublicInvitation } from "@/lib/publication";
import { rsvpSubmissionSchema, sanitizeSubmission, type RsvpResult, type RsvpSubmission } from "@/lib/rsvp";
import { getOrCreateRsvpForm, toPublicConfig } from "@/lib/rsvp-server";
import { getSettings } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Enregistre la réponse d'un invité.
 * L'invitation est retrouvée côté serveur à partir de son adresse publiée :
 * le navigateur ne choisit jamais à quelle invitation la réponse est rattachée.
 */
export async function submitRsvp(input: RsvpSubmission): Promise<RsvpResult> {
  const parsed = rsvpSubmissionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid", fields: [...new Set(parsed.error.issues.map((i) => String(i.path[0])))] };
  }
  const data = parsed.data;
  if (data.website) return { ok: true, updated: false }; // robot : rien n'est enregistré

  const inv = await loadPublicInvitation(data.slug.toLowerCase());
  if (!inv || inv.kind !== "ok") return { ok: false, error: "unavailable" };

  const db = createAdminClient();
  if (!db) return { ok: false, error: "server" };

  const ipHash = await hashedClientIp();
  const { data: allowed } = await db.rpc("check_rate_limit", {
    p_bucket: `rsvp:${inv.invitationId}:${ipHash}`,
    p_limit: 20,
    p_window_seconds: 3600,
  });
  if (allowed === false) return { ok: false, error: "rate" };

  const form = await getOrCreateRsvpForm(db, inv.invitationId);
  if (!form) return { ok: false, error: "server" };
  const cfg = toPublicConfig(form);
  if (!cfg.open) return { ok: false, error: cfg.closedReason === "deadline" ? "deadline" : "closed" };

  let guest: { id: string; display_name: string; max_companions: number } | null = null;
  if (cfg.mode === "code") {
    const code = data.code.trim().toUpperCase().replace(/\s+/g, "");
    if (!code) return { ok: false, error: "code" };
    const { data: g } = await db
      .from("guests")
      .select("id, display_name, max_companions")
      .eq("invitation_id", inv.invitationId)
      .eq("code", code)
      .maybeSingle();
    if (!g) return { ok: false, error: "code" };
    guest = g;
  }

  const { value, missing } = sanitizeSubmission(data, {
    fields: cfg.fields,
    maxCompanions: guest ? guest.max_companions : cfg.maxCompanions,
    questions: cfg.questions,
    eventIds: inv.content.events.map((e) => e.id),
  });
  if (missing.length) return { ok: false, error: "invalid", fields: missing };

  const row = {
    invitation_id: inv.invitationId,
    form_id: form.id,
    guest_id: guest?.id ?? null,
    first_name: value.firstName,
    last_name: value.lastName,
    attending: value.attending,
    companions_count: value.companionsCount,
    companions: value.companionNames,
    events: value.events,
    dietary: value.dietary || null,
    child_menus: value.childMenus,
    answers: value.answers,
    comment: value.comment || null,
    ip_hash: ipHash,
  };

  let updated = false;
  if (guest) {
    const { data: existing } = await db.from("rsvp_responses").select("*").eq("guest_id", guest.id).maybeSingle();
    if (existing) {
      const { error } = await db.from("rsvp_responses").update(row).eq("id", existing.id);
      if (error) return { ok: false, error: "server" };
      await db.from("rsvp_response_edits").insert({ response_id: existing.id, before: existing, after: row, edited_by: null });
      updated = true;
    }
  }
  if (!updated) {
    const { error } = await db.from("rsvp_responses").insert({ ...row, idempotency_key: data.idempotencyKey });
    if (error && error.code !== "23505") {
      console.error("[rsvp] enregistrement", error.message);
      return { ok: false, error: "server" };
    }
    if (error?.code === "23505") return { ok: true, updated: false }; // double envoi : déjà enregistré
  }

  const who = `${value.firstName} ${value.lastName}`.trim();
  const people = value.attending ? 1 + value.companionsCount : 0;
  const summary = `${who} ${value.attending ? `présent·e (${people} pers.)` : "ne viendra pas"} — ${inv.content.couple.partnerOne} & ${inv.content.couple.partnerTwo}`;
  await logActivity({ action: updated ? "rsvp.updated" : "rsvp.created", resourceType: "rsvp_response", resourceId: inv.invitationId, summary: `${updated ? "Réponse modifiée" : "Nouvelle réponse RSVP"} : ${summary}` });

  try {
    const settings = await getSettings();
    const adminTo = process.env.ADMIN_NOTIFICATION_EMAIL || settings.brand.contactEmail;
    if (settings.notifications.notifyOnNewRsvp && adminTo) {
      await sendEmail({
        to: adminTo,
        subject: `RSVP — ${inv.content.couple.partnerOne} & ${inv.content.couple.partnerTwo}`,
        heading: updated ? "Réponse modifiée" : "Nouvelle réponse",
        paragraphs: [summary, `Toutes les réponses : ${env.siteUrl}/admin/invitations/${inv.invitationId}?onglet=rsvp`],
      });
    }
  } catch (e) {
    console.warn("[rsvp] notification non envoyée", e);
  }

  return { ok: true, updated };
}
