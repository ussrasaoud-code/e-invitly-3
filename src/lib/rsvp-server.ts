import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_RSVP_FIELDS, normalizeFields, normalizeQuestions, type PublicRsvpConfig } from "@/lib/rsvp";
import { createAdminClient } from "@/lib/supabase/admin";

export type RsvpFormRow = {
  id: string;
  invitation_id: string;
  fields: unknown;
  custom_questions: unknown;
  deadline: string | null;
  is_open: boolean;
  mode: "open" | "code";
  max_companions: number;
};

/** Formulaire RSVP d'une invitation ; le crée avec les valeurs par défaut s'il manque. */
export async function getOrCreateRsvpForm(db: SupabaseClient, invitationId: string): Promise<RsvpFormRow | null> {
  const { data } = await db.from("rsvp_forms").select("*").eq("invitation_id", invitationId).maybeSingle();
  if (data) return data as RsvpFormRow;
  const { data: created, error } = await db
    .from("rsvp_forms")
    .insert({ invitation_id: invitationId, fields: DEFAULT_RSVP_FIELDS })
    .select("*")
    .single();
  if (error) console.error("[rsvp] création du formulaire", error.message);
  return (created as RsvpFormRow) ?? null;
}

export function toPublicConfig(form: RsvpFormRow): PublicRsvpConfig {
  const deadlinePassed = form.deadline ? new Date(form.deadline).getTime() < Date.now() : false;
  return {
    open: form.is_open && !deadlinePassed,
    closedReason: !form.is_open ? "closed" : deadlinePassed ? "deadline" : null,
    deadline: form.deadline,
    mode: form.mode,
    maxCompanions: form.max_companions,
    fields: normalizeFields(form.fields),
    questions: normalizeQuestions(form.custom_questions),
  };
}

/** Configuration publique (sans les codes invités), lue côté serveur uniquement. */
export async function getPublicRsvpConfig(invitationId: string): Promise<PublicRsvpConfig | null> {
  const db = createAdminClient();
  if (!db) return null;
  const form = await getOrCreateRsvpForm(db, invitationId);
  return form ? toPublicConfig(form) : null;
}

/** Code invité lisible (sans 0/O/1/I). */
export function newGuestCode(length = 6) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}
