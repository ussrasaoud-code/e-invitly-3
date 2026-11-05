"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { slugify } from "@/lib/slug";
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
  // Photos : seulement celles réellement reçues dans le dossier de cette invitation
  const store = db.storage.from(PHOTO_BUCKET);
  const photos = [];
  for (const ph of answers.details.photoFiles ?? []) {
    if (!ph.path.startsWith(`clients/${own.id}/`)) continue;
    const { data: info } = await store.info(ph.path);
    if (info) photos.push(ph);
  }
  answers.details.photoFiles = photos;
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

const PHOTO_BUCKET = "uploads";
const PHOTO_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const PHOTO_MAX = 10 * 1024 * 1024;

/** Invitation du client connecté, payée, dont le formulaire n'est pas encore envoyé. */
async function openOrder(invitationId: string) {
  const id = z.string().uuid().safeParse(invitationId);
  const session = await createClient();
  if (!id.success || !session || !(await getCurrentUser())) return null;
  const { data: own } = await session.from("invitations").select("id").eq("id", id.data).maybeSingle();
  const db = createAdminClient();
  if (!own || !db) return null;
  const [{ data: req }, { data: paid }] = await Promise.all([
    db.from("client_requests").select("form_data").eq("invitation_id", own.id).maybeSingle(),
    db.from("payments").select("id").eq("invitation_id", own.id).eq("status", "paid").limit(1),
  ]);
  const fd = (req?.form_data ?? {}) as { selfService?: boolean; detailsAt?: string };
  if (!fd.selfService || fd.detailsAt || !paid?.length) return null;
  return { id: own.id as string, db };
}

/**
 * Photos du client : autorisation d'envoi à usage unique vers un stockage privé
 * (seule l'équipe peut les voir). Le fichier part directement du navigateur.
 */
export async function requestPhotoUpload(invitationId: string, file: { name: string; type: string; size: number }) {
  const order = await openOrder(invitationId);
  if (!order) return { ok: false as const };
  const ext = PHOTO_TYPES[file.type];
  if (!ext || !Number.isFinite(file.size) || file.size <= 0 || file.size > PHOTO_MAX) return { ok: false as const };
  const base = slugify(file.name.replace(/\.[^.]+$/, "")).slice(0, 40) || "photo";
  const path = `clients/${order.id}/${randomUUID().slice(0, 8)}-${base}.${ext}`;
  const { data, error } = await order.db.storage.from(PHOTO_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { ok: false as const };
  return { ok: true as const, path, token: data.token, mime: file.type };
}

/** Retire une photo envoyée (avant l'envoi du formulaire). */
export async function removePhoto(invitationId: string, path: string) {
  const order = await openOrder(invitationId);
  if (!order || !path.startsWith(`clients/${order.id}/`) || path.includes("..")) return;
  await order.db.storage.from(PHOTO_BUCKET).remove([path]);
}

/**
 * Le client valide son aperçu depuis son espace : l'invitation passe « prête à publier »
 * et l'équipe est prévenue (elle publie et envoie le lien final).
 */
export async function validateInvitation(form: FormData) {
  const id = z.string().uuid().safeParse(form.get("id"));
  const user = await getCurrentUser();
  const session = await createClient();
  if (!id.success || !user || !session) return;
  const { data: own } = await session.from("invitations").select("id, title, status").eq("id", id.data).maybeSingle();
  const db = createAdminClient();
  if (!own || !db || own.status === "published" || own.status === "archived") return;
  const [{ count: previews }, { data: req }] = await Promise.all([
    db.from("preview_tokens").select("token_hash", { count: "exact", head: true }).eq("invitation_id", own.id),
    db.from("client_requests").select("id, reference, form_data").eq("invitation_id", own.id).maybeSingle(),
  ]);
  if (!previews && own.status !== "pending_review") return; // pas encore d'aperçu à valider
  const validatedAt = new Date().toISOString();
  await Promise.all([
    db.from("invitations").update({ status: "ready" }).eq("id", own.id),
    req ? db.from("client_requests").update({ form_data: { ...((req.form_data ?? {}) as object), validatedAt } }).eq("id", req.id) : Promise.resolve(null),
  ]);
  await logActivity({ actorId: user.id, action: "invitation.validated_by_client", resourceType: "invitation", resourceId: own.id, summary: `Aperçu validé par le client — ${own.title}` });
  const settings = await getSettings();
  const adminTo = process.env.ADMIN_NOTIFICATION_EMAIL || settings.brand.contactEmail;
  if (adminTo) {
    const r = await sendEmail({
      to: adminTo,
      subject: `Invitation validée par le client — ${own.title}`,
      heading: "Aperçu validé",
      paragraphs: [`${user.email} a validé son invitation${req ? ` (${req.reference})` : ""}. Elle est prête à publier : ${env.siteUrl}/admin/invitations/${own.id}?onglet=publication`],
    });
    if (!r.sent) console.warn("[validation] notification équipe non envoyée :", r.error);
  }
  revalidatePath("/mon-espace");
}
