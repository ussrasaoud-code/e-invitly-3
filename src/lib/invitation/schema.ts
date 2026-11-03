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

export const LANGUAGES = ["fr", "en", "ar", "es", "it", "de", "nl"] as const;
export type Language = (typeof LANGUAGES)[number];
/** Libellés français des langues (administration) */
export const LANGUAGE_LABELS: Record<Language, string> = {
  fr: "Français",
  en: "Anglais",
  ar: "Arabe (de droite à gauche)",
  es: "Espagnol",
  it: "Italien",
  de: "Allemand",
  nl: "Néerlandais",
};

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

/** Adresse insérée dans un url("…") CSS : ni guillemets, ni parenthèses, ni barre oblique inverse. */
export function isCssSafeUrl(v: string): boolean {
  return isAllowedAssetUrl(v) && !/["'()\\\s]/.test(v);
}

const text = (max = 400) => z.string().trim().max(max);
const optionalText = (max = 400) => text(max).optional().default("");
export const FONT_KEYS = ["aboreto", "dancing", "jost", "cormorant", "amiri", "playfair", "italiana", "lora", "montserrat", "greatvibes", "pinyon", "parisienne"] as const;
export type FontKey = (typeof FONT_KEYS)[number];
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Couleur hexadécimale attendue (#RRGGBB)");
const safeUrl = z
  .string()
  .trim()
  .max(1000)
  .refine(isAllowedAssetUrl, "Lien https:// attendu")
  .optional()
  .default("");
const cssUrl = z.string().trim().max(1000).refine(isCssSafeUrl, "Adresse d'image invalide").optional().default("");

export const EVENT_TYPES = [
  "civil",
  "secular",
  "religious",
  "cocktail",
  "dinner",
  "party",
  "brunch",
  "other",
  // Mariage maghrébin
  "hammam",
  "henna",
  "fatiha",
  "reception",
  "bride",
  "tea",
  "cake",
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
  hammam: "Hammam de la mariée",
  henna: "Henné",
  fatiha: "Fatiha",
  reception: "Accueil des invités",
  bride: "Entrée de la mariée",
  tea: "Goûter",
  cake: "Pièce montée",
};

/**
 * Groupe d'invités (ex. « Famille proche ») : les moments qui lui sont réservés ne
 * s'affichent qu'avec son lien privé ; le lien principal montre les moments ouverts à tous.
 */
export const guestGroupSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,40}$/),
  name: z.string().trim().min(1).max(60),
});
export type GuestGroup = z.infer<typeof guestGroupSchema>;

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
  /** Jour du moment s'il diffère de la date principale (mariage sur plusieurs jours) */
  date: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, "Date au format AAAA-MM-JJ").optional().default(""),
  /** Groupes d'invités qui voient ce moment (vide = tous les invités) */
  groups: z.array(z.string().max(40)).max(8).default([]),
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
  "program2",
  "scratch",
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
  program2: "Programme v2 (frise fleurie)",
  scratch: "Date à gratter",
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
/** Mouvements liés au défilement de l'écran */
export const SCROLL_MOTIONS = ["none", "move", "parallax", "rotate", "fade", "zoom", "part"] as const;
export type ScrollMotion = (typeof SCROLL_MOTIONS)[number];
export const SCROLL_MOTION_LABELS: Record<ScrollMotion, string> = {
  none: "Aucun",
  move: "Suit le défilement (glisse)",
  parallax: "Parallaxe (profondeur)",
  rotate: "Tourne en défilant",
  fade: "Apparaît en défilant",
  zoom: "Grandit en défilant",
  part: "S'écarte comme un rideau (nuages)",
};

/** Tiges de la frise du programme v2 (public/decor/tiges/<clé>.svg) */
export const STEM_STYLES = ["feuilles", "coeurs", "saule", "eucalyptus", "vrille", "brindille", "pointilles"] as const;
export type StemStyle = (typeof STEM_STYLES)[number];
export const STEM_LABELS: Record<StemStyle, string> = {
  feuilles: "Feuillage",
  coeurs: "Cœurs",
  saule: "Saule",
  eucalyptus: "Eucalyptus",
  vrille: "Vrilles",
  brindille: "Brindille",
  pointilles: "Ligne et points",
};

