import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { EVENT_TYPE_LABELS, invitationContentSchema } from "@/lib/invitation/schema";
import { countByEvent, normalizeFields, normalizeQuestions, type CustomQuestion, type RsvpFields } from "@/lib/rsvp";

export type RsvpResponseRow = {
  id: string;
  guest_id: string | null;
  first_name: string;
  last_name: string;
  attending: boolean;
  companions_count: number;
  companions: string[];
  events: string[];
  dietary: string | null;
  child_menus: number;
  answers: Record<string, string>;
  comment: string | null;
  submitted_at: string;
  updated_at: string;
};

export type GuestRow = { id: string; display_name: string; code: string; max_companions: number };

export type RsvpOverview = {
  title: string;
  slug: string;
  status: string;
  events: Array<{ id: string; title: string }>;
  responses: RsvpResponseRow[];
  guests: GuestRow[];
  editedIds: Set<string>;
  form: { is_open: boolean; deadline: string | null; mode: "open" | "code"; max_companions: number; fields: RsvpFields; questions: CustomQuestion[] } | null;
  stats: { responses: number; attending: number; declined: number; companions: number; people: number; childMenus: number; withDietary: number };
  byEvent: Record<string, number>;
};

/**
 * Toutes les données RSVP d'une invitation, lues avec le client fourni :
 * avec le client de l'utilisateur connecté, les règles de la base
 * garantissent qu'un couple ne voit que ses propres réponses.
 */
export async function loadRsvpOverview(db: SupabaseClient, invitationId: string): Promise<RsvpOverview | null> {
  const { data: inv } = await db
    .from("invitations")
    .select("id, title, slug, status, draft_content, published_version_id")
    .eq("id", invitationId)
    .maybeSingle();
  if (!inv) return null;

  const [{ data: version }, { data: responses }, { data: guests }, { data: form }] = await Promise.all([
    inv.published_version_id
      ? db.from("invitation_versions").select("content").eq("id", inv.published_version_id).maybeSingle()
      : Promise.resolve({ data: null }),
    db.from("rsvp_responses").select("*").eq("invitation_id", invitationId).order("submitted_at", { ascending: false }),
    db.from("guests").select("id, display_name, code, max_companions").eq("invitation_id", invitationId).order("display_name"),
    db.from("rsvp_forms").select("*").eq("invitation_id", invitationId).maybeSingle(),
  ]);

  const rows = (responses ?? []).map((r) => ({
    ...r,
    companions: Array.isArray(r.companions) ? r.companions : [],
    events: Array.isArray(r.events) ? r.events : [],
    answers: r.answers && typeof r.answers === "object" ? r.answers : {},
    child_menus: r.child_menus ?? 0,
  })) as RsvpResponseRow[];

  const ids = rows.map((r) => r.id);
  const { data: edits } = ids.length
    ? await db.from("rsvp_response_edits").select("response_id").in("response_id", ids)
    : { data: [] as Array<{ response_id: string }> };

  const content = invitationContentSchema.safeParse(version?.content ?? inv.draft_content);
  const events = content.success ? content.data.events.map((e) => ({ id: e.id, title: e.title || EVENT_TYPE_LABELS[e.type] })) : [];

  const attendingRows = rows.filter((r) => r.attending);
  const companions = attendingRows.reduce((n, r) => n + r.companions_count, 0);
  return {
    title: inv.title,
    slug: inv.slug,
    status: inv.status,
    events,
    responses: rows,
    guests: (guests ?? []) as GuestRow[],
    editedIds: new Set((edits ?? []).map((e) => e.response_id)),
    form: form
      ? {
          is_open: form.is_open,
          deadline: form.deadline,
          mode: form.mode,
          max_companions: form.max_companions,
          fields: normalizeFields(form.fields),
          questions: normalizeQuestions(form.custom_questions),
        }
      : null,
    stats: {
      responses: rows.length,
      attending: attendingRows.length,
      declined: rows.length - attendingRows.length,
      companions,
      people: attendingRows.length + companions,
      childMenus: attendingRows.reduce((n, r) => n + r.child_menus, 0),
      withDietary: attendingRows.filter((r) => r.dietary).length,
    },
    byEvent: countByEvent(rows, events.map((e) => e.id)),
  };
}

/** Lignes du tableau d'export (Excel / CSV). */
export function exportRows(o: RsvpOverview, includeDietary: boolean): Array<Array<string | number>> {
  const q = o.form?.questions ?? [];
  const guestName = new Map(o.guests.map((g) => [g.id, g.display_name]));
  const header = [
    "Date de réponse",
    "Prénom",
    "Nom",
    "Présence",
    "Personnes",
    "Accompagnants",
    ...o.events.map((e) => e.title),
    "Menus enfant",
    ...(includeDietary ? ["Régime / allergies"] : []),
    ...q.map((x) => x.label),
    "Message",
    ...(o.guests.length ? ["Invité (code)"] : []),
    "Corrigée",
  ];
  const rows = o.responses.map((r) => [
    new Date(r.submitted_at).toLocaleString("fr-FR", { timeZone: "Europe/Paris" }),
    r.first_name,
    r.last_name,
    r.attending ? "Oui" : "Non",
    r.attending ? 1 + r.companions_count : 0,
    r.companions.join(", "),
    ...o.events.map((e) => (r.attending && r.events.includes(e.id) ? "Oui" : "")),
    r.child_menus || "",
    ...(includeDietary ? [r.dietary ?? ""] : []),
    ...q.map((x) => r.answers[x.id] ?? ""),
    r.comment ?? "",
    ...(o.guests.length ? [r.guest_id ? guestName.get(r.guest_id) ?? "" : ""] : []),
    o.editedIds.has(r.id) ? "Oui" : "",
  ]);
  return [header, ...rows];
}
