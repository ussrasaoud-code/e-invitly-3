import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SetupNotice } from "@/components/site/SetupNotice";
import { isSupabaseConfigured } from "@/lib/env";
import { fmt, isSiteLang, localePath } from "@/lib/i18n/config";
import { getDict } from "@/lib/i18n/server";
import { getPublishedTemplate, localizeTemplate } from "@/lib/templates";
import { RequestForm } from "./RequestForm";

type Params = Promise<{ modele: string }>;
type Search = Promise<{ langue?: string }>;

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDict();
  return { title: t.request.metaTitle, robots: { index: false } };
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
  // Langue de l'invitation proposée : celle choisie dans la démo, sinon celle du site
  const invitationLang = isSiteLang(langue) ? langue : lang;
  return (
    <main className="px-5 pb-24 pt-10 md:pt-14">
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1fr_300px]">
        <div>
          <p className="eyebrow">{r.eyebrow}</p>
          <h1 className="mt-3 font-serif text-4xl md:text-5xl">{fmt(r.title, { name: template.name })}</h1>
          <p className="mt-4 max-w-2xl leading-relaxed text-stone">{r.intro}</p>
          <div className="mt-10">
            <RequestForm templateSlug={template.slug} templateName={template.name} t={r} lang={lang} invitationLang={invitationLang} cultures={template.cultures} />
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
            <Link href={localePath(lang, `/demo/${template.slug}?langue=${invitationLang}`)} className="mt-3 inline-block text-sm text-forest underline underline-offset-4" target="_blank">
              {r.revisit}
            </Link>
          </div>
        </aside>
      </div>
    </main>
  );
}
