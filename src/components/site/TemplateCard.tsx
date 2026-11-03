import Link from "next/link";
import { LANG_META, localePath, type SiteLang } from "@/lib/i18n/config";
import type { SiteDict } from "@/lib/i18n/dict";
import type { CatalogTemplate } from "@/lib/templates";

/**
 * Carte du catalogue au format téléphone : couverture verticale aux coins
 * arrondis, ombre douce, nom en capitales espacées. `offset` décale la carte
 * vers le bas (effet en quinconce sur grand écran).
 */
export function TemplateCard({ template, priority = false, offset = false, t, lang }: { template: CatalogTemplate; priority?: boolean; offset?: boolean; t: SiteDict; lang: SiteLang }) {
  const href = (p: string) => localePath(lang, p);
  const styleLabel = (v: string) => t.styles[v as keyof typeof t.styles] ?? v;
  return (
    <article className={`group mx-auto flex w-full max-w-[290px] flex-col items-center text-center ${offset ? "lg:mt-20" : ""}`}>
      <Link
        href={href(`/demo/${template.slug}`)}
        className="relative block w-full overflow-hidden rounded-[2.2rem] border border-white/70 bg-paper shadow-[0_30px_60px_-24px_rgb(60_50_40/0.35),0_8px_20px_-12px_rgb(60_50_40/0.18)] transition-transform duration-500 group-hover:-translate-y-1.5"
        aria-label={t.cards.demoAria.replace("{name}", template.name)}
      >
        {template.cover_image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={template.cover_image}
            alt={t.cards.coverAlt.replace("{name}", template.name)}
            width={580}
            height={1256}
            loading={priority ? "eager" : "lazy"}
            className="aspect-[9/19.5] w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex aspect-[9/19.5] items-center justify-center px-6 font-display text-sm tracking-[0.3em] text-stone">
            {template.name.toUpperCase()}
          </div>
        )}
        {/* Caméra du téléphone */}
        <span aria-hidden="true" className="absolute left-1/2 top-3 h-[1.35rem] w-[32%] -translate-x-1/2 rounded-full bg-black/85" />
      </Link>
      <div className="flex flex-1 flex-col items-center pt-7">
        {template.is_featured ? (
          <span className="mb-2 text-[0.62rem] uppercase tracking-[0.25em] text-forest">{t.cards.featured}</span>
        ) : null}
        <h3 className="font-display text-[0.95rem] uppercase tracking-[0.32em] text-stone">
          <Link href={href(`/invitations/${template.slug}`)} className="hover:text-forest">{template.name}</Link>
        </h3>
        {template.styles.length ? <p className="mt-2 text-[0.7rem] uppercase tracking-[0.2em] text-stone/70">{template.styles.map(styleLabel).join(" · ")}</p> : null}
        {template.short_description ? <p className="mt-3 text-[0.92rem] leading-relaxed text-stone">{template.short_description}</p> : null}
        {template.price_label ? <p className="mt-2 text-sm text-charcoal">{template.price_label}</p> : null}
        {template.languages?.length > 1 ? (
          <p className="mt-1 text-xs text-stone">{t.cards.languages.replace("{list}", template.languages.map((l) => LANG_META[l as SiteLang]?.short ?? l).join(" · "))}</p>
        ) : null}
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link href={href(`/demo/${template.slug}`)} className="btn btn-secondary btn-sm !px-3 !tracking-[0.12em]">
            {t.cards.demo}
          </Link>
          <Link href={href(`/personnalisation/${template.slug}`)} className="btn btn-primary btn-sm !px-3 !tracking-[0.12em]">
            {t.cards.choose}
          </Link>
        </div>
      </div>
    </article>
  );
}
