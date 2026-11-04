"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { logActivity } from "@/lib/audit";
import { requireStaff } from "@/lib/auth";
import type { SaveResult } from "@/lib/save-result";
import { LANGUAGES, invitationContentSchema, type InvitationContentInput } from "@/lib/invitation/schema";
import { altOf, newAlt, stripAlt } from "@/lib/invitation/bilingual";
import { getVariant, mainLang } from "@/lib/invitation/variants";
import { templateDefinitionSchema } from "@/lib/invitation/schema";
import { SLUG_PROBLEM_MESSAGES, slugify, validateSlug } from "@/lib/slug";
import { isSlugTaken, suggestSlug } from "@/lib/slug-db";
import { INVITATION_STATUS, MANUAL_INVITATION_STATUSES } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";
import { zonedToUtc } from "@/lib/time";
import { env } from "@/lib/env";
import { hashAccessCode, newPreviewToken, normalizeAccessCode } from "@/lib/publication";
import { sendEmail } from "@/lib/email";
import { fmt, isSiteLang, LANG_META } from "@/lib/i18n/config";
import { dictFor } from "@/lib/i18n/server";
import { getSettings } from "@/lib/settings";

const uuid = z.string().uuid();


/** Sauvegarde du brouillon (automatique depuis l'éditeur). N'affecte jamais la version publiée. */
export async function saveInvitationDraft(invitationId: string, input: InvitationContentInput): Promise<SaveResult> {
  const user = await requireStaff();
  if (!uuid.safeParse(invitationId).success) return { ok: false, message: "Invitation inconnue." };
  const parsed = invitationContentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Certaines valeurs ne sont pas valides : le brouillon n'a pas été enregistré.",
      issues: parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(" › ")} : ${i.message}`),
    };
  }
  const supabase = (await createClient())!;
  const { data: before } = await supabase.from("invitations").select("draft_updated_at, title, draft_content").eq("id", invitationId).maybeSingle();
  if (!before) return { ok: false, message: "Invitation introuvable." };
  // La deuxième langue s'enregistre à part (saveInvitationAlt) : on garde celle déjà en base
  const storedAlt = (before.draft_content as { alt?: unknown } | null)?.alt;
  const content = { ...parsed.data, alt: storedAlt };
  if (altOf(content)?.language === content.language) content.alt = undefined;
  await snapshotBeforeSession(supabase, invitationId, before.draft_content, user.id);

  const now = new Date().toISOString();
  const eventAt = content.eventAt ? zonedToUtc(content.eventAt, content.timezone)?.toISOString() ?? null : null;
  const { error } = await supabase
    .from("invitations")
    .update({
      draft_content: content,
      draft_updated_at: now,
      title: `${content.couple.partnerOne} & ${content.couple.partnerTwo}`,
      partner_one: content.couple.partnerOne,
      partner_two: content.couple.partnerTwo,
      event_at: eventAt,
      timezone: content.timezone,
      language: content.language,
    })
    .eq("id", invitationId);
  if (error) return { ok: false, message: `Enregistrement impossible : ${error.message}` };

  // Une entrée de journal par session de travail (pas une par sauvegarde automatique)
  if (Date.now() - new Date(before.draft_updated_at).getTime() > 15 * 60_000) {
    await logActivity({ actorId: user.id, action: "invitation.edited", resourceType: "invitation", resourceId: invitationId, summary: `Invitation ${content.couple.partnerOne} & ${content.couple.partnerTwo} modifiée` });
  }
  return { ok: true, savedAt: now };
}

/** Deuxième langue de l'invitation (textes traduits ; le design suit la version principale). */
export async function saveInvitationAlt(invitationId: string, input: InvitationContentInput): Promise<SaveResult> {
  await requireStaff();
  if (!uuid.safeParse(invitationId).success) return { ok: false, message: "Invitation inconnue." };
  const parsed = invitationContentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Certaines valeurs ne sont pas valides : la traduction n'a pas été enregistrée.",
      issues: parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(" › ")} : ${i.message}`),
    };
  }
  const supabase = (await createClient())!;
  const { data: before } = await supabase.from("invitations").select("draft_content").eq("id", invitationId).maybeSingle();
  const main = invitationContentSchema.safeParse(before?.draft_content);
  if (!before || !main.success) return { ok: false, message: "Invitation introuvable." };
  if (parsed.data.language === main.data.language) return { ok: false, message: "La deuxième langue doit être différente de la langue principale." };
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("invitations")
    .update({ draft_content: { ...main.data, alt: stripAlt(parsed.data) }, draft_updated_at: now })
    .eq("id", invitationId);
  if (error) return { ok: false, message: `Enregistrement impossible : ${error.message}` };
  return { ok: true, savedAt: now };
}

