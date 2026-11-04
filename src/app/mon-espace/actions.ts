"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logActivity } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { cleanQuestions, DEFAULT_RSVP_FIELDS, rsvpChoicesSchema } from "@/lib/rsvp";
import { getOrCreateRsvpForm } from "@/lib/rsvp-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { zonedToUtc } from "@/lib/time";

const payloadSchema = z.object({
  choices: rsvpChoicesSchema,
  deadline: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/),
  open: z.boolean(),
});

/**
 * Les mariés règlent eux-mêmes leur formulaire de réponse.
 * L'invitation est d'abord lue avec LEUR session : la base ne la renvoie que
 * si elle leur appartient. Seulement ensuite, l'écriture passe par le serveur.
 */
export async function saveCoupleRsvp(invitationId: string, payload: unknown): Promise<{ ok: true } | { ok: false; error: "invalid" | "choice" | "server"; label?: string }> {
  const user = await getCurrentUser();
  if (!user || !z.string().uuid().safeParse(invitationId).success) return { ok: false, error: "server" };
  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { data: inv } = (await supabase?.from("invitations").select("id, title, timezone").eq("id", invitationId).maybeSingle()) ?? { data: null };
  if (!inv) return { ok: false, error: "server" };
  const cleaned = cleanQuestions(parsed.data.choices.questions);
  if (!cleaned.ok) return { ok: false, error: "choice", label: cleaned.label };
  const db = createAdminClient();
  if (!db) return { ok: false, error: "server" };
  await getOrCreateRsvpForm(db, invitationId);
  const d = parsed.data;
  const deadline = d.deadline ? zonedToUtc(`${d.deadline}T23:59`, inv.timezone || "Europe/Paris")?.toISOString() ?? null : null;
  const { error } = await db
    .from("rsvp_forms")
    .update({
      fields: { ...DEFAULT_RSVP_FIELDS, ...d.choices.fields },
      max_companions: d.choices.maxCompanions,
      custom_questions: cleaned.questions,
      deadline,
      is_open: d.open,
    })
    .eq("invitation_id", invitationId);
  if (error) return { ok: false, error: "server" };
  await logActivity({ actorId: user.id, action: "rsvp.config", resourceType: "invitation", resourceId: invitationId, summary: `${inv.title} : formulaire de réponse modifié par les mariés` });
  revalidatePath(`/mon-espace/${invitationId}`);
  return { ok: true };
}
