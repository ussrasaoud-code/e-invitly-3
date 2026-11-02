"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { CatalogTemplate } from "@/lib/templates";

/**
 * Bandeau de modèles au format téléphone (coins arrondis, ombre douce,
 * cartes en quinconce, nom en capitales espacées). Défilement horizontal
 * au doigt ; flèches sur grand écran.
 */
export function PhoneStrip({ templates }: { templates: CatalogTemplate[] }) {
  const track = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const update = () => setEdges({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth > el.scrollWidth - 8 });
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const go = (dir: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(280, el.clientWidth * 0.7), behavior: "smooth" });
  };

  return (
    <div className="relative">
      <div ref={track} className="snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Tous nos modèles">
        <div className="mx-auto flex w-max gap-8 px-[max(1.25rem,calc((100vw-72rem)/2))] pb-16 pt-4 md:gap-12">
        {templates.map((t, i) => (
          <Link
            key={t.id}
            href={`/demo/${t.slug}`}
            className={`group flex w-[62vw] max-w-[250px] shrink-0 snap-center flex-col items-center sm:w-[240px] md:w-[250px] ${i % 2 === 1 ? "mt-16 md:mt-24" : ""}`}
            aria-label={`Voir la démo du modèle ${t.name}`}
          >
            <span className="relative block w-full overflow-hidden rounded-[2.2rem] border border-white/70 bg-paper shadow-[0_30px_60px_-24px_rgb(60_50_40/0.35),0_8px_20px_-12px_rgb(60_50_40/0.18)] transition-transform duration-500 group-hover:-translate-y-2">
              {t.cover_image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={t.cover_image}
                  alt=""
                  width={500}
                  height={1083}
                  loading={i < 4 ? "eager" : "lazy"}
                  className="aspect-[9/19.5] w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                />
              ) : (
                <span className="flex aspect-[9/19.5] items-center justify-center px-6 text-center font-display text-sm tracking-[0.3em] text-stone">
                  {t.name.toUpperCase()}
                </span>
              )}
              {/* Caméra du téléphone, visible au survol */}
              <span aria-hidden="true" className="absolute left-1/2 top-3 h-[1.3rem] w-[32%] -translate-x-1/2 rounded-full bg-black/85 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
            </span>
            <span className="mt-7 font-display text-[0.9rem] uppercase tracking-[0.32em] text-stone transition-colors group-hover:text-forest">{t.name}</span>
            {t.is_featured ? <span className="mt-1.5 text-[0.6rem] uppercase tracking-[0.25em] text-forest/80">Coup de cœur</span> : null}
          </Link>
        ))}
        </div>
      </div>
      {templates.length > 3 ? (
        <div className="pointer-events-none absolute inset-x-0 top-1/2 hidden -translate-y-1/2 justify-between px-4 md:flex">
          <button type="button" onClick={() => go(-1)} disabled={edges.start} aria-label="Modèles précédents" className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border border-line bg-ivory/90 text-lg shadow-sm transition-opacity disabled:opacity-0">←</button>
          <button type="button" onClick={() => go(1)} disabled={edges.end} aria-label="Modèles suivants" className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border border-line bg-ivory/90 text-lg shadow-sm transition-opacity disabled:opacity-0">→</button>
        </div>
      ) : null}
    </div>
  );
}
