import { LANGUAGES, type Language } from "@/lib/invitation/schema";

/**
 * Langues du site vitrine. Le français est à la racine (e-invitly.com/…),
 * les autres sous un préfixe (e-invitly.com/en/…, /ar/…).
 * Utilisable côté serveur, côté navigateur et dans le proxy.
 */
export const SITE_LANGS = LANGUAGES;
export type SiteLang = Language;
export const DEFAULT_LANG: SiteLang = "fr";
export const LANG_COOKIE = "ei-lang";

export const LANG_META: Record<SiteLang, { native: string; short: string; dir: "ltr" | "rtl"; intl: string; og: string }> = {
  fr: { native: "Français", short: "FR", dir: "ltr", intl: "fr-FR", og: "fr_FR" },
  en: { native: "English", short: "EN", dir: "ltr", intl: "en-GB", og: "en_GB" },
  ar: { native: "العربية", short: "AR", dir: "rtl", intl: "ar-MA", og: "ar_AR" },
  es: { native: "Español", short: "ES", dir: "ltr", intl: "es-ES", og: "es_ES" },
  it: { native: "Italiano", short: "IT", dir: "ltr", intl: "it-IT", og: "it_IT" },
  de: { native: "Deutsch", short: "DE", dir: "ltr", intl: "de-DE", og: "de_DE" },
  nl: { native: "Nederlands", short: "NL", dir: "ltr", intl: "nl-NL", og: "nl_NL" },
};

export const isSiteLang = (v: unknown): v is SiteLang => typeof v === "string" && (SITE_LANGS as readonly string[]).includes(v);

/** Pages du site vitrine qui existent dans chaque langue. */
const SITE_PATHS = [/^\/$/, /^\/invitations(\/[^/]+)?$/, /^\/personnalisation(\/[^/]+)?$/, /^\/demo\/[^/]+$/, /^\/paiement\/[^/]+$/, /^\/(cgv|confidentialite|mentions-legales|connexion)$/];
export const isSitePath = (path: string) => SITE_PATHS.some((re) => re.test(path));

/** /invitations → /en/invitations ; "/" → "/en" ; "/#faq" → "/en#faq". Le français reste sans préfixe. */
export function localePath(lang: SiteLang, path: string): string {
  if (lang === DEFAULT_LANG) return path;
  if (!path.startsWith("/")) return path;
  const [base, hash = ""] = path.split("#", 2) as [string, string?];
  const [p, q = ""] = base.split("?", 2) as [string, string?];
  const prefixed = p === "/" ? `/${lang}` : `/${lang}${p}`;
  return `${prefixed}${q ? `?${q}` : ""}${hash ? `#${hash}` : ""}`;
}

/** /en/invitations → { lang: "en", path: "/invitations" } (préfixe valide sur une page du site uniquement). */
export function splitLocale(pathname: string): { lang: SiteLang; path: string; prefixed: boolean } {
  const m = /^\/([a-z]{2})(\/.*)?$/.exec(pathname);
  if (m && m[1] !== DEFAULT_LANG && isSiteLang(m[1])) {
    const path = m[2] || "/";
    if (isSitePath(path)) return { lang: m[1], path, prefixed: true };
  }
  return { lang: DEFAULT_LANG, path: pathname, prefixed: false };
}

/** Pays (ISO) → langue la plus probable, utilisée seulement si la langue du téléphone ne suffit pas. */
const COUNTRY_LANG: Record<string, SiteLang> = {
  FR: "fr", BE: "fr", LU: "fr", MC: "fr", CH: "fr", CA: "fr", SN: "fr", CI: "fr",
  GB: "en", IE: "en", US: "en", AU: "en", NZ: "en", ZA: "en",
  MA: "ar", DZ: "ar", TN: "ar", EG: "ar", SA: "ar", AE: "ar", QA: "ar", KW: "ar", BH: "ar", OM: "ar", JO: "ar", LB: "ar", LY: "ar", IQ: "ar",
  ES: "es", MX: "es", AR: "es", CO: "es", CL: "es", PE: "es",
  IT: "it", SM: "it",
  DE: "de", AT: "de", LI: "de",
  NL: "nl", SR: "nl",
};

/**
 * Langue à proposer au visiteur : d'abord celles de son téléphone (dans l'ordre),
 * puis celle de son pays. Seules les langues ouvertes sont proposées.
 */
export function suggestLang(browserLangs: readonly string[], country: string | null, enabled: readonly SiteLang[]): SiteLang | null {
  for (const raw of browserLangs) {
    const code = raw.toLowerCase().split("-")[0];
    if (isSiteLang(code) && enabled.includes(code)) return code;
  }
  const byCountry = country ? COUNTRY_LANG[country.toUpperCase()] : undefined;
  return byCountry && enabled.includes(byCountry) ? byCountry : null;
}

/** Remplace {nom} dans un texte traduit. */
export function fmt(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