export const SHAPE_TYPES = ["rect", "rounded", "circle", "arch", "double", "line", "diamond", "heart", "leafdivider", "diamonddivider"] as const;
export type ShapeType = (typeof SHAPE_TYPES)[number];
export const SHAPE_LABELS: Record<ShapeType, string> = {
  rect: "Rectangle / cadre",
  rounded: "Rectangle arrondi",
  circle: "Cercle / ovale",
  arch: "Arche",
  double: "Double cadre",
  line: "Ligne",
  diamond: "Losange",
  heart: "Cœur",
  leafdivider: "Séparateur feuillage",
  diamonddivider: "Séparateur losange",
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
  kind: z.enum(["image", "text", "shape"]),
  // Nom interne du calque (souvent le nom du fichier importé) : raccourci plutôt que refusé
  name: z.preprocess((v) => (typeof v === "string" ? v.trim().slice(0, 60) : v), optionalText(60)),
  /** Image : adresse du fichier (bibliothèque de médias) */
  src: cssUrl,
  /** Texte libre (jamais du HTML) */
  text: optionalText(240),
  /** display / script / body = polices du thème ; sinon une police précise */
  font: z.enum(["display", "script", "body", ...FONT_KEYS]).default("script"),
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
  /** Calques groupés : même identifiant de groupe, déplacés ensemble */
  group: z.string().max(40).default(""),
  bold: z.boolean().default(false),
  italic: z.boolean().default(false),
  align: z.enum(["left", "center", "right"]).default("center"),
  /** Mouvement au défilement : dx en % de la largeur, dy en % de la hauteur de la section, amount = degrés ou % de départ */
  scroll: z
    .object({ type: z.enum(SCROLL_MOTIONS).default("none"), dx: num(-100, 100, 0), dy: num(-300, 300, 60), amount: num(-720, 720, 0) })
    .default({ type: "none", dx: 0, dy: 60, amount: 0 }),
  /* ── Formes (cadres, rectangles, cercles…) ── */
  shape: z.enum(SHAPE_TYPES).default("rect"),
  /** Hauteur de la forme = largeur × ratio */
  ratio: num(0.01, 4, 1),
  /** Arrondi des angles (rectangle arrondi), en % du petit côté */
  radius: num(0, 50, 10),
  /** Remplissage (vide = aucun) */
  fill: hexColor.or(z.literal("")).default(""),
  fillOpacity: num(0, 1, 1),
  /** Contour (vide = couleur d'accent du thème) ; épaisseur en pixels, 0 = aucun */
  stroke: hexColor.or(z.literal("")).default(""),
  strokeWidth: num(0, 12, 1),
  dash: z.enum(["solid", "dashed", "dotted"]).default("solid"),
});
export type InvitationLayer = z.infer<typeof layerSchema>;

/** Réglages d'un élément intégré au modèle (titre, prénoms, ornement…) */
export const elementStyleSchema = z.object({
  hidden: z.boolean().default(false),
  /** Décalage en % de la largeur de l'invitation */
  dx: num(-100, 100, 0),
  dy: num(-300, 300, 0),
  scale: num(0.3, 3, 1),
  rotation: num(-180, 180, 0),
  opacity: num(0, 1, 1),
  /** Couleur imposée à tout l'élément (vide = couleurs du thème) */
  color: hexColor.or(z.literal("")).default(""),
  /** Police imposée (vide = polices du thème) */
  font: z.enum(["", ...FONT_KEYS]).default(""),
  /** Texte remplaçant un libellé fixe (ex. « & » → « et ») */
  text: optionalText(80),
  /** Groupe dégroupé : ses parties se sélectionnent une à une */
  ungrouped: z.boolean().default(false),
  /** Taille du texte (×), qui fait aussi suivre la mise en page */
  zoom: num(0.3, 4, 1),
  /** "" = comme le modèle */
  weight: z.enum(["", "normal", "bold"]).default(""),
  style: z.enum(["", "normal", "italic"]).default(""),
  align: z.enum(["", "left", "center", "right"]).default(""),
  enter: z
    .object({ type: z.enum(ENTER_ANIMATIONS).default("none"), delay: num(0, 6000, 0), duration: num(200, 6000, 1200) })
    .default({ type: "none", delay: 0, duration: 1200 }),
  loop: z.enum(LOOP_ANIMATIONS).default("none"),
});
export type ElementStyle = z.infer<typeof elementStyleSchema>;

