"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { logActivity } from "@/lib/audit";
import { requireStaff } from "@/lib/auth";
import type { SaveResult } from "@/lib/save-result";
import { invitationContentSchema, type InvitationContentInput } from "@/lib/invitation/schema";
import { SLUG_PROBLEM_MESSAGES, slugify, validateSlug } from "@/lib/slug";
import { isSlugTaken, suggestSlug } from "@/lib/slug-db";
import { INVITATION_STATUS, MANUAL_INVITATION_STATUSES } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";
import { zonedToUtc } from "@/lib/time";

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
  const content = parsed.data;
  const supabase = (await createClient())!;
  const { data: before } = await supabase.from("invitations").select("draft_updated_at, title").eq("id", invitationId).maybeSingle();
  if (!before) return { ok: false, message: "Invitation introuvable." };

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
  if (inv.published_version_id) {
    throw new Error("Cette invitation a déjà été publiée : le changement d'adresse avec redirection arrive avec la publication (phase 4).");
  }
  if (await isSlugTaken(supabase, slug, invitationId)) throw new Error("Cette adresse est déjà utilisée.");
  const { error } = await supabase.from("invitations").update({ slug }).eq("id", invitationId);
  if (error) throw new Error(error.code === "23505" ? "Cette adresse vient d'être prise." : error.message);
  await logActivity({ actorId: user.id, action: "invitation.slug", resourceType: "invitation", resourceId: invitationId, summary: `Adresse changée : ${inv.slug} → ${slug}` });
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
