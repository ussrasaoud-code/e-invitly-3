import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSettings } from "@/lib/settings";
import { CopyGuard, Watermark } from "@/components/invitation/Protection";
import { InvitationView } from "@/components/invitation/InvitationView";
import { LANG_META, fmt, isSiteLang, localePath } from "@/lib/i18n/config";
import { getDict } from "@/lib/i18n/server";
import { contentFor, templateLangs } from "@/lib/invitation/variants";
import { getPublishedTemplate, localizeTemplate } from "@/lib/templates";

type Params = Promise<{ modele: string }>;
type Search = Promise<{ langue?: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { modele } = await params;
  const { lang, t } = await getDict();
  const found = await getPublishedTemplate(modele);
  const name = found ? localizeTemplate(found.template, lang).name : "";
  return { title: found ? fmt(t.demo.metaTitle, { name }) : t.demo.badge, robots: { index: false } };
}

/**
 * Démonstration plein écran d'un modèle, avec un contenu d'exemple clairement signalé.
 * La langue de l'invitation suit celle du site si le modèle existe dans cette langue ;
 * le visiteur peut passer d'une langue disponible à l'autre (?langue=ar).
 */
export default async function DemoPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { modele } = await params;
  const { langue } = await searchParams;
  const { lang, t } = await getDict();
  const found = await getPublishedTemplate(modele);
  if (!found?.definition) notFound();
  const { definition } = found;
  const template = localizeTemplate(found.template, lang);
  const langs = templateLangs(definition);
  const shown = isSiteLang(langue) && langs.includes(langue) ? langue : langs.includes(lang) ? lang : langs[0];
  const { protection } = await getSettings();
  const href = (p: string) => localePath(lang, p);

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-50 flex items-center justify-between gap-3 bg-charcoal/85 px-4 py-2 text-[0.72rem] text-ivory backdrop-blur">
        <span className="min-w-0 truncate">
          <strong className="font-normal uppercase tracking-[0.2em]">{t.demo.badge}</strong> · {template.name} — {t.demo.fictive}
        </span>
        <span className="flex shrink-0 items-center gap-4">
          {langs.length > 1 ? (
            <nav aria-label={t.demo.language} className="flex gap-1">
              {langs.map((l) => (
                <Link
                  key={l}
                  href={`${href(`/demo/${template.slug}`)}?langue=${l}`}
                  hrefLang={l}
                  aria-current={l === shown ? "true" : undefined}
                  title={LANG_META[l].native}
                  className={`rounded-full px-2 py-0.5 ${l === shown ? "bg-ivory text-charcoal" : "hover:underline"}`}
                >
                  {LANG_META[l].short}
                </Link>
              ))}
            </nav>
          ) : null}
          <Link href={href(`/invitations/${template.slug}`)} className="underline-offset-4 hover:underline">{t.demo.back}</Link>
          <Link href={href(`/personnalisation/${template.slug}?langue=${shown}`)} className="underline underline-offset-4">{t.demo.choose}</Link>
        </span>
      </div>
      <div className="pt-9">
        {protection.deterrents ? (
          <CopyGuard message={t.demo.fictive}>
            <InvitationView key={shown} content={contentFor(definition, shown)} renderer={definition.renderer} mode="demo" />
          </CopyGuard>
        ) : (
          <InvitationView key={shown} content={contentFor(definition, shown)} renderer={definition.renderer} mode="demo" />
        )}
      </div>
      {protection.demoWatermark ? <Watermark text={protection.watermarkText || `${t.demo.badge} · E-INVITLY`} /> : null}
    </>
  );
}
