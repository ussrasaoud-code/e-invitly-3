import { z } from "zod";

/**
 * Configuration et validation des réponses RSVP.
 * Partagé entre le navigateur (affichage, vérifications immédiates) et le
 * serveur (validation qui fait foi).
 */

export const RSVP_FIELD_KEYS = ["lastName", "companions", "companionNames", "events", "dietary", "childMenus", "comment"] as const;
export type RsvpFieldKey = (typeof RSVP_FIELD_KEYS)[number];
export type RsvpFields = Record<RsvpFieldKey, boolean>;

export const RSVP_FIELD_LABELS: Record<RsvpFieldKey, string> = {
  lastName: "Nom de famille",
  companions: "Nombre d'accompagnants",
  companionNames: "Prénoms des accompagnants",
  events: "Présence à chaque moment (cérémonie, dîner…)",
  dietary: "Régime alimentaire / allergies",
  childMenus: "Menus enfant",
  comment: "Message libre",
};

export const DEFAULT_RSVP_FIELDS: RsvpFields = {
  lastName: true,
  companions: true,
  companionNames: true,
  events: true,
  dietary: false,
  childMenus: false,
  comment: true,
};

export const customQuestionSchema = z.object({
  id: z.string().min(1).max(20),
  label: z.string().trim().min(1).max(160),
  type: z.enum(["text", "yesno", "choice"]),
  options: z.array(z.string().trim().min(1).max(60)).max(8).default([]),
  required: z.boolean().default(false),
});
export type CustomQuestion = z.infer<typeof customQuestionSchema>;

export const CUSTOM_QUESTION_TYPES: Record<CustomQuestion["type"], string> = {
  text: "Réponse libre",
  yesno: "Oui / Non",
  choice: "Choix dans une liste",
};

/** Ce que la page publique a besoin de savoir (jamais les codes des invités). */
export type PublicRsvpConfig = {
  open: boolean;
  closedReason: "closed" | "deadline" | null;
  deadline: string | null; // ISO
  mode: "open" | "code";
  maxCompanions: number;
  fields: RsvpFields;
  questions: CustomQuestion[];
};

export function normalizeFields(raw: unknown): RsvpFields {
  const src = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  // ancien nom « menu » des premières versions
  if (src.menu !== undefined && src.childMenus === undefined) src.childMenus = src.menu;
  return Object.fromEntries(
    RSVP_FIELD_KEYS.map((k) => [k, typeof src[k] === "boolean" ? (src[k] as boolean) : DEFAULT_RSVP_FIELDS[k]]),
  ) as RsvpFields;
}

export function normalizeQuestions(raw: unknown): CustomQuestion[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((q) => {
    const p = customQuestionSchema.safeParse(q);
    return p.success ? [p.data] : [];
  });
}

/* ── Réponse envoyée par un invité ─────────────────────────────────── */

const text = (max: number) => z.string().trim().max(max);

export const rsvpSubmissionSchema = z.object({
  slug: z.string().max(80),
  idempotencyKey: z.string().uuid(),
  website: z.string().max(0).optional().default(""), // champ piège
  code: text(20).optional().default(""),
  firstName: text(60).min(1, "required"),
  lastName: text(60).optional().default(""),
  attending: z.boolean({ message: "required" }),
  companionsCount: z.coerce.number().int().min(0).max(20).default(0),
  companionNames: z.array(text(60)).max(20).default([]),
  events: z.array(z.string().max(40)).max(12).default([]),
  dietary: text(300).optional().default(""),
  childMenus: z.coerce.number().int().min(0).max(21).default(0),
  comment: text(1000).optional().default(""),
  answers: z.record(z.string().max(20), text(300)).default({}),
});
export type RsvpSubmission = z.input<typeof rsvpSubmissionSchema>;

export type RsvpResult =
  | { ok: true; updated: boolean }
  | { ok: false; error: "closed" | "deadline" | "code" | "invalid" | "rate" | "unavailable" | "server"; fields?: string[] };

/** Nettoie une réponse selon la configuration (champs désactivés ignorés, refus = 0 accompagnant). */
export function sanitizeSubmission(
  data: z.output<typeof rsvpSubmissionSchema>,
  cfg: { fields: RsvpFields; maxCompanions: number; questions: CustomQuestion[]; eventIds: string[] },
): { value: Omit<z.output<typeof rsvpSubmissionSchema>, "slug" | "idempotencyKey" | "website" | "code">; missing: string[] } {
  const f = cfg.fields;
  const attending = data.attending;
  const companionsCount = attending && f.companions ? Math.min(data.companionsCount, cfg.maxCompanions) : 0;
  const missing: string[] = [];
  if (!data.firstName) missing.push("firstName");
  if (f.lastName && !data.lastName) missing.push("lastName");
  const answers: Record<string, string> = {};
  for (const q of cfg.questions) {
    let v = (data.answers[q.id] ?? "").trim();
    if (q.type === "yesno" && v && !["oui", "non"].includes(v)) v = "";
    if (q.type === "choice" && v && !q.options.includes(v)) v = "";
    if (v) answers[q.id] = v;
    else if (q.required && attending) missing.push(`q:${q.id}`);
  }
  return {
    missing,
    value: {
      firstName: data.firstName,
      lastName: f.lastName ? data.lastName : "",
      attending,
      companionsCount,
      companionNames: attending && f.companionNames ? data.companionNames.filter(Boolean).slice(0, companionsCount) : [],
      events: attending && f.events ? data.events.filter((e) => cfg.eventIds.includes(e)) : [],
      dietary: attending && f.dietary ? data.dietary : "",
      childMenus: attending && f.childMenus ? Math.min(data.childMenus, companionsCount + 1) : 0,
      comment: f.comment ? data.comment : "",
      answers,
    },
  };
}

/** Personnes présentes par moment (une réponse « oui » = 1 + accompagnants). */
export function countByEvent(
  responses: Array<{ attending: boolean; companions_count: number; events: unknown }>,
  eventIds: string[],
): Record<string, number> {
  const out: Record<string, number> = Object.fromEntries(eventIds.map((id) => [id, 0]));
  for (const r of responses) {
    if (!r.attending) continue;
    const ev = Array.isArray(r.events) ? (r.events as string[]) : [];
    for (const id of ev) if (id in out) out[id] += 1 + r.companions_count;
  }
  return out;
}
