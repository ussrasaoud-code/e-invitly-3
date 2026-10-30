/**
 * Génération des URL d'invitation : e-invitly.com/<slug>
 * Fonctions pures, sans accès base — testées dans slug.test.ts.
 */

/** Chemins réservés par l'application : ne peuvent jamais devenir un slug. */
export const RESERVED_SLUGS = new Set([
  "admin",
  "api",
  "auth",
  "invitations",
  "invitation",
  "personnalisation",
  "demo",
  "apercu",
  "preview",
  "connexion",
  "deconnexion",
  "login",
  "logout",
  "mon-espace",
  "espace",
  "compte",
  "mentions-legales",
  "confidentialite",
  "cgv",
  "cookies",
  "contact",
  "faq",
  "merci",
  "aide",
  "blog",
  "static",
  "public",
  "assets",
  "media",
  "medias",
  "templates",
  "modeles",
  "favicon-ico",
  "robots-txt",
  "sitemap-xml",
  "www",
  "e-invitly",
]);

export const SLUG_MAX_LENGTH = 60;
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Translittération simple de l'arabe vers le latin (suffisante pour une URL).
const ARABIC_MAP: Record<string, string> = {
  ا: "a", أ: "a", إ: "i", آ: "a", ى: "a", ب: "b", ت: "t", ث: "th", ج: "j", ح: "h", خ: "kh",
  د: "d", ذ: "dh", ر: "r", ز: "z", س: "s", ش: "sh", ص: "s", ض: "d", ط: "t", ظ: "z", ع: "a",
  غ: "gh", ف: "f", ق: "q", ك: "k", ل: "l", م: "m", ن: "n", ه: "h", ة: "a", و: "w", ؤ: "w",
  ي: "y", ئ: "y", ء: "",
};

/** Transforme un texte libre en fragment d'URL : « Hélène & Zoé » → « helene-zoe ». */
export function slugify(input: string): string {
  const transliterated = Array.from(input)
    .map((ch) => ARABIC_MAP[ch] ?? ch)
    .join("")
    .replace(/[ßẞ]/g, "ss")
    .replace(/[æÆ]/g, "ae")
    .replace(/[œŒ]/g, "oe")
    .replace(/[øØ]/g, "o")
    .replace(/[łŁ]/g, "l");

  return transliterated
    .normalize("NFKD")
    .replace(/[̀-ًͯ-ٟ]/g, "") // accents latins + voyelles courtes arabes
    .toLowerCase()
    .replace(/&|\+/g, " ")
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/g, "");
}

/** Slug proposé à partir des prénoms du couple. */
export function slugFromNames(...names: Array<string | null | undefined>): string {
  return slugify(names.filter((n): n is string => !!n && n.trim() !== "").join(" "));
}

export type SlugProblem = "empty" | "format" | "too-long" | "reserved";

export function validateSlug(slug: string): SlugProblem | null {
  if (!slug) return "empty";
  if (slug.length > SLUG_MAX_LENGTH) return "too-long";
  if (!SLUG_PATTERN.test(slug)) return "format";
  if (RESERVED_SLUGS.has(slug)) return "reserved";
  return null;
}

export const SLUG_PROBLEM_MESSAGES: Record<SlugProblem, string> = {
  empty: "L'adresse ne peut pas être vide.",
  format: "Utilisez uniquement des lettres minuscules sans accent, des chiffres et des tirets.",
  "too-long": `L'adresse ne doit pas dépasser ${SLUG_MAX_LENGTH} caractères.`,
  reserved: "Cette adresse est réservée par le site. Choisissez-en une autre.",
};

/**
 * Premier slug libre : base, base-2, base-3…
 * `isTaken` interroge la base (invitations + anciennes redirections).
 */
export async function findAvailableSlug(
  base: string,
  isTaken: (candidate: string) => Promise<boolean>,
  fallbackSeed: () => string = () => Math.random().toString(36).slice(2, 6),
): Promise<string> {
  let root = slugify(base);
  if (!root || RESERVED_SLUGS.has(root)) root = root ? `${root}-invitation` : `invitation-${fallbackSeed()}`;
  root = root.slice(0, SLUG_MAX_LENGTH - 4).replace(/-+$/g, "");

  if (!(await isTaken(root))) return root;
  for (let n = 2; n < 100; n++) {
    const candidate = `${root}-${n}`;
    if (!(await isTaken(candidate))) return candidate;
  }
  return `${root}-${fallbackSeed()}`;
}
