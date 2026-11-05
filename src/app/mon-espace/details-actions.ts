"use server";

import { z } from "zod";
import { logActivity } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { isSiteLang } from "@/lib/i18n/config";
import { dictFor } from "@/lib/i18n/server";
import { templateDefinitionSchema } from "@/lib/invitation/schema";
import { composeInvitation, privateLinksFor, rsvpSettings } from "@/lib/orders";
import { getSettings } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { detailsSchema, flattenErrors, type RequestInput } from "@/lib/validation/request";

export type DetailsResult = { ok: true } | { ok: false; message: string; fieldErrors?: Record<string, string> };

/**
 * Formulaire détaillé envoyé par le client depuis son espace, après le paiement.
 * L'invitation (brouillon) est reconstruite avec ses réponses ; l'équipe prépare
 * ensuite l'aperçu. Un seul envoi : les modifications passent ensuite par l'équipe.
 */
export async function submitDetails(invitationId: string, input: RequestInput): Promise<DetailsResult> {
  const id = z.string().uuid().safeParse(invitationId);
  const user = await getCurrentUser();
  const session = await createClient();
  const generic = dictFor("fr").order.detailsError;
  if (!id.success || !user || !session) return { ok: false, message: generic };

  // Lecture avec la session du client : la base ne renvoie rien s'il n'a pas accès à cette invitation
  const { data: own } = await session.from("invitations").select("id, language").eq("id", id.data).maybeSingle();
  const lang = isSiteLang(own?.language) ? own.language : "fr";
  const t = dictFor(lang);
  if (!own) return { ok: false, message: t.order.detailsError };

  const db = createAdminClient();
  if (!db) return { ok: false, message: t.order.detailsError };
  const [{ data: inv }, { data: req }, { data: paid }] = await Promise.all([
    db.from("invitations").select("id, private_links, template_versions(definition)").eq("id", own.id).single(),
    db.from("client_requests").select("id, reference, language, partner_one, partner_two, event_date, form_data, email").eq("invitation_id", own.id).maybeSingle(),
    db.from("payments").select("id").eq("invitation_id", own.id).eq("status", "paid").limit(1),
  ]);
  const fd = (req?.form_data ?? {}) as Record<string, unknown> & { selfService?: boolean; detailsAt?: string };
  if (!inv || !req || !fd.selfService) return { ok: false, message: t.order.detailsError };
  if (!paid?.length) return { ok: false, message: t.order.detailsNotPaid };
  if (fd.detailsAt) return { ok: false, message: t.order.detailsLocked.replace("{date}", new Date(fd.detailsAt).toLocaleDateString(lang)) };

  const parsed = detailsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: t.request.errors.invalid, fieldErrors: flattenErrors(parsed.error) };
  const { partnerOne, partnerTwo, eventDate, ...answers } = parsed.data;
  const detailsAt = new Date().toISOString();
  const formData = { ...fd, ...answers, detailsAt };

  const version = inv.template_versions as unknown as { definition: unknown } | null;
  const def = templateDefinitionSchema.safeParse(version?.definition);
  if (!def.success) return { ok: false, message: t.order.detailsError };
  const { content, notes, eventAt } = composeInvitation(def.data, { language: req.language, partner_one: partnerOne, partner_two: partnerTwo, event_date: eventDate, form_data: formData });
  const existingLinks = ((inv as { private_links?: Record<string, string> | null }).private_links ?? {}) as Record<string, string>;

  const { error: invErr } = await db
    .from("invitations")
    .update({
      draft_content: content,
      title: `${partnerOne} & ${partnerTwo}`,
      partner_one: partnerOne,
      partner_two: partnerTwo,
      event_at: eventAt,
      timezone: content.timezone,
      status: "customizing",
      private_links: privateLinksFor(content, existingLinks) ?? existingLinks,
      internal_notes: `Formulaire détaillé reçu (commande ${req.reference}).${notes.length ? `\nÀ reprendre :\n- ${notes.join("\n- ")}` : ""}`,
    })
    .eq("id", own.id);
  if (invErr) {
    console.error("[details] invitation", invErr.message);
    return { ok: false, message: t.order.detailsError };
  }
  const [rsvpRes, reqRes] = await Promise.all([
    db.from("rsvp_forms").update(rsvpSettings(formData, content)).eq("invitation_id", own.id),
    db.from("client_requests").update({ form_data: formData, partner_one: partnerOne, partner_two: partnerTwo, event_date: eventDate }).eq("id", req.id),
  ]);
  for (const r of [rsvpRes, reqRes]) if (r.error) console.error("[details]", r.error.message);

  const couple = `${partnerOne} & ${partnerTwo}`;
  await logActivity({ actorId: user.id, action: "order.details", resourceType: "invitation", resourceId: own.id, summary: `Formulaire détaillé reçu — ${couple} (${req.reference})` });
  const settings = await getSettings();
  const adminTo = process.env.ADMIN_NOTIFICATION_EMAIL || settings.brand.contactEmail;
  if (adminTo) {
    const r = await sendEmail({
      to: adminTo,
      subject: `Informations reçues — ${couple} (${req.reference})`,
      heading: "Formulaire détaillé reçu",
      paragraphs: [
        `${req.email} a envoyé les détails de son événement. L'invitation a été préremplie avec ses réponses.`,
        `Aperçu promis sous 24 h : ${env.siteUrl}/admin/invitations/${own.id}`,
      ],
    });
    if (!r.sent) console.warn("[details] notification équipe non envoyée :", r.error);
  }
  // Pas de revalidatePath : la page reste affichée avec son message de remerciement (les pages de l'espace sont dynamiques)
  return { ok: true };
}
