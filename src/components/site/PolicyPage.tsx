import type { ReactNode } from "react";

/**
 * Page légale : texte saisi dans /admin/parametres (en français), paragraphes séparés par une ligne vide.
 * Dans les autres langues, une mention précise que seule la version française fait foi.
 */
export function PolicyPage({ title, body, fallback, frenchNote }: { title: string; body: string; fallback: ReactNode; frenchNote?: string }) {
  const paragraphs = body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  return (
    <main className="px-5 pb-24 pt-14">
      <article className="prose-legal mx-auto max-w-3xl">
        <h1 className="font-serif text-5xl">{title}</h1>
        {frenchNote && paragraphs.length ? <p className="mt-4 text-sm italic text-stone">{frenchNote}</p> : null}
        <div className="mt-10 text-[1.02rem] text-charcoal/90">
          {paragraphs.length ? (
            <div lang="fr" dir="ltr">
              {paragraphs.map((p, i) => (p.startsWith("## ") ? <h2 key={i}>{p.slice(3)}</h2> : <p key={i} className="whitespace-pre-line">{p}</p>))}
            </div>
          ) : (
            fallback
          )}
        </div>
      </article>
    </main>
  );
}
