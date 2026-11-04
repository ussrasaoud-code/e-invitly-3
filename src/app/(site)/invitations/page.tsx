import type { Metadata } from "next";
import Link from "next/link";
import { SetupNotice } from "@/components/site/SetupNotice";
import { TemplateCard } from "@/components/site/TemplateCard";
import { CATEGORIES, STYLES, isCatalogStyle } from "@/lib/catalog";
import { fmt, localePath } from "@/lib/i18n/config";
import { pageMetadata } from "@/lib/i18n/metadata";
import { getDict } from "@/lib/i18n/server";
import { listPublishedTemplates, localizeTemplate } from "@/lib/templates";

export async function generateMetadata(): Promise<Metadata> {
  const { lang, t } = await getDict();
  return pageMetadata(lang, "/invitations", { title: t.catalog.metaTitle, description: t.catalog.metaDescription });
}

type Search = Promise<{ categorie?: string; style?: string }>;

function FilterLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "true" : undefined}
      className={`inline-flex min-h-10 items-center rounded-full border px-4 text-[0.78rem] tracking-wide transition-colors ${
        active ? "border-forest bg-forest text-ivory" : "border-sand bg-white text-charcoal hover:border-forest"
      }`}
    >
      {children}
    </Link>
  );
}

export default async function CatalogPage({ searchParams }: { searchParams: Search }) {
  const { lang, t } = await getDict();
  const c = t.catalog;
  const { categorie, style } = await searchParams;
  const { data, configured } = await listPublishedTemplates();
  const templates = data.map((x) => localizeTemplate(x, lang));

  // Uniquement les filtres qui correspondent à au moins un modèle
  const categories = CATEGORIES.filter((x) => templates.some((tp) => tp.category === x.value));
  const custom = [...new Set(templates.flatMap((tp) => tp.styles.filter((s) => !isCatalogStyle(s))))].sort((a, b) => a.localeCompare(b, lang));
  const styles = [...STYLES.filter((x) => templates.some((tp) => tp.styles.includes(x.value))), ...custom.map((v) => ({ value: v, label: v }))];
  const filtered = templates.filter((tp) => (!categorie || tp.category === categorie) && (!style || tp.styles.includes(style)));
  const qs = (next: { categorie?: string; style?: string }) => {
    const p = new URLSearchParams();
    if (next.categorie) p.set("categorie", next.categorie);
    if (next.style) p.set("style", next.style);
    const s = p.toString();
    return localePath(lang, s ? `/invitations?${s}` : "/invitations");
  };
  const catLabel = (v: string) => t.categories[v as keyof typeof t.categories] ?? v;
  const styleLabel = (v: string) => t.styles[v as keyof typeof t.styles] ?? v;

  return (
    <main className="px-5 pb-24 pt-14 md:pt-20">
      <div className="mx-auto max-w-6xl">
        <header className="text-center">
          <p className="eyebrow">{c.eyebrow}</p>
          <h1 className="mt-4 font-serif text-5xl md:text-6xl">{c.title}</h1>
          <p className="mx-auto mt-5 max-w-xl leading-relaxed text-stone">{c.intro}</p>
        </header>

        {!configured ? (
          <div className="mt-14"><SetupNotice t={t.setup} /></div>
        ) : (
          <>
            {(categories.length > 1 || styles.length > 1) && (
              <div className="mt-12 space-y-4">
                {categories.length > 1 ? (
                  <div className="flex flex-wrap justify-center gap-2" aria-label={c.byEvent}>
                    <FilterLink href={qs({ style })} active={!categorie}>{c.allEvents}</FilterLink>
                    {categories.map((x) => (
                      <FilterLink key={x.value} href={qs({ categorie: x.value, style })} active={categorie === x.value}>
                        {catLabel(x.value)}
                      </FilterLink>
                    ))}
                  </div>
                ) : null}
                {styles.length > 1 ? (
                  <div className="flex flex-wrap justify-center gap-2" aria-label={c.byStyle}>
                    <FilterLink href={qs({ categorie })} active={!style}>{c.allStyles}</FilterLink>
                    {styles.map((x) => (
                      <FilterLink key={x.value} href={qs({ categorie, style: x.value })} active={style === x.value}>
                        {styleLabel(x.value)}
                      </FilterLink>
                    ))}
                  </div>
                ) : null}
              </div>
            )}

            <p className="mt-10 text-center text-sm text-stone" aria-live="polite">
              {fmt(filtered.length > 1 ? c.countMany : c.countOne, { n: filtered.length })}
            </p>
            {filtered.length ? (
              <div className="mt-8 grid gap-x-10 gap-y-16 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((tp, i) => (
                  <TemplateCard key={tp.id} template={tp} priority={i < 2} offset={i % 3 === 1} t={t} lang={lang} />
                ))}
              </div>
            ) : (
              <p className="mt-10 text-center text-stone">
                {c.none}{" "}
                <Link href={localePath(lang, "/invitations")} className="text-forest underline underline-offset-4">{c.showAll}</Link>
              </p>
            )}
          </>
        )}
      </div>
    </main>
  );
}
