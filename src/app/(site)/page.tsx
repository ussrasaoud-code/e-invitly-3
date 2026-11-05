import Image from "next/image";
import Link from "next/link";
import colombe from "../../../public/decor/colombe.png";
import fleurs from "../../../public/decor/fleurs-aquarelle.png";
import { CornerSpray, Divider, Sprig } from "@/components/ornaments";
import { InteractiveDemo } from "@/components/site/InteractiveDemo";
import { SetupNotice } from "@/components/site/SetupNotice";
import { PhoneStrip } from "@/components/site/PhoneStrip";
import { PriceGrid } from "@/components/site/PriceGrid";
import { getSettings } from "@/lib/settings";
import type { Metadata } from "next";
import { localePath } from "@/lib/i18n/config";
import { getDict } from "@/lib/i18n/server";
import { pageMetadata } from "@/lib/i18n/metadata";
import { listPublishedTemplates, listShowcase, localizeTemplate } from "@/lib/templates";

export async function generateMetadata(): Promise<Metadata> {
  const { lang, t } = await getDict();
  return pageMetadata(lang, "/", { title: { absolute: t.meta.title }, description: t.meta.description });
}

export default async function HomePage() {
  const { lang, t } = await getDict();
  const [settings, list, showcase] = await Promise.all([getSettings(), listPublishedTemplates(), listShowcase(3, lang)]);
  const templates = { ...list, data: list.data.map((x) => localizeTemplate(x, lang)) };
  const h = t.home;
  const href = (p: string) => localePath(lang, p);
  // Textes d'accueil et FAQ modifiables dans l'administration (français) ; traduits pour les autres langues
  const home = lang === "fr" ? settings.home : { heroTitle: h.heroTitle, heroSubtitle: h.heroSubtitle, faq: h.faq };
  const STEPS = h.steps.map((st, i) => ({ ...st, n: `0${i + 1}` }));
  const BENEFITS = h.benefits;
  const demoLabels = { badge: t.demo.badge, demoLabel: t.template.demoLabel, tabs: t.nav.choose };

  return (
    <main>
      {/* ── Hero ── */}
      <section className="relative overflow-hidden paper-texture">
        <CornerSpray className="pointer-events-none absolute -left-8 -top-4 hidden w-64 -scale-y-100 text-sage md:block" stroke="#586C60" fill="#A6B5A2" />
        <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 pb-20 pt-12 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] md:pb-28 md:pt-20">
          <div className="animate-rise text-center md:text-start">
            <p className="eyebrow">{h.eyebrow}</p>
            <h1 className="mt-5 font-serif text-[2.6rem] leading-[1.08] text-charcoal sm:text-5xl md:text-[3.6rem]">
              {home.heroTitle}
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-[1.06rem] leading-relaxed text-stone md:mx-0">{home.heroSubtitle}</p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row sm:flex-wrap md:justify-start">
              <Link href={href("/invitations")} className="btn btn-primary">
                {h.discover}
              </Link>
              <Link href="#comment-ca-marche" className="btn btn-secondary">
                {h.howItWorks}
              </Link>
            </div>
            <p className="mt-8 font-script text-2xl text-forest">{h.tapSeal}</p>
          </div>

          <div className="relative mx-auto w-full min-w-0 max-w-[460px] animate-[rise_1.1s_cubic-bezier(.2,.7,.2,1)_.25s_both] px-8 py-20 sm:px-16 sm:py-12 md:px-0 lg:px-16">
            {/* Décor : colombes et fleurs aquarelle autour du téléphone, avec un espace autour du cadre */}
            <Image src={colombe} alt="" aria-hidden className="pointer-events-none absolute left-0 top-0 z-10 w-16 animate-[float_7s_ease-in-out_infinite] sm:-left-12 sm:top-2 sm:w-24 md:hidden lg:block lg:-left-16 lg:w-24" sizes="96px" priority />
            <Image src={fleurs} alt="" aria-hidden className="pointer-events-none absolute right-0 top-0 w-11 rotate-[200deg] sm:-right-12 sm:top-2 sm:w-24 md:hidden lg:block lg:-right-16 lg:w-24" sizes="96px" />
            <Image src={fleurs} alt="" aria-hidden className="pointer-events-none absolute bottom-0 left-0 w-11 sm:-left-12 sm:bottom-2 sm:w-24 md:hidden lg:block lg:-left-16 lg:w-24" sizes="96px" />
            <Image src={colombe} alt="" aria-hidden className="pointer-events-none absolute bottom-1 right-0 z-10 w-16 -scale-x-100 animate-[float_8s_ease-in-out_1.5s_infinite] sm:-right-12 sm:bottom-4 sm:w-24 md:hidden lg:block lg:-right-16 lg:w-24" sizes="96px" />
            <div className="relative">
              {showcase.length ? <InteractiveDemo items={showcase} showTabs={false} labels={demoLabels} /> : <SetupNotice t={t.setup} />}
            </div>
          </div>
        </div>
      </section>

      {/* ── Comment ça marche ── */}
      <section id="comment-ca-marche" className="scroll-mt-24 bg-paper px-5 py-20 md:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <p className="eyebrow">{h.stepsEyebrow}</p>
            <h2 className="mt-4 font-serif text-4xl md:text-5xl">{h.stepsTitle}</h2>
            <Divider className="mx-auto mt-6 h-5 w-40 text-sage" />
          </div>
          <ol className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
            {STEPS.map((s, i) => (
              <li key={s.n} className={`relative ${i === 3 ? "lg:-mt-2" : ""}`}>
                <span className="font-display text-sm tracking-[0.3em] text-forest">{s.n}</span>
                <h3 className="mt-3 font-serif text-2xl leading-snug">{s.title}</h3>
                <p className="mt-3 leading-relaxed text-stone">{s.text}</p>
                {i === 3 ? (
                  <p className="mt-3 inline-block border-b border-sage pb-0.5 text-sm text-forest">{h.teamDone}</p>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Collections ── */}
      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-5">
          <div className="flex flex-col items-center justify-between gap-6 text-center md:flex-row md:items-end md:text-start">
            <div>
              <p className="eyebrow">{h.collectionsEyebrow}</p>
              <h2 className="mt-4 font-serif text-4xl md:text-5xl">{h.collectionsTitle}</h2>
            </div>
            <Link href={href("/invitations")} className="btn btn-ghost">
              {h.allCatalogue}
            </Link>
          </div>
        </div>
        <div className="mt-14">
          {!templates.configured ? (
            <div className="mx-auto max-w-6xl px-5"><SetupNotice t={t.setup} /></div>
          ) : templates.data.length ? (
            <>
              <PhoneStrip templates={templates.data} t={t.cards} />
              <div className="mx-auto mt-10 max-w-6xl px-5">
                <div className="flex flex-col items-center justify-between gap-6 text-center md:flex-row md:items-end md:text-start">
                  <div>
                    <p className="eyebrow">{h.pricingEyebrow}</p>
                    <h2 className="mt-4 font-serif text-3xl md:text-4xl">{h.pricingTitle}</h2>
                  </div>
                  <Link href={href("/invitations")} className="btn btn-secondary">{h.seeAll}</Link>
                </div>
                <div className="mt-10">
                  <PriceGrid templates={templates.data} t={t.cards} lang={lang} />
                </div>
              </div>
            </>
          ) : (
            <p className="text-center text-stone">{h.comingSoon}</p>
          )}
        </div>
      </section>

      {/* ── Avantages ── */}
      <section id="avantages" className="scroll-mt-24 border-y border-line bg-white px-5 py-20 md:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <p className="eyebrow">{h.benefitsEyebrow}</p>
            <h2 className="mt-4 font-serif text-4xl md:text-5xl">{h.benefitsTitle}</h2>
          </div>
          <ul className="mt-14 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {BENEFITS.map((b) => (
              <li key={b.title} className="border-t border-line pt-5">
                <h3 className="font-serif text-xl">{b.title}</h3>
                <p className="mt-2 text-[0.95rem] leading-relaxed text-stone">{b.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Aperçu interactif ── */}
      <section className="relative overflow-hidden px-5 py-20 md:py-28">
        <Sprig className="pointer-events-none absolute -right-4 top-20 hidden h-80 text-sage md:block" stroke="#586C60" fill="#A6B5A2" />
        <div className="mx-auto grid max-w-5xl items-center gap-14 md:grid-cols-2 [&>*]:min-w-0">
          <div className="text-center md:text-start">
            <p className="eyebrow">{h.previewEyebrow}</p>
            <h2 className="mt-4 font-serif text-4xl md:text-5xl">{h.previewTitle}</h2>
            <p className="mt-5 leading-relaxed text-stone">{h.previewText}</p>
            <p className="mt-4 text-sm italic text-stone">{h.previewNote}</p>
          </div>
          {showcase.length ? <InteractiveDemo items={showcase} initial={showcase.length > 1 ? 1 : 0} labels={demoLabels} /> : <SetupNotice t={t.setup} />}
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="scroll-mt-24 bg-paper px-5 py-20 md:py-28">
        <div className="mx-auto max-w-3xl">
          <div className="text-center">
            <p className="eyebrow">{h.faqEyebrow}</p>
            <h2 className="mt-4 font-serif text-4xl md:text-5xl">{h.faqTitle}</h2>
          </div>
          <div className="mt-12 divide-y divide-line border-y border-line">
            {home.faq.map((f) => (
              <details key={f.question} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 font-serif text-xl [&::-webkit-details-marker]:hidden">
                  {f.question}
                  <span aria-hidden="true" className="text-2xl font-light text-forest transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 leading-relaxed text-stone">{f.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── Appel final ── */}
      <section className="px-5 py-20 text-center md:py-24">
        <p className="font-script text-4xl text-forest">{h.ctaScript}</p>
        <p className="mx-auto mt-4 max-w-md text-stone">{h.ctaText}</p>
        <Link href={href("/invitations")} className="btn btn-primary mt-8">
          {h.ctaButton}
        </Link>
      </section>
    </main>
  );
}