export const DEFAULT_SECTION_BACKGROUND = { color: "", image: "", fit: "cover" as const, opacity: 1 };
export const sectionBackgroundSchema = z
  .object({
    color: hexColor.or(z.literal("")).default(""),
    /** Image ou texture de fond (bibliothèque de médias) */
    image: cssUrl,
    fit: z.enum(["cover", "contain", "repeat"]).default("cover"),
    opacity: num(0, 1, 1),
  })
  .default(DEFAULT_SECTION_BACKGROUND);

export const DEFAULT_VENUE_OPTIONS = { calendar: true, buttonBg: "", buttonInk: "", detail: "" };

export const sectionSchema = z.object({
  id: z.string().min(1).max(40),
  type: z.enum(SECTION_TYPES),
  visible: z.boolean().default(true),
  title: optionalText(80),
  /** Section « texte libre » */
  body: optionalText(2000),
  /** Espace ajouté (ou retiré) en haut et en bas, en % de la largeur */
  spaceTop: num(-30, 300, 0),
  spaceBottom: num(-30, 300, 0),
  /** Section « bande décorative » : hauteur en % de la largeur */
  height: num(10, 250, 60),
  /** Programme v2 : surtitre, moments propres à la section, fleur qui suit le défilement */
  kicker: optionalText(120),
  items: z
    .array(z.object({ id: z.string().min(1).max(40), time: optionalText(12), title: optionalText(80), detail: optionalText(200) }))
    .max(20)
    .default([]),
  /** Programme v2 : « events » = reprend automatiquement le programme de l'invitation ; « custom » = moments saisis ici */
  itemsFrom: z.enum(["events", "custom"]).default("events"),
  marker: cssUrl,
  stem: z.enum(STEM_STYLES).default("feuilles"),
  /** Date à gratter : couleur de la pellicule (vide = couleur du thème) */
  coverColor: hexColor.or(z.literal("")).default(""),
  /** Lieux et accès : bouton « Calendrier » et couleurs (vide = couleurs du thème) */
  venueOptions: z
    .object({
      calendar: z.boolean().default(true),
      buttonBg: hexColor.or(z.literal("")).default(""),
      buttonInk: hexColor.or(z.literal("")).default(""),
      detail: hexColor.or(z.literal("")).default(""),
    })
    .default({ calendar: true, buttonBg: "", buttonInk: "", detail: "" }),
  /** Animation d'apparition du contenu ("inherit" = réglage du thème) */
  animation: z.enum(["inherit", ...ENTER_ANIMATIONS]).default("inherit"),
  layers: z.array(layerSchema).max(40).default([]),
  /** Fond propre à la section (vide = fond du thème) */
  background: sectionBackgroundSchema,
  /** Éléments intégrés du modèle : masqués, déplacés, recolorés… (clé = identifiant de l'élément) */
  elements: z.record(z.string().regex(/^[a-z][a-z0-9.-]{0,79}$/), elementStyleSchema).default({}),
});
export type InvitationSection = z.infer<typeof sectionSchema>;

const shortId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

export function newSection(type: SectionType): InvitationSection {
  if (type === "program2") return programV2Section();
  return { id: shortId(`s-${type}`), type, visible: true, title: "", body: "", height: 60, animation: "inherit", layers: [], elements: {}, background: { ...DEFAULT_SECTION_BACKGROUND }, spaceTop: 0, spaceBottom: 0, kicker: "", items: [], itemsFrom: "events", marker: "", stem: "feuilles", venueOptions: { ...DEFAULT_VENUE_OPTIONS }, coverColor: "" };
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
    group: "",
    bold: false,
    italic: false,
    align: "center",
    scroll: { type: "none", dx: 0, dy: 60, amount: 0 },
    shape: "rect",
    ratio: 1,
    radius: 10,
    fill: "",
    fillOpacity: 1,
    stroke: "",
    strokeWidth: 1,
    dash: "solid",
    ...patch,
  };
}

