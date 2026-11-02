import "server-only";
import { headers } from "next/headers";
import { getSettings } from "@/lib/settings";
import { DEFAULT_LANG, SITE_LANGS, isSiteLang, type SiteLang } from "./config";
import { DICTS, type SiteDict } from "./dict";

/** Langue de la page en cours (fixée par le proxy d'après l'adresse). */
export async function getSiteLang(): Promise<SiteLang> {
  const h = await headers();
  const v = h.get("x-site-lang");
  return isSiteLang(v) ? v : DEFAULT_LANG;
}

export async function getSiteRequest() {
  const h = await headers();
  const lang = h.get("x-site-lang");
  const cookie = h.get("x-site-cookie-lang");
  return {
    lang: isSiteLang(lang) ? lang : DEFAULT_LANG,
    path: h.get("x-site-path") || "/",
    prefixed: h.get("x-site-prefixed") === "1",
    country: (h.get("x-site-country") || "").slice(0, 2),
    cookieLang: isSiteLang(cookie) ? cookie : null,
  };
}

/** Langues ouvertes aux visiteurs (Paramètres → Langues). Le français l'est toujours. */
export async function getEnabledLangs(): Promise<SiteLang[]> {
  const { languages } = await getSettings();
  const set = new Set<string>(["fr", ...(languages.enabled ?? [])]);
  return SITE_LANGS.filter((l) => set.has(l));
}

export function dictFor(lang: SiteLang): SiteDict {
  return DICTS[lang] ?? DICTS.fr;
}

/** Dictionnaire de la page en cours. */
export async function getDict(): Promise<{ lang: SiteLang; t: SiteDict }> {
  const lang = await getSiteLang();
  return { lang, t: dictFor(lang) };
}

/** Langue préférée hors site vitrine (espace mariés) : choix mémorisé, sinon la langue donnée. */
export async function getPreferredLang(fallback?: string | null): Promise<SiteLang> {
  const { cookies } = await import("next/headers");
  const c = (await cookies()).get("ei-lang")?.value;
  if (isSiteLang(c)) return c;
  return isSiteLang(fallback) ? fallback : DEFAULT_LANG;
}
