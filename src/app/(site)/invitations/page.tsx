import type { Metadata } from "next";
import Link from "next/link";
import { SetupNotice } from "@/components/site/SetupNotice";
import { TemplateCard } from "@/components/site/TemplateCard";
import { CATEGORIES, STYLES } from "@/lib/catalog";
import { listPublishedTemplates } from "@/lib/templates";

export const metadata: Metadata = {
  title: "Nos invitations",
  description: "Le catalogue des modèles d'invitations digitales E-Invitly : mariage, fiançailles, anniversaire, baptême…",
};

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
  const { categorie, style } = await searchParams;
  const { data: templates, configured } = await listPublishedTemplates();

  // Uniquement les filtres qui correspondent à au moins un modèle
  const categories = CATEGORIES.filter((c) => templates.some((t) => t.category === c.value));
  const styles = STYLES.filter((s) => templates.some((t) => t.styles.includes(s.value)));
  const filtered = templates.filter(
    (t) => (!categorie || t.category === categorie) && (!style || t.styles.includes(style)),
  );
  const qs = (next: { categorie?: string; style?: string }) => {
    const p = new URLSearchParams();
    if (next.categorie) p.set("categorie", next.categorie);
    if (next.style) p.set("style", next.style);
    const s = p.toString();
    return s ? `/invitations?${s}` : "/invitations";
  };

  return (
    <main className="px-5 pb-24 pt-14 md:pt-20">
      <div className="mx-auto max-w-6xl">
        <header className="text-center">
          <p className="eyebrow">Catalogue</p>
          <h1 className="mt-4 font-serif text-5xl md:text-6xl">Nos invitations</h1>
          <p className="mx-auto mt-5 max-w-xl leading-relaxed text-stone">
            Chaque modèle est une base : nous l&apos;adaptons à vos prénoms, vos lieux, vos textes et votre programme.
          </p>
        </header>

        {!configured ? (
          <div className="mt-14"><SetupNotice /></div>
        ) : (
          <>
            {(categories.length > 1 || styles.length > 1) && (
              <div className="mt-12 space-y-4">
                {categories.length > 1 ? (
                  <div className="flex flex-wrap justify-center gap-2" aria-label="Filtrer par événement">
                    <FilterLink href={qs({ style })} active={!categorie}>Tous les événements</FilterLink>
                    {categories.map((c) => (
                      <FilterLink key={c.value} href={qs({ categorie: c.value, style })} active={categorie === c.value}>
                        {c.label}
                      </FilterLink>
                    ))}
                  </div>
                ) : null}
                {styles.length > 1 ? (
                  <div className="flex flex-wrap justify-center gap-2" aria-label="Filtrer par style">
                    <FilterLink href={qs({ categorie })} active={!style}>Tous les styles</FilterLink>
                    {styles.map((s) => (
                      <FilterLink key={s.value} href={qs({ categorie, style: s.value })} active={style === s.value}>
                        {s.label}
                      </FilterLink>
                    ))}
                  </div>
                ) : null}
              </div>
            )}

            <p className="mt-10 text-center text-sm text-stone" aria-live="polite">
              {filtered.length} modèle{filtered.length > 1 ? "s" : ""}
            </p>
            {filtered.length ? (
              <div className="mt-8 grid gap-x-10 gap-y-16 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((t, i) => (
                  <TemplateCard key={t.id} template={t} priority={i < 2} />
                ))}
              </div>
            ) : (
              <p className="mt-10 text-center text-stone">
                Aucun modèle ne correspond à ces filtres.{" "}
                <Link href="/invitations" className="text-forest underline underline-offset-4">Tout afficher</Link>
              </p>
            )}
          </>
        )}
      </div>
    </main>
  );
}
