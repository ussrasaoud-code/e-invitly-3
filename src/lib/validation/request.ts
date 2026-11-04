import { z } from "zod";
import { rsvpChoicesSchema } from "@/lib/rsvp";
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
  /** Deuxième langue de l'invitation (incluse), vide = une seule langue */
  secondLanguage: z.enum(LANGUAGES).or(z.literal("")).optional().default(""),
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
  label: opt(80),
  showOnInvitation: z.boolean().default(true),
  /** Seulement une partie des invités (ils recevront un lien privé) */
  restricted: z.boolean().default(false),
  /** Nom de ce groupe d'invités, ex. « Famille proche » */
  guestGroup: opt(60),
  venueName: opt(120),
  address: opt(240),
  /** Jour de la cérémonie, s'il diffère de la date principale (vide = même jour) */
  date: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, "Date invalide").optional().default(""),
  arrivalTime: time,
  startTime: time,
  notes: opt(500),
});
export type CeremonyInput = z.input<typeof ceremonySchema>;

export const ceremoniesStep = z.object({
  ceremonies: z.array(ceremonySchema).max(6, "6 cérémonies maximum"),
});

export const MOMENT_KINDS = ["cocktail", "dinner", "cake", "party", "other"] as const;
export const momentSchema = z.object({
  kind: z.enum(MOMENT_KINDS),
  title: opt(60),
  time,
  /** Petit mot affiché sous le moment, ex. « Rafraîchissements et musique live » */
  note: opt(160),
});
export type MomentInput = z.input<typeof momentSchema>;

export const receptionStep = z.object({
  reception: z.object({
    venueName: opt(120),
    address: opt(240),
    /** Jour de la réception s'il diffère de la date principale */
    date: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, "Date invalide").optional().default(""),
    arrivalTime: time,
    /** Déroulé construit par les mariés (dans l'ordre choisi) */
    moments: z.array(momentSchema).max(10).optional().default([]),
    endTime: time.optional().default(""),
    // Anciennes demandes (avant le déroulé libre)
    cocktailTime: time.optional().default(""),
    dinnerTime: time.optional().default(""),
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
    /** Ce que le formulaire de réponse demande aux invités (choisi par les mariés) */
    rsvp: rsvpChoicesSchema.optional(),
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
});

export type RequestInput = z.input<typeof requestSchema>;
export type RequestData = z.output<typeof requestSchema>;

export const STEP_SCHEMAS = [contactStep, coupleStep, ceremoniesStep, receptionStep, detailsStep, reviewStep] as const;

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