/** Ajoute une deuxième langue (une seule possible) : reprend la version traduite du modèle si elle existe. */
export async function addInvitationLanguage(form: FormData) {
  const user = await requireStaff();
  const id = uuid.parse(form.get("id"));
  const lang = z.enum(LANGUAGES).parse(form.get("lang"));
  const supabase = (await createClient())!;
  const { data: inv } = await supabase.from("invitations").select("draft_content, template_version_id").eq("id", id).maybeSingle();
  const main = invitationContentSchema.safeParse(inv?.draft_content);
  if (!inv || !main.success) throw new Error("Invitation introuvable.");
  if (lang === main.data.language) throw new Error("Choisissez une langue différente de la langue principale.");
  let tpl: { main: import("@/lib/invitation/schema").InvitationContent; variant: import("@/lib/invitation/schema").InvitationContent } | null = null;
  if (inv.template_version_id) {
    const { data: tv } = await supabase.from("template_versions").select("definition").eq("id", inv.template_version_id).maybeSingle();
    const def = templateDefinitionSchema.safeParse(tv?.definition);
    if (def.success) {
      const variant = getVariant(def.data, lang);
      const tplMain = getVariant(def.data, main.data.language) ?? getVariant(def.data, mainLang(def.data));
      if (variant && tplMain && lang !== main.data.language) tpl = { main: tplMain, variant };
    }
  }
  const alt = newAlt(main.data, lang, tpl);
  const { error } = await supabase.from("invitations").update({ draft_content: { ...main.data, alt }, draft_updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
  await logActivity({ actorId: user.id, action: "invitation.edited", resourceType: "invitation", resourceId: id, summary: `Deuxième langue ajoutée (${lang})` });
  redirect(`/admin/invitations/${id}/editeur?langue=${lang}`);
}

export async function removeInvitationLanguage(form: FormData) {
  const user = await requireStaff();
  const id = uuid.parse(form.get("id"));
  const supabase = (await createClient())!;
  const { data: inv } = await supabase.from("invitations").select("draft_content").eq("id", id).maybeSingle();
  const main = invitationContentSchema.safeParse(inv?.draft_content);
  if (!inv || !main.success) throw new Error("Invitation introuvable.");
  const { error } = await supabase.from("invitations").update({ draft_content: stripAlt(main.data), draft_updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
  await logActivity({ actorId: user.id, action: "invitation.edited", resourceType: "invitation", resourceId: id, summary: "Deuxième langue retirée" });
  redirect(`/admin/invitations/${id}/editeur`);
}

export async function checkSlug(invitationId: string, raw: string): Promise<{ slug: string; ok: boolean; message: string }> {
  await requireStaff();
  const slug = slugify(raw);
  const problem = validateSlug(slug);
  if (problem) return { slug, ok: false, message: SLUG_PROBLEM_MESSAGES[problem] };
  const supabase = (await createClient())!;
  if (await isSlugTaken(supabase, slug, invitationId)) {
    const alt = await suggestSlug(supabase, slug, invitationId);
    return { slug, ok: false, message: `Cette adresse est déjà utilisée. Suggestion : ${alt}` };
  }
  return { slug, ok: true, message: "Adresse disponible." };
}

export async function updateSlug(form: FormData) {
  const user = await requireStaff();
  const invitationId = uuid.parse(form.get("id"));
  const slug = slugify(String(form.get("slug") ?? ""));
  const problem = validateSlug(slug);
  if (problem) throw new Error(SLUG_PROBLEM_MESSAGES[problem]);
  const supabase = (await createClient())!;
  const { data: inv } = await supabase.from("invitations").select("slug, published_version_id").eq("id", invitationId).single();
  if (!inv) throw new Error("Invitation introuvable.");
  if (inv.slug === slug) return;
  if (await isSlugTaken(supabase, slug, invitationId)) throw new Error("Cette adresse est déjà utilisée.");

  // Reprise d'une ancienne adresse de cette même invitation : on retire la redirection.
  await supabase.from("slug_redirects").delete().eq("old_slug", slug).eq("invitation_id", invitationId);
  const { error } = await supabase.from("invitations").update({ slug }).eq("id", invitationId);
  if (error) throw new Error(error.code === "23505" ? "Cette adresse vient d'être prise." : error.message);

  // Déjà publiée : l'ancien lien redirige vers le nouveau, sauf refus explicite (confidentialité).
  const keepRedirect = Boolean(inv.published_version_id) && form.get("redirect") === "on";
  if (keepRedirect) {
    const { error: rErr } = await supabase
      .from("slug_redirects")
      .upsert({ old_slug: inv.slug, invitation_id: invitationId }, { onConflict: "old_slug" });
    if (rErr) console.error("[slug] redirection", rErr.message);
  }
  await logActivity({
    actorId: user.id,
    action: "invitation.slug",
    resourceType: "invitation",
    resourceId: invitationId,
    summary: `Adresse changée : ${inv.slug} → ${slug}${keepRedirect ? " (ancien lien redirigé)" : ""}`,
  });
  revalidatePath(`/admin/invitations/${invitationId}`);
  revalidatePath("/admin/invitations");
}

/* ── Publication ─────────────────────────────────────────────────────── */

/** Publie le brouillon : il devient une nouvelle version, visible à l'adresse publique. */
export async function publishInvitation(form: FormData) {
  const user = await requireStaff();
  const invitationId = uuid.parse(form.get("id"));
  const note = z.string().trim().max(200).parse(form.get("note") ?? "");
  const supabase = (await createClient())!;
  const { data: inv } = await supabase.from("invitations").select("slug, title, status, draft_content, published_version_id").eq("id", invitationId).single();
  if (!inv) throw new Error("Invitation introuvable.");
  if (inv.status === "archived") throw new Error("Restaurez l'invitation avant de la publier.");
  // Première publication : le paiement doit être reçu (sauf choix explicite « publier sans paiement »)
  if (!inv.published_version_id && form.get("sans_paiement") !== "on") {
    const { data: paid, error: payErr } = await supabase.from("payments").select("id").eq("invitation_id", invitationId).eq("status", "paid").limit(1);
    if (!payErr && !paid?.length) {
      throw new Error("Le paiement n'a pas encore été reçu. Envoyez le lien de paiement au client, ou cochez « Publier sans paiement ».");
    }
  }
  const parsed = invitationContentSchema.safeParse(inv.draft_content);
  if (!parsed.success) throw new Error("Le brouillon contient des valeurs invalides : corrigez-les dans l'éditeur avant de publier.");
  const content = parsed.data;
  if (!content.couple.partnerOne || !content.couple.partnerTwo) throw new Error("Les deux prénoms sont nécessaires avant de publier.");
  if (!content.eventAt) throw new Error("La date de l'événement est nécessaire avant de publier.");

  let versionId: string | null = null;
  let versionNumber = 0;
  for (let attempt = 0; attempt < 3 && !versionId; attempt++) {
    const { data: last } = await supabase
      .from("invitation_versions")
      .select("version")
      .eq("invitation_id", invitationId)
      .order("version", { ascending: false })
      .limit(1);
    versionNumber = (last?.[0]?.version ?? 0) + 1;
    const { data: v, error } = await supabase
      .from("invitation_versions")
      .insert({ invitation_id: invitationId, version: versionNumber, content, note: note || null, published_by: user.id })
      .select("id")
      .single();
    if (v) versionId = v.id;
    else if (error?.code !== "23505") throw new Error(`Publication impossible : ${error?.message}`);
  }
  if (!versionId) throw new Error("Publication impossible, réessayez.");

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("invitations")
    .update({ status: "published", published_version_id: versionId, published_at: now, archived_at: null })
    .eq("id", invitationId);
  if (error) throw new Error(`Publication impossible : ${error.message}`);

  await logActivity({
    actorId: user.id,
    action: "invitation.published",
    resourceType: "invitation",
    resourceId: invitationId,
    summary: `${inv.title} publiée (version ${versionNumber})`,
  });
  revalidatePath(`/${inv.slug}`);
  revalidatePath(`/admin/invitations/${invitationId}`);
  revalidatePath("/admin/invitations");
  redirect(`/admin/invitations/${invitationId}?onglet=publication&publiee=${versionNumber}`);
}

/** Retire l'invitation du site : l'adresse n'affiche plus rien, tout reste dans l'administration. */
export async function unpublishInvitation(form: FormData) {
  const user = await requireStaff();
  const invitationId = uuid.parse(form.get("id"));
  const supabase = (await createClient())!;
  const { data, error } = await supabase
    .from("invitations")
    .update({ status: "unpublished" })
    .eq("id", invitationId)
    .eq("status", "published")
    .select("title, slug")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return;
  await logActivity({ actorId: user.id, action: "invitation.unpublished", resourceType: "invitation", resourceId: invitationId, summary: `${data.title} dépubliée` });
  revalidatePath(`/${data.slug}`);
  revalidatePath(`/admin/invitations/${invitationId}`);
  revalidatePath("/admin/invitations");
}

/** Crée un lien d'aperçu privé du brouillon, valable 7 jours. */
export async function createPreviewLink(invitationId: string): Promise<{ ok: true; url: string; expiresAt: string } | { ok: false; message: string }> {
  const user = await requireStaff();
  if (!uuid.safeParse(invitationId).success) return { ok: false, message: "Invitation inconnue." };
  const supabase = (await createClient())!;
  const { token, hash } = newPreviewToken();
  const { protection } = await getSettings();
  const hours = Math.min(720, Math.max(1, protection.previewHours || 48));
  const expiresAt = new Date(Date.now() + hours * 3_600_000).toISOString();
  await supabase.from("preview_tokens").delete().eq("invitation_id", invitationId).lt("expires_at", new Date().toISOString());
  const { error } = await supabase.from("preview_tokens").insert({ token_hash: hash, invitation_id: invitationId, expires_at: expiresAt, created_by: user.id });
  if (error) return { ok: false, message: `Création du lien impossible : ${error.message}` };
  await logActivity({ actorId: user.id, action: "invitation.preview", resourceType: "invitation", resourceId: invitationId, summary: `Lien d'aperçu privé créé (${hours} h)` });
  return { ok: true, url: `${env.siteUrl}/apercu/${token}`, expiresAt };
}

/** Désactive tous les liens d'aperçu de l'invitation. */
export async function revokePreviewLinks(form: FormData) {
  await requireStaff();
  const invitationId = uuid.parse(form.get("id"));
  const supabase = (await createClient())!;
  await supabase.from("preview_tokens").delete().eq("invitation_id", invitationId);
  revalidatePath(`/admin/invitations/${invitationId}`);
}

/** Recopie une version publiée dans le brouillon (pour revenir en arrière). */
export async function restoreVersionToDraft(form: FormData) {
  const user = await requireStaff();
  const invitationId = uuid.parse(form.get("id"));
  const version = z.coerce.number().int().positive().parse(form.get("version"));
  const supabase = (await createClient())!;
  const { data: current } = await supabase.from("invitations").select("draft_content").eq("id", invitationId).single();
  if (current) {
    await supabase.from("invitation_draft_history").insert({ invitation_id: invitationId, content: current.draft_content, kind: "restore", label: `Avant la recopie de la version publiée ${version}`, created_by: user.id });
  }
  const { data: v } = await supabase.from("invitation_versions").select("content").eq("invitation_id", invitationId).eq("version", version).single();
  if (!v) throw new Error("Version introuvable.");
  const { error } = await supabase
    .from("invitations")
    .update({ draft_content: v.content, draft_updated_at: new Date().toISOString() })
    .eq("id", invitationId);
  if (error) throw new Error(error.message);
  await logActivity({ actorId: user.id, action: "invitation.restored_version", resourceType: "invitation", resourceId: invitationId, summary: `Version ${version} recopiée dans le brouillon` });
  revalidatePath(`/admin/invitations/${invitationId}`);
}

export async function setNoindex(form: FormData) {
  await requireStaff();
  const invitationId = uuid.parse(form.get("id"));
  const supabase = (await createClient())!;
  const { error } = await supabase.from("invitations").update({ noindex: form.get("noindex") === "on" }).eq("id", invitationId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/invitations/${invitationId}`);
}

/** Définit ou retire le code d'accès (stocké uniquement sous forme hachée). */
export async function setAccessCode(form: FormData) {
  const user = await requireStaff();
  const invitationId = uuid.parse(form.get("id"));
  const remove = form.get("remove") === "1";
  const code = String(form.get("code") ?? "");
  if (!remove && normalizeAccessCode(code).length < 4) throw new Error("Le code doit contenir au moins 4 caractères.");
  if (!remove && normalizeAccessCode(code).length > 40) throw new Error("Le code doit contenir au plus 40 caractères.");
  const supabase = (await createClient())!;
  const { data, error } = await supabase
    .from("invitations")
    .update({ access_code_hash: remove ? null : hashAccessCode(invitationId, code) })
    .eq("id", invitationId)
    .select("slug, title")
    .single();
  if (error) throw new Error(error.message);
  await logActivity({ actorId: user.id, action: remove ? "invitation.code_removed" : "invitation.code_set", resourceType: "invitation", resourceId: invitationId, summary: `${data.title} : code d'accès ${remove ? "retiré" : "défini"}` });
  revalidatePath(`/${data.slug}`);
  revalidatePath(`/admin/invitations/${invitationId}`);
}

export async function updateInvitationStatus(form: FormData) {
  const user = await requireStaff();
  const invitationId = uuid.parse(form.get("id"));
  const status = z.enum(MANUAL_INVITATION_STATUSES as [string, ...string[]]).parse(form.get("status"));
  const supabase = (await createClient())!;
  const { data: inv } = await supabase.from("invitations").select("status, title").eq("id", invitationId).single();
  if (inv?.status === "published") throw new Error("Une invitation publiée se dépublie depuis l'onglet Publication.");
  const { error } = await supabase.from("invitations").update({ status }).eq("id", invitationId);
  if (error) throw new Error(error.message);
  await logActivity({ actorId: user.id, action: "invitation.status", resourceType: "invitation", resourceId: invitationId, summary: `${inv?.title} → ${INVITATION_STATUS[status as keyof typeof INVITATION_STATUS].label}` });
  revalidatePath(`/admin/invitations/${invitationId}`);
  revalidatePath("/admin/invitations");
}

export async function saveInvitationNotes(form: FormData) {
  await requireStaff();
  const invitationId = uuid.parse(form.get("id"));
  const notes = z.string().max(20_000).parse(form.get("notes") ?? "");
  const supabase = (await createClient())!;
  const { error } = await supabase.from("invitations").update({ internal_notes: notes }).eq("id", invitationId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/invitations/${invitationId}`);
}

export async function duplicateInvitation(form: FormData) {
  const user = await requireStaff();
  const invitationId = uuid.parse(form.get("id"));
  const supabase = (await createClient())!;
  const { data: src } = await supabase.from("invitations").select("*").eq("id", invitationId).single();
  if (!src) throw new Error("Invitation introuvable.");
  const slug = await suggestSlug(supabase, `${src.slug}-copie`);
  const { data: copy, error } = await supabase
    .from("invitations")
    .insert({
      template_id: src.template_id,
      template_version_id: src.template_version_id,
      renderer: src.renderer,
      slug,
      title: `${src.title} (copie)`,
      partner_one: src.partner_one,
      partner_two: src.partner_two,
      status: "draft",
      event_at: src.event_at,
      timezone: src.timezone,
      language: src.language,
      draft_content: src.draft_content,
      internal_notes: `Copie de « ${src.title} ».`,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !copy) throw new Error(`Duplication impossible : ${error?.message}`);
  await supabase.from("rsvp_forms").insert({ invitation_id: copy.id });
  await logActivity({ actorId: user.id, action: "invitation.duplicated", resourceType: "invitation", resourceId: copy.id, summary: `Invitation dupliquée depuis ${src.title}` });
  redirect(`/admin/invitations/${copy.id}`);
}

export async function setInvitationArchived(form: FormData) {
  const user = await requireStaff();
  const invitationId = uuid.parse(form.get("id"));
  const archive = form.get("archive") === "1";
  const supabase = (await createClient())!;
  const { data, error } = await supabase
    .from("invitations")
    .update(archive ? { status: "archived", archived_at: new Date().toISOString() } : { status: "draft", archived_at: null })
    .eq("id", invitationId)
    .select("title")
    .single();
  if (error) throw new Error(error.message);
  await logActivity({ actorId: user.id, action: archive ? "invitation.archived" : "invitation.restored", resourceType: "invitation", resourceId: invitationId, summary: `${data.title} ${archive ? "archivée" : "restaurée en brouillon"}` });
  revalidatePath(`/admin/invitations/${invitationId}`);
  revalidatePath("/admin/invitations");
}

export async function deleteInvitation(form: FormData) {
  const user = await requireStaff();
  const invitationId = uuid.parse(form.get("id"));
  const confirmation = String(form.get("confirmation") ?? "").trim();
  const supabase = (await createClient())!;
  const { data: inv } = await supabase.from("invitations").select("slug, title").eq("id", invitationId).single();
  if (!inv) throw new Error("Invitation introuvable.");
  if (confirmation !== inv.slug) throw new Error(`Pour confirmer, saisissez exactement l'adresse « ${inv.slug} ».`);
  const { error } = await supabase.from("invitations").delete().eq("id", invitationId);
  if (error) throw new Error(error.message);
  await logActivity({ actorId: user.id, action: "invitation.deleted", resourceType: "invitation", resourceId: null, summary: `Invitation ${inv.title} (${inv.slug}) supprimée définitivement`, details: { invitationId } });
  revalidatePath("/admin/invitations");
  redirect("/admin/invitations");
}

type Db = NonNullable<Awaited<ReturnType<typeof createClient>>>;

/**
 * Point de restauration automatique : au début de chaque séance de travail
 * (aucun point depuis 10 minutes), on garde l'état du brouillon AVANT les
 * nouvelles modifications.
 */
async function snapshotBeforeSession(supabase: Db, invitationId: string, previous: unknown, userId: string) {
  const { data: last } = await supabase
    .from("invitation_draft_history")
    .select("created_at")
    .eq("invitation_id", invitationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (last && Date.now() - new Date(last.created_at).getTime() < 10 * 60_000) return;
  await supabase.from("invitation_draft_history").insert({ invitation_id: invitationId, content: previous, kind: "auto", created_by: userId });
}

/**
 * Envoie l'aperçu au couple (tous les e-mails ayant accès à l'espace mariés),
 * dans la langue de l'invitation, avec un mot personnel facultatif.
 * Les réponses arrivent sur l'e-mail de contact (Paramètres → Marque et contact).
 */
export async function sendPreviewEmail(invitationId: string, url: string, expiresAt: string, note: string): Promise<{ ok: true; to: string[] } | { ok: false; message: string }> {
  const user = await requireStaff();
  if (!uuid.safeParse(invitationId).success) return { ok: false, message: "Invitation inconnue." };
  if (!url.startsWith(`${env.siteUrl}/apercu/`)) return { ok: false, message: "Lien d'aperçu invalide." };
  const supabase = (await createClient())!;
  const { data: inv } = await supabase.from("invitations").select("title, partner_one, partner_two, client_email, language").eq("id", invitationId).single();
  if (!inv) return { ok: false, message: "Invitation introuvable." };
  const { data: access } = await supabase.from("invitation_access").select("email").eq("invitation_id", invitationId);
  const to = [...new Set([...(access ?? []).map((a) => String(a.email).toLowerCase()), ...(inv.client_email ? [String(inv.client_email).toLowerCase()] : [])])];
  if (!to.length) return { ok: false, message: "Aucun e-mail pour ce couple : ajoutez-en un dans « Espace mariés »." };
  const settings = await getSettings();
  if (!settings.brand.contactEmail) return { ok: false, message: "Renseignez d'abord votre e-mail de contact (Paramètres → Marque et contact) : c'est là qu'arriveront les réponses du couple." };
  const lang = isSiteLang(inv.language) ? inv.language : "fr";
  const t = dictFor(lang).previewEmail;
  const couple = inv.partner_one && inv.partner_two ? `${inv.partner_one} & ${inv.partner_two}` : inv.title;
  const date = new Intl.DateTimeFormat(LANG_META[lang].intl, { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Paris" }).format(new Date(expiresAt));
  const cleanNote = note.trim().slice(0, 1500);
  for (const address of to) {
    const res = await sendEmail({
      to: address,
      subject: fmt(t.subject, { couple }),
      heading: t.heading,
      paragraphs: [t.text, ...(cleanNote ? [`${t.noteLabel} ${cleanNote}`] : [])],
      action: { label: t.button, url },
      after: [fmt(t.validUntil, { date }), t.changes, ...(settings.brand.whatsapp ? [`${dictFor(lang).contact.whatsapp} : ${settings.brand.whatsapp}`] : []), fmt(dictFor(lang).access.signature, { brand: settings.brand.name })],
      replyTo: settings.brand.contactEmail,
      lang,
    });
    if (!res.sent) return { ok: false, message: `E-mail non envoyé à ${address} : ${res.error ?? "service e-mail"}.` };
  }
  await logActivity({ actorId: user.id, action: "preview.sent", resourceType: "invitation", resourceId: invitationId, summary: `Aperçu envoyé à ${to.join(", ")}` });
  return { ok: true, to };
}
