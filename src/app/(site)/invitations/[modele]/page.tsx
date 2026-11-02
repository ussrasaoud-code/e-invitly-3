import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InvitationView } from "@/components/invitation/InvitationView";
import { PhoneFrame } from "@/components/site/PhoneFrame";
import { LANG_META, fmt, localePath } from "@/lib/i18n/config";
import { pageMetadata } from "@/lib/i18n/metadata";
import { getDict } from "@/lib/i18n/server";
import { contentFor, templateLangs } from "@/lib/invitation/variants";
import { getPublishedTemplate, localizeTemplate } from "@/lib/templates";

type Params = Promise<{ modele: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { modele } = await params;
  const { lang, t } = await getDict();
  const found = await getPublishedTemplate(modele);
  if (!found) return { title: t.template.notFound };
  const tp = localizeTemplate(found.template, lang);
  return pageMetadata(lang, `/invitations/${tp.slug}`, { title: fmt(t.template.metaTitle, { name: tp.name }), description: tp.short_description });
}

export default async function TemplatePage({ params }: { params: Params }) {
  const { modele } = await params;
  const { lang, t } = await getDict();
  const found = await getPublishedTemplate(modele);
  if (!found) notFound();
  const { definition } = found;
  const template = localizeTemplate(found.template, lang);
  const href = (p: string) => localePath(lang, p);
  const images = [template.cover_image, ...(template.gallery ?? [])].filter(Boolean) as string[];
  const catLabel = t.categories[template.category as keyof typeof t.categories] ?? template.category;
  const styles = template.styles.map((s) => t.styles[s as keyof typeof t.styles] ?? s);
  const langs = definition ? templateLangs(definition) : [];

  return (
    <main className="px-5 pb-24 pt-10 md:pt-16">
      <div className="mx-auto max-w-6xl">
        <nav aria-label={t.template.breadcrumb} className="text-sm text-stone">
          <Link href={href("/invitations")} className="hover:text-forest">{t.nav.invitations}</Link> <span aria-hidden="true">/</span>{" "}
          <span className="text-charcoal">{template.name}</span>
        </nav>
        <div className="mt-8 grid gap-14 md:grid-cols-[1fr_auto] md:gap-20">
          <div>
            <p className="eyebrow">{[catLabel, ...styles].join(" · ")}</p>
            <h1 className="mt-4 font-serif text-5xl md:text-6xl">{template.name}</h1>
            <p className="mt-6 max-w-xl text-[1.06rem] leading-relaxed text-stone">{template.description}</p>
            {template.price_label ? <p className="mt-6 font-serif text-2xl">{template.price_label}</p> : null}
            {langs.length > 1 ? (
              <p className="mt-3 text-sm text-stone">{fmt(t.cards.languages, { list: langs.map((l) => LANG_META[l].native).join(" · ") })}</p>
            ) : null}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href={href(`/personnalisation/${template.slug}`)} className="btn btn-primary">
                {t.template.request}
              </Link>
              <Link href={href(`/demo/${template.slug}`)} className="btn btn-secondary">
                {t.template.fullDemo}
              </Link>
            </div>
            {template.features.length ? (
              <div className="mt-12">
                <h2 className="eyebrow">{t.template.features}</h2>
                <ul className="mt-5 grid gap-x-8 gap-y-3 sm:grid-cols-2">
                  {template.features.map((f) => (
                    <li key={f} className="flex items-start gap-3 text-[0.98rem]">
                      <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 rotate-45 bg-sage" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {images.length ? (
              <div className="mt-14 grid grid-cols-2 gap-4">
                {images.map((src, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={src} src={src} alt={fmt(t.template.visual, { name: template.name, n: i + 1 })} className="aspect-[3/4] w-full bg-paper object-cover" loading="lazy" />
                ))}
              </div>
            ) : null}
          </div>
          <div className="md:sticky md:top-28 md:self-start">
            {definition ? (
              <>
                <PhoneFrame label={fmt(t.template.phoneLabel, { name: template.name })}>
                  <InvitationView content={contentFor(definition, lang)} renderer={definition.renderer} mode="demo" framed />
                </PhoneFrame>
                <p className="mt-4 text-center text-xs italic text-stone">{t.template.phoneNote}</p>
              </>
            ) : (
              <p className="text-sm text-stone">{t.template.noPreview}</p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
