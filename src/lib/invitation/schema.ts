import { isAllowedAssetUrl } from "@/lib/url";
import { z } from "zod";

/**
 * Contrat de données commun à TOUS les modèles d'invitation.
 *
 * - Les champs dynamiques (prénoms, dates, lieux…) sont des valeurs typées :
 *   le moteur de rendu les met en page, on n'écrit jamais de HTML libre.
 * - Les sections fonctionnelles (RSVP, compte à rebours) n'exposent que leurs
 *   libellés : leur logique est verrouillée dans le code.
 * - Le même objet sert pour la démo d'un modèle, le brouillon et chaque
 *   version publiée d'une invitation.
 */

export const LANGUAGES = ["fr", "en", "ar"] as const;
export type Language = (typeof LANGUAGES)[number];

const text = (max = 400) => z.string().trim().max(max);
const optionalText = (max = 400) => text(max).optional().default("");
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Couleur hexadécimale attendue (#RRGGBB)");
const safeUrl = z
  .string()
  .trim()
  .max(1000)
  .refine(isAllowedAssetUrl, "Lien https:// attendu")
  .optional()
  .default("");

export const EVENT_TYPES = [
  "civil",
  "secular",
  "religious",
  "cocktail",
  "dinner",
  "party",
  "brunch",
  "other",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  civil: "Cérémonie civile",
  secular: "Cérémonie laïque",
  religious: "Cérémonie religieuse",
  cocktail: "Cocktail",
  dinner: "Dîner",
  party: "Soirée",
  brunch: "Brunch",
  other: "Autre moment",
};

export const eventSchema = z.object({
  id: z.string().min(1).max(40),
  type: z.enum(EVENT_TYPES),
  title: text(80),
  venueName: optionalText(120),
  address: optionalText(240),
  mapsUrl: safeUrl,
  arrivalTime: optionalText(5),
  startTime: optionalText(5),
  description: optionalText(400),
});
export type InvitationEvent = z.infer<typeof eventSchema>;

export const SECTION_TYPES = [
  "hero",
  "program",
  "countdown",
  "dresscode",
  "venues",
  "rsvp",
  "contacts",
  "closing",
] as const;
export type SectionType = (typeof SECTION_TYPES)[number];

export const SECTION_LABELS: Record<SectionType, string> = {
  hero: "Invitation principale",
  program: "Programme",
  countdown: "Compte à rebours",
  dresscode: "Dress code",
  venues: "Lieux et transports",
  rsvp: "RSVP",
  contacts: "Contacts",
  closing: "Message final",
};

/** Sections fonctionnelles : logique verrouillée, seuls les libellés changent. */
export const FUNCTIONAL_SECTIONS: SectionType[] = ["countdown", "rsvp"];

export const sectionSchema = z.object({
  id: z.string().min(1).max(40),
  type: z.enum(SECTION_TYPES),
  visible: z.boolean().default(true),
  title: optionalText(80),
});
export type InvitationSection = z.infer<typeof sectionSchema>;

export const FONT_KEYS = ["aboreto", "dancing", "jost", "cormorant", "amiri"] as const;
export type FontKey = (typeof FONT_KEYS)[number];

export const themeSchema = z.object({
  colors: z.object({
    background: hexColor,
    surface: hexColor,
    ink: hexColor,
    muted: hexColor,
    accent: hexColor,
    accentSoft: hexColor,
  }),
  fonts: z.object({
    display: z.enum(FONT_KEYS),
    script: z.enum(FONT_KEYS),
    body: z.enum(FONT_KEYS),
  }),
  ornament: z.enum(["garden", "province", "none"]).default("none"),
  animation: z.enum(["soft", "none"]).default("soft"),
});
export type InvitationTheme = z.infer<typeof themeSchema>;

export const invitationContentSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  language: z.enum(LANGUAGES).default("fr"),
  couple: z.object({
    partnerOne: text(60),
    partnerTwo: text(60),
    photoUrl: safeUrl,
  }),
  kicker: optionalText(120),
  intro: optionalText(600),
  /** Date et heure LOCALES de l'événement, au format AAAA-MM-JJTHH:MM */
  eventAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Format attendu : AAAA-MM-JJTHH:MM")
    .or(z.literal("")),
  timezone: z.string().min(1).max(60).default("Europe/Paris"),
  mainVenue: z.object({ name: optionalText(120), city: optionalText(120) }),
  events: z.array(eventSchema).max(12),
  dressCode: z.object({
    text: optionalText(600),
    palette: z.array(hexColor).max(8).default([]),
  }),
  practical: z.object({
    parking: optionalText(400),
    shuttles: optionalText(400),
    transport: optionalText(400),
    lodging: optionalText(600),
  }),
  contacts: z
    .array(z.object({ name: text(80), role: optionalText(80), phone: optionalText(30) }))
    .max(8),
  rsvp: z.object({
    deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")).default(""),
    intro: optionalText(400),
  }),
  closing: z.object({ title: optionalText(120), text: optionalText(600) }),
  sections: z.array(sectionSchema).min(1).max(20),
  theme: themeSchema,
  envelope: z.object({
    mode: z.enum(["animation", "video", "none"]).default("animation"),
    videoUrl: safeUrl,
    posterUrl: safeUrl,
    sealText: optionalText(6),
    autoStart: z.boolean().default(false),
  }),
  music: z.object({ enabled: z.boolean().default(false), url: safeUrl }),
});

export type InvitationContent = z.infer<typeof invitationContentSchema>;
export type InvitationContentInput = z.input<typeof invitationContentSchema>;

/** Définition d'un modèle stockée dans template_versions.definition */
export const templateDefinitionSchema = z.object({
  renderer: z.enum(["the-garden", "province"]),
  sample: invitationContentSchema,
});
export type TemplateDefinition = z.infer<typeof templateDefinitionSchema>;

export const RENDERERS = ["the-garden", "province"] as const;
export type RendererKey = (typeof RENDERERS)[number];
