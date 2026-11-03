import { z } from "zod";
import { LANGUAGES } from "@/lib/invitation/schema";

/**
 * Formulaire de demande de personnalisation.
 * Le même schéma valide chaque étape dans le navigateur ET la soumission
 * complète côté serveur (seule cette dernière fait foi).
 */

const t = (max: number) => z.string().trim().max(max, `${max} caractères maximum`);
const opt = (max: number) => t(max).optional().default("");
const time = z
  .string()
  .trim()
  .regex(/^(\d{2}:\d{2})?$/, "Heure au format HH:MM")
  .optional()
  .default("");
const url = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || /^https?:\/\//.test(v), "Le lien doit commencer par https://")
  .optional()
  .default("");

export const CEREMONY_TYPES = ["civil", "secular", "religious", "other"] as const;
export const CEREMONY_LABELS: Record<(typeof CEREMONY_TYPES)[number], string> = {
  civil: "Cérémonie civile",
  secular: "Cérémonie laïque",
  religious: "Cérémonie religieuse",
  other: "Autre cérémonie",
};

export const COUNTRIES = [
  "France",
  "Belgique",
  "Suisse",
  "Luxembourg",
  "Monaco",
  "Canada",
  "Maroc",
  "Algérie",
  "Tunisie",
  "Royaume-Uni",
  "Espagne",
  "Italie",
  "Allemagne",
  "Pays-Bas",
  "Autriche",
  "Émirats arabes unis",
  "Arabie saoudite",
  "Qatar",
  "États-Unis",
  "Autre",
] as const;

export const contactStep = z.object({
  firstName: t(60).min(1, "Indiquez votre prénom"),
  lastName: t(60).min(1, "Indiquez votre nom"),
  email: z.string().trim().toLowerCase().email("Adresse e-mail invalide").max(200),
  phone: z
    .string()
    .trim()
    .max(30)
    .refine((v) => v === "" || /^[+\d][\d\s().-]{5,}$/.test(v), "Numéro de téléphone invalide")
    .optional()
    .default(""),
  country: t(60).min(1, "Indiquez votre pays"),
  language: z.enum(LANGUAGES, { message: "Choisissez une langue" }),
});

export const coupleStep = z.object({
  partnerOne: t(60).min(1, "Indiquez le premier prénom"),
  partnerTwo: t(60).min(1, "Indiquez le second prénom"),
  eventDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Indiquez la date de l'événement")
    .refine((v) => new Date(`${v}T23:59:59`) >= new Date(Date.now() - 86_400_000), "La date doit être à venir"),
  introText: opt(800),
});

export const ceremonySchema = z.object({
  type: z.enum(CEREMONY_TYPES),
  /** Mariage franco-maghrébin : la cérémonie peut avoir lieu un autre jour */
  date: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, "Date invalide").optional().default(""),
  label: opt(80),
  showOnInvitation: z.boolean().default(true),
  venueName: opt(120),
  address: opt(240),
  arrivalTime: time,
  startTime: time,
  notes: opt(500),
});
export type CeremonyInput = z.input<typeof ceremonySchema>;

export const ceremoniesStep = z.object({
  ceremonies: z.array(ceremonySchema).max(6, "6 cérémonies maximum"),
});

export const receptionStep = z.object({
  reception: z.object({
    venueName: opt(120),
    address: opt(240),
    arrivalTime: time,
    cocktailTime: time,
    dinnerTime: time,
    otherTimes: opt(500),
    mapsUrl: url,
    parking: opt(500),
    shuttles: opt(500),
    lodging: opt(800),
  }),
});

export const detailsStep = z.object({
  details: z.object({
    dressCode: opt(600),
    rsvpDeadline: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, "Date invalide").optional().default(""),
    program: opt(1500),
    witnesses: opt(800),
    phoneNumbers: opt(500),
    customText: opt(1500),
    preferences: opt(1000),
    photos: opt(500),
    music: opt(300),
    comments: opt(1500),
  }),
});

/* ── Mariage maghrébin ─────────────────────────────────────────────── */
const day = z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, "Date invalide").optional().default("");
/** Qui voit le moment : tous, invités du henné seulement, ou personne (privé) */
export const MOMENT_AUDIENCES = ["all", "henna", "hidden"] as const;
export type MomentAudience = (typeof MOMENT_AUDIENCES)[number];
const audience = (d: MomentAudience) => z.enum(MOMENT_AUDIENCES).default(d);

const place = {
  date: day,
  venueName: opt(120),
  address: opt(240),
  mapsUrl: url,
};

export const extraMomentSchema = z.object({
  enabled: z.boolean().default(false),
  ...place,
  time: time,
  audience: audience("all"),
  notes: opt(500),
});