/** Copie d'une section (nouveaux identifiants pour elle et ses calques). */
export function cloneSection(s: InvitationSection): InvitationSection {
  return { ...structuredClone(s), id: shortId(`s-${s.type}`), layers: s.layers.map((l) => ({ ...structuredClone(l), id: shortId("l") })) };
}


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
  /** Groupes d'invités ayant un lien privé (moments réservés) */
  guestGroups: z.array(guestGroupSchema).max(8).default([]),
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
  renderer: z.enum(["the-garden", "province", "blank"]),
  /** Version principale (sa langue = sample.language) */
  sample: invitationContentSchema,
  /** Même design dans d'autres langues : textes traduits, réglages propres à la langue */
  variants: z.partialRecord(z.enum(LANGUAGES), invitationContentSchema).default({}),
});
export type TemplateDefinition = z.infer<typeof templateDefinitionSchema>;

export const RENDERERS = ["the-garden", "province", "blank"] as const;
export type RendererKey = (typeof RENDERERS)[number];

/** Section prête à l'emploi « Programme v2 » : frise végétale, fleur qui descend au défilement, papillon. */
export function programV2Section(): InvitationSection {
  const items: Array<[string, string, string]> = [
    ["14h30", "Cérémonie civile", "Mairie d'Aix-en-Provence\nPlace de l'Hôtel-de-Ville"],
    ["16h00", "Cérémonie laïque", "Dans le jardin du domaine"],
    ["17h00", "Vin d'honneur", "Petites délices et grandes retrouvailles"],
    ["20h00", "Dîner", "Tous à table"],
    ["22h30", "Pièce montée", "Dessert & champagne"],
    ["23h30", "Soirée dansante", "Rendez-vous sur le dancefloor !"],
  ];
  return {
    id: shortId("s-program2"),
    type: "program2",
    visible: true,
    title: "Les petits moments, les grands souvenirs",
    body: "",
    height: 60,
    animation: "inherit",
    elements: {},
    background: { ...DEFAULT_SECTION_BACKGROUND },
    spaceTop: 0,
    spaceBottom: 0,
    kicker: "Le fil de notre journée",
    items: items.map(([time, title, detail], i) => ({ id: `m${i + 1}`, time, title, detail })),
    itemsFrom: "events",
    venueOptions: { ...DEFAULT_VENUE_OPTIONS },
    coverColor: "",
    marker: "/decor/rose.svg",
    stem: "feuilles",
    layers: [
      newLayer("image", { src: "/decor/papillon.svg", name: "Papillon", x: 88, y: 9, width: 11, rotation: 12, placement: "front", enter: { type: "fade", delay: 300, duration: 1600 }, loop: "float" }),
    ],
  };
}

/** Moments affichés par la section « Programme v2 » : le programme de l'invitation, ou des moments propres à la section. */
export function programV2Items(section: InvitationSection, content: InvitationContent, formatTime: (t: string) => string = (t) => t, formatDay?: (d: string) => string) {
  if (section.itemsFrom === "custom" || !content.events.length) return section.items;
  const dayOf = (e: InvitationEvent) => e.date || content.eventAt.slice(0, 10);
  const multi = !!formatDay && new Set(content.events.map(dayOf).filter(Boolean)).size > 1;
  const events = multi
    ? [...content.events].sort((a, b) => `${dayOf(a)} ${a.startTime || "99:99"}`.localeCompare(`${dayOf(b)} ${b.startTime || "99:99"}`))
    : content.events;
  return events
    .filter((e) => e.title || e.startTime)
    .map((e) => ({
      id: e.id,
      time: e.startTime ? formatTime(e.startTime) : "",
      title: e.title,
      detail: [multi && formatDay ? formatDay(dayOf(e)) : "", e.venueName, e.description || e.address].filter(Boolean).join("\n"),
      fromEvent: true as const,
    }));
}
