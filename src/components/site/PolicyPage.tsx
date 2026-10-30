import type { ReactNode } from "react";

/** Page légale : texte saisi dans /admin/parametres, paragraphes séparés par une ligne vide. */
export function PolicyPage({ title, body, fallback }: { title: string; body: string; fallback: ReactNode }) {
  const paragraphs = body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  return (
    <main className="px-5 pb-24 pt-14">
      <article className="prose-legal mx-auto max-w-3xl">
        <h1 className="font-serif text-5xl">{title}</h1>
        <div className="mt-10 text-[1.02rem] text-charcoal/90">
          {paragraphs.length
            ? paragraphs.map((p, i) =>
                p.startsWith("## ") ? <h2 key={i}>{p.slice(3)}</h2> : <p key={i} className="whitespace-pre-line">{p}</p>,
              )
            : fallback}
        </div>
      </article>
    </main>
  );
}
