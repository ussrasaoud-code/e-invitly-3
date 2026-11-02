import "server-only";
import type { Metadata } from "next";
import { LANG_META, localePath, type SiteLang } from "./config";
import { getEnabledLangs } from "./server";

/**
 * Métadonnées d'une page du site : langue de partage et liens vers les autres
 * langues ouvertes (hreflang), pour que Google référence chaque version.
 */
export async function pageMetadata(lang: SiteLang, path: string, extra: Metadata = {}): Promise<Metadata> {
  const enabled = await getEnabledLangs();
  const languages: Record<string, string> = Object.fromEntries(enabled.map((l) => [l, localePath(l, path)]));
  languages["x-default"] = path;
  return {
    ...extra,
    alternates: { canonical: localePath(lang, path), languages },
    openGraph: { siteName: "E-Invitly", type: "website", locale: LANG_META[lang].og, ...(extra.openGraph ?? {}) },
  };
}
