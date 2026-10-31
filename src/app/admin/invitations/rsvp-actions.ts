"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logActivity } from "@/lib/audit";
import { requireStaff } from "@/lib/auth";
import { CUSTOM_QUESTION_TYPES, RSVP_FIELD_KEYS, customQuestionSchema, type CustomQuestion } from "@/lib/rsvp";
import { getOrCreateRsvpForm, newGuestCode } from "@/lib/rsvp-server";
import { createClient } from "@/lib/supabase/server";
import { zonedToUtc } from "@/lib/time";

const uuid = z.string().uuid();
const tab = (id: string) => `/admin/invitations/${id}`;

/** Réglages du formulaire RSVP d'une invitation. */
export async function saveRsvpConfig(form: FormData) {
  const user = await requireStaff();
  const invitationId = uuid.parse(form.get("id"));
  const supabase = (await createClient())!;
  const { data: inv } = await supabase.from("invitations").select("timezone, title").eq("id", invitationId).single();
  if (!inv) throw new Error("Invitation introuvable.");
  await getOrCreateRsvpForm(supabase, invitationId);

  const date = String(form.get("deadline") ?? "");
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Date limite invalide.");
  const deadline = date ? zonedToUtc(`${date}T23:59`, inv.timezone)?.toISOString() ?? null : null;
  const maxCompanions = z.coerce.number().int().min(0).max(20).parse(form.get("max_companions") ?? 0);
  const mode = z.enum(["open", "code"]).parse(form.get("mode") ?? "open");
  const fields = Object.fromEntries(RSVP_FIELD_KEYS.map((k) => [k, form.get(`field_${k}`) === "on"]));

  const questions: CustomQuestion[] = [];
  for (let i = 0; i < 5; i++) {
    const label = String(form.get(`q_label_${i}`) ?? "").trim();
    if (!label) continue;
    const type = String(form.get(`q_type_${i}`) ?? "text");
    const options = String(form.get(`q_options_${i}`) ?? "")
      .split(/[,;\n]/)
      .map((o) => o.trim())
      .filter(Boolean);
    const parsed = customQuestionSchema.safeParse({
      id: String(form.get(`q_id_${i}`) ?? "") || `q${Date.now().toString(36)}${i}`,
      label,
      type: type in CUSTOM_QUESTION_TYPES ? type : "text",
      options,
      required: form.get(`q_required_${i}`) === "on",
    });
    if (!parsed.success) throw new Error(`Question « ${label} » : ${parsed.error.issues[0]?.message}`);
    if (parsed.data.type === "choice" && parsed.data.options.length < 2) throw new Error(`Question « ${label} » : indiquez au moins deux choix, séparés par des virgules.`);
    questions.push(parsed.data);
  }

  const { error } = await supabase
    .from("rsvp_forms")
    .update({ is_open: form.get("is_open") === "on", deadline, mode, max_companions: maxCompanions, fields, custom_questions: questions })
    .eq("invitation_id", invitationId);
  if (error) throw new Error(`Enregistrement impossible : ${error.message}`);
  await logActivity({ actorId: user.id, action: "rsvp.config", resourceType: "invitation", resourceId: invitationId, summary: `${inv.title} : formulaire RSVP mis à jour` });
  revalidatePath(tab(invitationId));
}

/** Ajoute des invités nominatifs : une ligne par invité, « Nom ; accompagnants ». */
export async function addGuests(form: FormData) {
  const user = await requireStaff();
  const invitationId = uuid.parse(form.get("id"));
  const lines = String(form.get("guests") ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 300);
  if (!lines.length) throw new Error("Saisissez au moins un nom.");
  const supabase = (await createClient())!;
  const rows = lines.map((line) => {
    const [name, count] = line.split(/[;\t]/).map((p) => p.trim());
    const n = Number.parseInt(count ?? "0", 10);
    return { invitation_id: invitationId, display_name: name.slice(0, 80), max_companions: Number.isFinite(n) ? Math.min(Math.max(n, 0), 20) : 0 };
  });
  let added = 0;
  for (const row of rows) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const { error } = await supabase.from("guests").insert({ ...row, code: newGuestCode() });
      if (!error) {
        added++;
        break;
      }
      if (error.code !== "23505") throw new Error(error.message);
    }
  }
  await logActivity({ actorId: user.id, action: "rsvp.guests", resourceType: "invitation", resourceId: invitationId, summary: `${added} invité(s) nominatif(s) ajouté(s)` });
  revalidatePath(tab(invitationId));
}

export async function deleteGuest(form: FormData) {
  await requireStaff();
  const invitationId = uuid.parse(form.get("id"));
  const guestId = uuid.parse(form.get("guestId"));
  const supabase = (await createClient())!;
  const { error } = await supabase.from("guests").delete().eq("id", guestId).eq("invitation_id", invitationId);
  if (error) throw new Error(error.message);
  revalidatePath(tab(invitationId));
}

/** Correction d'une réponse par l'équipe, avec trace avant / après. */
export async function updateResponse(form: FormData) {
  const user = await requireStaff();
  const invitationId = uuid.parse(form.get("id"));
  const responseId = uuid.parse(form.get("responseId"));
  const supabase = (await createClient())!;
  const { data: before } = await supabase.from("rsvp_responses").select("*").eq("id", responseId).eq("invitation_id", invitationId).single();
  if (!before) throw new Error("Réponse introuvable.");
  const attending = form.get("attending") === "yes";
  const companionsCount = attending ? z.coerce.number().int().min(0).max(20).parse(form.get("companions_count") ?? 0) : 0;
  const after = {
    first_name: z.string().trim().min(1, "Prénom requis").max(60).parse(form.get("first_name")),
    last_name: z.string().trim().max(60).parse(form.get("last_name") ?? ""),
    attending,
    companions_count: companionsCount,
    companions: String(form.get("companions") ?? "")
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean)
      .slice(0, companionsCount),
    events: attending ? form.getAll("events").map(String).slice(0, 12) : [],
    child_menus: attending ? Math.min(z.coerce.number().int().min(0).max(21).parse(form.get("child_menus") ?? 0), companionsCount + 1) : 0,
    dietary: attending ? z.string().trim().max(300).parse(form.get("dietary") ?? "") || null : null,
    comment: z.string().trim().max(1000).parse(form.get("comment") ?? "") || null,
  };
  const { error } = await supabase.from("rsvp_responses").update(after).eq("id", responseId);
  if (error) throw new Error(error.message);
  await supabase.from("rsvp_response_edits").insert({ response_id: responseId, before, after, edited_by: user.id });
  await logActivity({ actorId: user.id, action: "rsvp.edited", resourceType: "rsvp_response", resourceId: invitationId, summary: `Réponse de ${after.first_name} ${after.last_name} corrigée` });
  revalidatePath(tab(invitationId));
}

export async function deleteResponse(form: FormData) {
  const user = await requireStaff();
  const invitationId = uuid.parse(form.get("id"));
  const responseId = uuid.parse(form.get("responseId"));
  const supabase = (await createClient())!;
  const { data, error } = await supabase
    .from("rsvp_responses")
    .delete()
    .eq("id", responseId)
    .eq("invitation_id", invitationId)
    .select("first_name, last_name")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data) {
    await logActivity({ actorId: user.id, action: "rsvp.deleted", resourceType: "rsvp_response", resourceId: invitationId, summary: `Réponse de ${data.first_name} ${data.last_name} supprimée` });
  }
  revalidatePath(tab(invitationId));
}