export const maghrebSchema = z.object({
  /** Certains invités ne viennent qu'à la soirée (→ deux liens) */
  separateGuests: z.enum(["yes", "no", "unknown"]).default("unknown"),
  henna: z
    .object({
      enabled: z.boolean().default(true),
      ...place,
      hammamTime: time,
      hammamAudience: audience("hidden"),
      hammamPlace: opt(160),
      hennaTime: time,
      chantTime: time,
      dinnerTime: time,
      notes: opt(800),
    })
    .superRefine((h, ctx) => {
      if (h.enabled && !h.date) ctx.addIssue({ code: "custom", path: ["date"], message: "Indiquez la date du henné" });
    })
    .default({ enabled: true, date: "", venueName: "", address: "", mapsUrl: "", hammamTime: "", hammamAudience: "hidden", hammamPlace: "", hennaTime: "", chantTime: "", dinnerTime: "", notes: "" }),
  soiree: z
    .object({
      ...place,
      receptionTime: time,
      brideTime: time,
      teaTime: time,
      dinnerTime: time,
      cakeTime: time,
      endTime: time,
      notes: opt(800),
      parking: opt(500),
      shuttles: opt(500),
      lodging: opt(800),
    })
    .default({ date: "", venueName: "", address: "", mapsUrl: "", receptionTime: "", brideTime: "", teaTime: "", dinnerTime: "", cakeTime: "", endTime: "", notes: "", parking: "", shuttles: "", lodging: "" }),
  fatiha: extraMomentSchema.default({ enabled: false, date: "", venueName: "", address: "", mapsUrl: "", time: "", audience: "all", notes: "" }),
  lendemain: extraMomentSchema.default({ enabled: false, date: "", venueName: "", address: "", mapsUrl: "", time: "", audience: "henna", notes: "" }),
  others: z.array(extraMomentSchema.extend({ label: t(80).min(1, "Donnez un nom à ce moment") })).max(4).default([]),
  decoration: z
    .object({
      known: z.enum(["yes", "no", "later"]).default("later"),
      colors: opt(300),
      theme: opt(600),
    })
    .default({ known: "later", colors: "", theme: "" }),
});
export type MaghrebInput = z.input<typeof maghrebSchema>;
export type MaghrebData = z.output<typeof maghrebSchema>;

export const hennaStep = z.object({ maghreb: maghrebSchema.pick({ separateGuests: true, henna: true }) });
export const soireeStep = z.object({ maghreb: maghrebSchema.pick({ soiree: true }) });
export const momentsStep = z.object({ maghreb: maghrebSchema.pick({ fatiha: true, lendemain: true, others: true }) });
export const maghrebDetailsStep = z.object({
  maghreb: maghrebSchema.pick({ decoration: true }),
  details: detailsStep.shape.details,
});

/** Types de mariage : français / européen, maghrébin, franco-maghrébin (mélange des deux) */
export const CULTURES = ["europeen", "maghrebin", "mixte"] as const;
export type Culture = (typeof CULTURES)[number];
export const isCulture = (v: unknown): v is Culture => typeof v === "string" && (CULTURES as readonly string[]).includes(v);
/** Types proposés par un modèle, dans l'ordre européen → maghrébin → mixte (au moins un). */
export function normalizeCultures(v: unknown): Culture[] {
  const list = Array.isArray(v) ? v.filter(isCulture) : [];
  const out = CULTURES.filter((c) => list.includes(c));
  return out.length ? out : ["europeen"];
}
/** Le formulaire comporte les étapes du henné et de la soirée */
export const hasMaghrebSteps = (c: Culture) => c === "maghrebin" || c === "mixte";

export const reviewStep = z.object({
  consent: z.literal(true, { message: "Votre accord est nécessaire pour envoyer la demande" }),
  /** Champ piège invisible : doit rester vide (anti-robots) */
  website: z.string().max(0).optional().default(""),
});

export const requestSchema = z.object({
  ...contactStep.shape,
  ...coupleStep.shape,
  ...ceremoniesStep.shape,
  ...receptionStep.shape,
  ...detailsStep.shape,
  ...reviewStep.shape,
  templateSlug: z.string().trim().max(80),
  culture: z.enum(CULTURES).default("europeen"),
  maghreb: maghrebSchema.optional(),
});

export type RequestInput = z.input<typeof requestSchema>;
export type RequestData = z.output<typeof requestSchema>;

export const STEP_SCHEMAS = [contactStep, coupleStep, ceremoniesStep, receptionStep, detailsStep, reviewStep] as const;
/** Formulaire maghrébin : coordonnées, couple, henné, soirée, autres moments, décoration et détails, vérification */
export const MAGHREB_STEP_SCHEMAS = [contactStep, coupleStep, hennaStep, soireeStep, momentsStep, maghrebDetailsStep, reviewStep] as const;
/** Franco-maghrébin : les cérémonies (mairie, religieuse…) puis tout le parcours maghrébin */
export const MIXTE_STEP_SCHEMAS = [contactStep, coupleStep, ceremoniesStep, hennaStep, soireeStep, momentsStep, maghrebDetailsStep, reviewStep] as const;

export const STEP_TITLES = [
  "Vos coordonnées",
  "Le couple",
  "Cérémonies",
  "Réception",
  "Autres informations",
  "Vérification",
] as const;

/** Message d'erreur (en français dans le schéma) → clé du dictionnaire du site */
const ERROR_KEYS: Record<string, string> = {
  "Heure au format HH:MM": "time",
  "Le lien doit commencer par https://": "https",
  "Indiquez votre prénom": "firstName",
  "Indiquez votre nom": "lastName",
  "Adresse e-mail invalide": "email",
  "Numéro de téléphone invalide": "phone",
  "Indiquez votre pays": "country",
  "Choisissez une langue": "language",
  "Indiquez le premier prénom": "partnerOne",
  "Indiquez le second prénom": "partnerTwo",
  "Indiquez la date de l'événement": "eventDate",
  "La date doit être à venir": "futureDate",
  "6 cérémonies maximum": "maxCeremonies",
  "Date invalide": "date",
  "Votre accord est nécessaire pour envoyer la demande": "consent",
  "Donnez un nom à ce moment": "momentName",
  "Indiquez la date du henné": "hennaDate",
};

/** Traduit un message d'erreur du formulaire dans la langue du visiteur. */
export function translateError(message: string, errors: Record<string, string>): string {
  const max = /^(\d+) caractères maximum$/.exec(message);
  if (max) return (errors.maxChars ?? message).replace("{n}", max[1]);
  const key = ERROR_KEYS[message];
  return (key && errors[key]) || message;
}

/** Transforme les erreurs Zod en { "chemin.du.champ": "message" } */
export function flattenErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
