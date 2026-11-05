import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SetupNotice } from "@/components/site/SetupNotice";
import { isSupabaseConfigured } from "@/lib/env";
import { fmt, isSiteLang, localePath } from "@/lib/i18n/config";
import { getDict, getEnabledLangs } from "@/lib/i18n/server";
import { getPublishedTemplate, localizeTemplate } from "@/lib/templates";
import { QuickOrderForm } from "./QuickOrderForm";

type Params = Promise<{ modele: string }>;
type Search = Promise<{ langue?: string }>;

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDict();
  return { title: t.order.metaTitle, robots: { index: false } };
}

export default async function PersonalisationPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { modele } = await params;
  const { langue } = await searchParams;
  const { lang, t } = await getDict();
  if (!isSupabaseConfigured()) {
    return (
      <main className="px-5 py-20">
        <SetupNotice t={t.setup} />
      </main>
    );
  }
  const found = await getPublishedTemplate(modele);
  if (!found) notFound();
  const template = localizeTemplate(found.template, lang);
  const r = t.request;
  const o = t.order;
  // Langue de l'invitation proposée : celle choisie dans la démo, sinon celle du site
  const enabled = await getEnabledLangs();
  const wanted = isSiteLang(langue) ? langue : lang;
  const invitationLang = enabled.includes(wanted) ? wanted : "fr";
  return (
    <main className="px-5 pb-24 pt-10 md:pt-14">
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1fr_300px]">
        <div>
          <p className="eyebrow">{o.eyebrow}</p>
          <h1 className="mt-3 font-serif text-4xl md:text-5xl">{fmt(o.title, { name: template.name })}</h1>
          <p className="mt-4 max-w-2xl leading-relaxed text-stone">{o.intro}</p>
          <ol className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-stone" aria-label={o.howTitle}>
            {o.how.map((step, i) => (
              <li key={step} className="flex items-center gap-2">
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${i === 0 ? "bg-forest text-ivory" : "border border-line"}`}>{i + 1}</span>
                {step}
              </li>
            ))}
          </ol>
          {template.price_label ? (
            <p className="mt-6 lg:hidden">
              <span className="text-sm text-stone">{o.price} · </span>
              <span className="font-serif text-2xl font-semibold text-forest">{template.price_label}</span>
            </p>
          ) : null}
          <div className="mt-10">
            <QuickOrderForm templateSlug={template.slug} category={template.category} t={{ request: r, order: o, categories: t.categories }} lang={lang} invitationLang={invitationLang} languages={enabled} />
          </div>
        </div>
        <aside className="hidden lg:block">
          <div className="sticky top-28">
            {template.cover_image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={template.cover_image} alt={fmt(r.coverAlt, { name: template.name })} className="aspect-[3/4] w-full bg-paper object-cover" />
            ) : null}
            <p className="mt-4 font-serif text-2xl">{template.name}</p>
            <p className="mt-1 text-sm text-stone">{template.short_description}</p>
            {template.price_label ? <p className="mt-3 font-serif text-3xl font-semibold text-forest">{template.price_label}</p> : null}
            <Link href={localePath(lang, `/demo/${template.slug}?langue=${invitationLang}`)} className="mt-3 inline-block text-sm text-forest underline underline-offset-4" target="_blank">
              {r.revisit}
            </Link>
          </div>
        </aside>
      </div>
    </main>
  );
}
