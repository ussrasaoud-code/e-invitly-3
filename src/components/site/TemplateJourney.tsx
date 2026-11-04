import Link from "next/link";
import type { ReactNode } from "react";
import { fmt } from "@/lib/i18n/config";
import type { SiteDict } from "@/lib/i18n/dict";

/* Icônes au trait fin, dans l'esprit papeterie du site */
const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.3, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const ICONS: ReactNode[] = [
  // Création sur mesure : plume
  <path key="0" {...stroke} d="M19 4c-6 1-10 5-12 11l-1 5 4-2c5-2 8-6 9-14ZM7 16l5-5" />,
  // Aperçu : œil
  <g key="1" {...stroke}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="2.8" /></g>,
  // Réponses : enveloppe cochée
  <g key="2" {...stroke}><rect x="3" y="6" width="18" height="12.5" rx="1.5" /><path d="m3.5 7 8.5 6.5L20.5 7" /><path d="m15.5 17.2 1.6 1.6 3.2-3.4" /></g>,
  // Deux langues
  <g key="3" {...stroke}><path d="M3 5.5h8M7 4v1.5c0 3.5-1.6 6-4 7.5M5 9c1 2 2.6 3.4 5 4.2" /><path d="m12.5 20 3.5-9 3.5 9M13.8 17h4.4" /></g>,
  // Moments réservés : cadenas
  <g key="4" {...stroke}><rect x="5" y="10.5" width="14" height="10" rx="1.5" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /><circle cx="12" cy="15.2" r="1.2" /></g>,
  // Ouverture et musique : note
  <g key="5" {...stroke}><path d="M9 17.5V5.5l10-2v12" /><circle cx="6.8" cy="17.5" r="2.3" /><circle cx="16.8" cy="15.5" r="2.3" /></g>,
  // Toujours à jour : flèches
  <g key="6" {...stroke}><path d="M19.5 12a7.5 7.5 0 0 1-13.1 5M4.5 12A7.5 7.5 0 0 1 17.6 7" /><path d="M17.8 3.8v3.4h-3.4M6.2 20.2v-3.4h3.4" /></g>,
  // Paiement : carte
  <g key="7" {...stroke}><rect x="3" y="5.5" width="18" height="13" rx="1.8" /><path d="M3 9.5h18M6.5 15h3.5" /></g>,
];

/**
 * Fiche d'un modèle : ce qui est inclus, le déroulé de la commande,
 * les rubriques possibles et les questions fréquentes.
 */
export function TemplateJourney({ t, delay, requestHref, demoHref }: { t: SiteDict; delay: string; requestHref: string; demoHref: string }) {
  const j = t.template.journey;
  return (
    <section aria-labelledby="journey-title" className="mt-24 md:mt-32">
      <header className="mx-auto max-w-2xl text-center">
        <p className="eyebrow">{j.eyebrow}</p>
        <h2 id="journey-title" className="mt-4 font-serif text-4xl md:text-5xl">{j.title}</h2>
        <p className="mt-5 leading-relaxed text-stone">{j.intro}</p>
      </header>

      {/* Ce qui est inclus */}
      <div className="mt-14">
        <h3 className="flex items-center gap-4 text-[0.72rem] uppercase tracking-[0.28em] text-stone">
          <span className="h-px flex-1 bg-line" aria-hidden="true" />
          {j.includedTitle}
          <span className="h-px flex-1 bg-line" aria-hidden="true" />
        </h3>
        <ul className="mt-10 grid gap-x-8 gap-y-7 sm:grid-cols-2 sm:gap-y-10 lg:grid-cols-4">
          {j.included.map((it, i) => (
            <li key={it.title} className="group flex gap-4 sm:block">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-sage/50 bg-ivory text-forest transition-colors group-hover:bg-sage-soft">
                <svg viewBox="0 0 24 24" className="h-[1.35rem] w-[1.35rem]" aria-hidden="true">{ICONS[i % ICONS.length]}</svg>
              </span>
              <div>
                <p className="font-serif text-[1.3rem] leading-snug sm:mt-4 sm:text-[1.35rem]">{it.title}</p>
                <p className="mt-1.5 text-[0.94rem] leading-relaxed text-stone sm:mt-2">{it.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-20 grid gap-12 rounded-[2rem] bg-paper px-6 py-12 md:grid-cols-[1.1fr_1fr] md:gap-16 md:px-12 md:py-16">
        {/* Déroulé */}
        <div>
          <h3 className="font-serif text-3xl md:text-[2.2rem]">{j.stepsTitle}</h3>
          {delay ? (
            <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-sage/40 bg-ivory px-4 py-1.5 text-sm text-forest">
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true"><g {...stroke}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></g></svg>
              {fmt(j.delay, { delay })}
            </p>
          ) : null}
          <ol className="mt-8">
            {j.steps.map((s, i) => (
              <li key={s.title} className="relative grid grid-cols-[3rem_1fr] gap-4 pb-8 last:pb-0">
                {i < j.steps.length - 1 ? <span aria-hidden="true" className="absolute start-[1.45rem] top-11 bottom-1 w-px bg-sage/40" /> : null}
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ivory font-serif text-xl italic text-forest shadow-[0_0_0_1px_rgb(166_181_162/0.6)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="pt-1.5">
                  <p className="font-medium">{s.title}</p>
                  <p className="mt-1 text-[0.94rem] leading-relaxed text-stone">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="space-y-12">
          {/* Rubriques à la carte */}
          <div>
            <h3 className="font-serif text-3xl md:text-[2.2rem]">{j.sectionsTitle}</h3>
            <p className="mt-3 leading-relaxed text-stone">{j.sectionsText}</p>
            <ul className="mt-6 flex flex-wrap gap-2.5">
              {j.sections.map((s) => (
                <li key={s} className="rounded-full border border-line bg-ivory px-4 py-2 text-sm">{s}</li>
              ))}
              <li className="rounded-full border border-dashed border-sage/60 px-4 py-2 text-sm text-forest">{j.sectionsMore}</li>
            </ul>
          </div>

          {/* Questions */}
          <div>
            <h3 className="font-serif text-3xl md:text-[2.2rem]">{j.faqTitle}</h3>
            <div className="mt-5 divide-y divide-line border-y border-line">
              {j.faq.map((f) => (
                <details key={f.question} className="group py-4">
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-4 [&::-webkit-details-marker]:hidden">
                    <span className="font-medium">{f.question}</span>
                    <span aria-hidden="true" className="mt-0.5 text-lg leading-none text-forest transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 text-[0.94rem] leading-relaxed text-stone">{f.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Appel final */}
      <div className="mt-20 text-center">
        <p className="font-script text-4xl text-forest md:text-5xl">{j.ctaTitle}</p>
        <p className="mx-auto mt-4 max-w-md leading-relaxed text-stone">{j.ctaText}</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href={requestHref} className="btn btn-primary">{t.template.request}</Link>
          <Link href={demoHref} className="btn btn-secondary">{t.template.fullDemo}</Link>
        </div>
      </div>
    </section>
  );
}
