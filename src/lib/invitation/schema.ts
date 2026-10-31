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

/**
 * Adresse d'image, de vidéo ou de musique acceptée : https, chemin du site,
 * ou (en développement seulement) le stockage local http://127.0.0.1.
 */
export function isAllowedAssetUrl(v: string): boolean {
  if (v === "") return true;
  if (v.startsWith("/") && !v.startsWith("//")) return true;
  if (/^https:\/\/[^\s"'<>]+$/.test(v)) return true;
  return process.env.NODE_ENV !== "production" && /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(v);
}

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
  "text",
  "decor",
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
  text: "Texte libre",
  decor: "Bande décorative",
};

/** Sections qu'on peut ajouter plusieurs fois (les autres sont uniques). */
export const REPEATABLE_SECTIONS: SectionType[] = ["text", "decor"];

/** Sections fonctionnelles : logique verrouillée, seuls les libellés changent. */
export const FUNCTIONAL_SECTIONS: SectionType[] = ["countdown", "rsvp"];

/* ── Calques (décors et textes libres posés sur une section) ───────── */
export const ENTER_ANIMATIONS = ["none", "fade", "rise", "zoom", "slide-left", "slide-right", "draw"] as const;
export type EnterAnimation = (typeof ENTER_ANIMATIONS)[number];
export const ENTER_ANIMATION_LABELS: Record<EnterAnimation, string> = {
  none: "Aucune",
  fade: "Fondu",
  rise: "Montée douce",
  zoom: "Zoom",
  "slide-left": "Glissement depuis la gauche",
  "slide-right": "Glissement depuis la droite",
  draw: "Éclosion (fleurs)",
};
export const LOOP_ANIMATIONS = ["none", "sway", "float", "breathe"] as const;
export type LoopAnimation = (typeof LOOP_ANIMATIONS)[number];
export const LOOP_ANIMATION_LABELS: Record<LoopAnimation, string> = {
  none: "Aucun",
  sway: "Balancement (fleur au vent)",
  float: "Flottement",
  breathe: "Respiration",
};

const num = (min: number, max: number, def: number) => z.number().finite().min(min).max(max).default(def);

export const layerSchema = z.object({
  id: z.string().min(1).max(40),
  kind: z.enum(["image", "text"]),
  name: optionalText(60),
  /** Image : adresse du fichier (bibliothèque de médias) */
  src: safeUrl,
  /** Texte libre (jamais du HTML) */
  text: optionalText(240),
  font: z.enum(["display", "script", "body"]).default("script"),
  /** Taille du texte en % de la largeur de l'invitation */
  fontSize: num(2, 30, 9),
  /** Texte : couleur (vide = couleur d'accent du thème). Image : teinte de la silhouette (vide = couleurs d'origine). */
  color: hexColor.or(z.literal("")).default(""),
  /** Centre du calque, en % de la largeur et de la hauteur de la section */
  x: num(-60, 160, 50),
  y: num(-60, 160, 50),
  /** Largeur en % de la largeur de l'invitation */
  width: num(2, 220, 40),
  rotation: num(-180, 180, 0),
  opacity: num(0, 1, 1),
  flip: z.boolean().default(false),
  placement: z.enum(["behind", "front"]).default("behind"),
  locked: z.boolean().default(false),
  hidden: z.boolean().default(false),
  enter: z
    .object({
      type: z.enum(ENTER_ANIMATIONS).default("fade"),
      delay: num(0, 6000, 0),
      duration: num(200, 6000, 1400),
    })
    .default({ type: "fade", delay: 0, duration: 1400 }),
  loop: z.enum(LOOP_ANIMATIONS).default("none"),
});
export type InvitationLayer = z.infer<typeof layerSchema>;

export const sectionSchema = z.object({
  id: z.string().min(1).max(40),
  type: z.enum(SECTION_TYPES),
  visible: z.boolean().default(true),
  title: optionalText(80),
  /** Section « texte libre » */
  body: optionalText(2000),
  /** Section « bande décorative » : hauteur en % de la largeur */
  height: num(10, 250, 60),
  /** Animation d'apparition du contenu ("inherit" = réglage du thème) */
  animation: z.enum(["inherit", ...ENTER_ANIMATIONS]).default("inherit"),
  layers: z.array(layerSchema).max(40).default([]),
});
export type InvitationSection = z.infer<typeof sectionSchema>;

const shortId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

export function newSection(type: SectionType): InvitationSection {
  return { id: shortId(`s-${type}`), type, visible: true, title: "", body: "", height: 60, animation: "inherit", layers: [] };
}

export function newLayer(kind: InvitationLayer["kind"], patch: Partial<InvitationLayer> = {}): InvitationLayer {
  return {
    id: shortId("l"),
    kind,
    name: "",
    src: "",
    text: kind === "text" ? "Save the date" : "",
    font: "script",
    fontSize: 9,
    color: "",
    x: 50,
    y: 50,
    width: kind === "text" ? 70 : 40,
    rotation: 0,
    opacity: 1,
    flip: false,
    placement: kind === "text" ? "front" : "behind",
    locked: false,
    hidden: false,
    enter: { type: "fade", delay: 0, duration: 1400 },
    loop: "none",
    ...patch,
  };
}

/** Copie d'une section (nouveaux identifiants pour elle et ses calques). */
export function cloneSection(s: InvitationSection): InvitationSection {
  return { ...structuredClone(s), id: shortId(`s-${s.type}`), layers: s.layers.map((l) => ({ ...structuredClone(l), id: shortId("l") })) };
}

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
