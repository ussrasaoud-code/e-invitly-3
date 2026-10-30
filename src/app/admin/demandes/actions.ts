"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { logActivity } from "@/lib/audit";
import { requireStaff } from "@/lib/auth";
import { buildInvitationFromRequest, type RequestFormData } from "@/lib/invitation/from-request";
import { templateDefinitionSchema } from "@/lib/invitation/schema";
import { slugFromNames } from "@/lib/slug";
import { suggestSlug } from "@/lib/slug-db";
import { REQUEST_STATUS, REQUEST_STATUSES } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";
import { zonedToUtc } from "@/lib/time";

const id = z.string().uuid();

export async function updateRequestStatus(form: FormData) {
  const user = await requireStaff();
  const requestId = id.parse(form.get("id"));
  const status = z.enum(REQUEST_STATUSES).parse(form.get("status"));
  const supabase = (await createClient())!;
  const { data, error } = await supabase.from("client_requests").update({ status }).eq("id", requestId).select("reference").single();
  if (error) throw new Error(`Mise à jour impossible : ${error.message}`);
  await logActivity({ actorId: user.id, action: "request.status", resourceType: "client_request", resourceId: requestId, summary: `Demande ${data.reference} → ${REQUEST_STATUS[status].label}` });
  revalidatePath(`/admin/demandes/${requestId}`);
  revalidatePath("/admin/demandes");
}

export async function saveRequestNotes(form: FormData) {
  await requireStaff();
  const requestId = id.parse(form.get("id"));
  const notes = z.string().max(10_000).parse(form.get("notes") ?? "");
  const supabase = (await createClient())!;
  const { error } = await supabase.from("client_requests").update({ internal_notes: notes }).eq("id", requestId);
  if (error) throw new Error(`Enregistrement impossible : ${error.message}`);
  revalidatePath(`/admin/demandes/${requestId}`);
}

export async function setRequestArchived(form: FormData) {
  const user = await requireStaff();
  const requestId = id.parse(form.get("id"));
  const archive = form.get("archive") === "1";
  const supabase = (await createClient())!;
  const { data, error } = await supabase
    .from("client_requests")
    .update({ archived_at: archive ? new Date().toISOString() : null })
    .eq("id", requestId)
    .select("reference")
    .single();
  if (error) throw new Error(error.message);
  await logActivity({ actorId: user.id, action: archive ? "request.archived" : "request.restored", resourceType: "client_request", resourceId: requestId, summary: `Demande ${data.reference} ${archive ? "archivée" : "restaurée"}` });
  revalidatePath("/admin/demandes");
  revalidatePath(`/admin/demandes/${requestId}`);
}

/**
 * Transforme une demande en invitation (brouillon) :
 * reprend toutes les réponses, fige la version courante du modèle,
 * propose un slug libre, crée le formulaire RSVP et l'accès du client.
 */
export async function convertRequestToInvitation(form: FormData) {
  const user = await requireStaff();
  const requestId = id.parse(form.get("id"));
  const supabase = (await createClient())!;

  const { data: req, error } = await supabase
    .from("client_requests")
    .select("*, templates(id, name, current_version_id, template_versions!templates_current_version_fk(id, renderer, definition))")
    .eq("id", requestId)
    .single();
  if (error || !req) throw new Error("Demande introuvable.");
  if (req.invitation_id) redirect(`/admin/invitations/${req.invitation_id}`);

  const tpl = req.templates as unknown as {
    id: string;
    name: string;
    template_versions: { id: string; renderer: string; definition: unknown } | null;
  } | null;
  const version = tpl?.template_versions;
  const def = templateDefinitionSchema.safeParse(version?.definition);
  if (!tpl || !version || !def.success) {
    throw new Error("Le modèle de cette demande n'a pas de version valide. Choisissez un modèle avant de convertir.");
  }

  const formData = { ...(req.form_data as Partial<RequestFormData>), partnerOne: req.partner_one ?? "", partnerTwo: req.partner_two ?? "", eventDate: req.event_date ?? "", language: req.language };
  const { content, notesToReview } = buildInvitationFromRequest(def.data.sample, formData as RequestFormData);
  const eventAt = content.eventAt ? zonedToUtc(content.eventAt, content.timezone)?.toISOString() ?? null : null;

  let invitationId: string | null = null;
  for (let attempt = 0; attempt < 3 && !invitationId; attempt++) {
    const slug = await suggestSlug(supabase, slugFromNames(req.partner_one, req.partner_two));
    const { data: inv, error: insErr } = await supabase
      .from("invitations")
      .insert({
        request_id: req.id,
        template_id: tpl.id,
        template_version_id: version.id,
        renderer: def.data.renderer,
        slug,
        title: `${req.partner_one} & ${req.partner_two}`,
        partner_one: req.partner_one,
        partner_two: req.partner_two,
        client_email: req.email,
        status: "customizing",
        event_at: eventAt,
        timezone: content.timezone,
        language: req.language,
        draft_content: content,
        internal_notes: notesToReview.length ? `À reprendre depuis la demande ${req.reference} :\n- ${notesToReview.join("\n- ")}` : "",
        created_by: user.id,
      })
      .select("id")
      .single();
    if (inv) invitationId = inv.id;
    else if (insErr?.code !== "23505") throw new Error(`Création impossible : ${insErr?.message}`);
  }
  if (!invitationId) throw new Error("Impossible de réserver une adresse libre. Réessayez.");

  const deadline = content.rsvp.deadline ? zonedToUtc(`${content.rsvp.deadline}T23:59`, content.timezone)?.toISOString() : null;
  const [rsvpRes, accessRes, reqRes] = await Promise.all([
    supabase.from("rsvp_forms").insert({
      invitation_id: invitationId,
      deadline,
      fields: { lastName: true, companions: true, companionNames: true, events: content.events.length > 1, dietary: false, menu: false, comment: true },
    }),
    supabase.from("invitation_access").insert({ invitation_id: invitationId, email: req.email, role: "owner", granted_by: user.id }),
    supabase.from("client_requests").update({ status: "converted", invitation_id: invitationId }).eq("id", req.id),
  ]);
  for (const r of [rsvpRes, accessRes, reqRes]) if (r.error) console.error("[convert]", r.error.message);

  await logActivity({
    actorId: user.id,
    action: "invitation.created",
    resourceType: "invitation",
    resourceId: invitationId,
    summary: `Invitation créée pour ${req.partner_one} & ${req.partner_two} depuis ${req.reference}`,
  });
  revalidatePath("/admin/demandes");
  revalidatePath("/admin/invitations");
  redirect(`/admin/invitations/${invitationId}?nouvelle=1`);
}
