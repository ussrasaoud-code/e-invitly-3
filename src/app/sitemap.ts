import type { MetadataRoute } from "next";
import { env } from "@/lib/env";
import { localePath } from "@/lib/i18n/config";
import { getEnabledLangs } from "@/lib/i18n/server";
import { listPublishedTemplates } from "@/lib/templates";

/** Plan du site : chaque page publique dans chaque langue ouverte, avec ses équivalents (hreflang). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [langs, { data: templates }] = await Promise.all([getEnabledLangs(), listPublishedTemplates()]);
  const paths = ["/", "/invitations", ...templates.map((t) => `/invitations/${t.slug}`), "/confidentialite", "/mentions-legales"];
  const abs = (p: string) => new URL(p, env.siteUrl).toString();
  return paths.flatMap((path) =>
    langs.map((lang) => ({
      url: abs(localePath(lang, path)),
      changeFrequency: path === "/" || path === "/invitations" ? ("weekly" as const) : ("monthly" as const),
      priority: path === "/" ? 1 : path === "/invitations" ? 0.9 : 0.6,
      alternates: { languages: Object.fromEntries(langs.map((l) => [l, abs(localePath(l, path))])) },
    })),
  );
}
