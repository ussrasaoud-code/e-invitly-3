import Link from "next/link";
import { LANG_META, localePath, type SiteLang } from "@/lib/i18n/config";
import type { SiteDict } from "@/lib/i18n/dict";
import type { CatalogTemplate } from "@/lib/templates";

/** Écran de téléphone : image recouvrant tout l'écran, ou nom du modèle. */
function Screen({ src, name, className = "" }: { src?: string | null; name: string; className?: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" loading="lazy" width={300} height={650} className={`h-full w-full object-cover ${className}`} />
  ) : (
    <span className={`flex h-full w-full items-center justify-center bg-ivory px-2 text-center font-display text-[0.55rem] tracking-[0.25em] text-stone ${className}`}>
      {name.toUpperCase()}
    </span>
  );
}

/**
 * Cartes « modèle + prix » : deux téléphones posés sur un fond papier
 * (l'enveloppe à l'avant, l'invitation derrière), puis le nom, la
 * description et le prix.
 */
export function PriceGrid({ templates, t: tr, lang }: { templates: CatalogTemplate[]; t: SiteDict["cards"]; lang: SiteLang }) {
  const href = (p: string) => localePath(lang, p);
  return (
    <ul className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
      {templates.map((t) => {
        const second = t.gallery.find(Boolean) ?? null;
        return (
          <li key={t.id} className="group">
            <Link href={href(`/invitations/${t.slug}`)} aria-label={tr.detailsAria.replace("{name}", t.name)} className="relative block aspect-square overflow-hidden rounded-[1.6rem] bg-[#e8e3da]">
              {t.is_featured ? (
                <span className="absolute start-4 top-4 z-10 rounded-full bg-forest px-3 py-1 text-[0.62rem] font-medium uppercase tracking-[0.18em] text-ivory">{tr.featured}</span>
              ) : null}
              <span className={`absolute inset-0 flex items-center justify-center ${second ? "gap-[6%] ps-[4%]" : ""}`}>
                {/* Téléphone à l'avant (enveloppe) */}
                <span className="relative z-[1] aspect-[9/19] w-[30%] rounded-[1.1rem] bg-[#151515] p-[2.5%] shadow-[0_22px_30px_-14px_rgb(40_30_20/0.55)] transition-transform duration-500 group-hover:-translate-y-1.5">
                  <span className="block h-full w-full overflow-hidden rounded-[0.85rem]">
                    <Screen src={t.cover_image} name={t.name} />
                  </span>
                  <span aria-hidden="true" className="absolute left-1/2 top-[4%] h-[3.5%] w-[34%] -translate-x-1/2 rounded-full bg-black" />
                </span>
                {/* Invitation à l'arrière */}
                {second ? (
                  <span className="relative -mt-[12%] aspect-[9/19] w-[28%] overflow-hidden rounded-[0.9rem] shadow-[0_16px_26px_-14px_rgb(40_30_20/0.45)] transition-transform delay-75 duration-500 group-hover:-translate-y-1">
                    <Screen src={second} name={t.name} />
                  </span>
                ) : null}
              </span>
            </Link>
            <h3 className="mt-5 font-serif text-[1.65rem] leading-tight">
              <Link href={href(`/invitations/${t.slug}`)} className="hover:text-forest">{t.name}</Link>
            </h3>
            {t.short_description ? <p className="mt-2 text-[0.95rem] leading-relaxed text-stone">{t.short_description}</p> : null}
            {t.price_label ? <p className="mt-3 font-medium text-forest">{t.price_label}</p> : null}
            {t.languages?.length > 1 ? (
              <p className="mt-2 text-xs text-stone">
                {tr.languages.replace("{list}", t.languages.map((l) => LANG_META[l as SiteLang]?.native ?? l).join(" · "))}
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
