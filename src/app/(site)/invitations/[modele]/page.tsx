import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InvitationView } from "@/components/invitation/InvitationView";
import { PhoneFrame } from "@/components/site/PhoneFrame";
import { categoryLabel, styleLabel } from "@/lib/catalog";
import { getPublishedTemplate } from "@/lib/templates";

type Params = Promise<{ modele: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { modele } = await params;
  const found = await getPublishedTemplate(modele);
  return found
    ? { title: `Modèle ${found.template.name}`, description: found.template.short_description }
    : { title: "Modèle introuvable" };
}

export default async function TemplatePage({ params }: { params: Params }) {
  const { modele } = await params;
  const found = await getPublishedTemplate(modele);
  if (!found) notFound();
  const { template, definition } = found;
  const images = [template.cover_image, ...(template.gallery ?? [])].filter(Boolean) as string[];

  return (
    <main className="px-5 pb-24 pt-10 md:pt-16">
      <div className="mx-auto max-w-6xl">
        <nav aria-label="Fil d'Ariane" className="text-sm text-stone">
          <Link href="/invitations" className="hover:text-forest">Invitations</Link> <span aria-hidden="true">/</span>{" "}
          <span className="text-charcoal">{template.name}</span>
        </nav>
        <div className="mt-8 grid gap-14 md:grid-cols-[1fr_auto] md:gap-20">
          <div>
            <p className="eyebrow">{categoryLabel(template.category)} · {template.styles.map(styleLabel).join(" · ")}</p>
            <h1 className="mt-4 font-serif text-5xl md:text-6xl">{template.name}</h1>
            <p className="mt-6 max-w-xl text-[1.06rem] leading-relaxed text-stone">{template.description}</p>
            {template.price_label ? <p className="mt-6 font-serif text-2xl">{template.price_label}</p> : null}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href={`/personnalisation/${template.slug}`} className="btn btn-primary">
                Demander ce modèle
              </Link>
              <Link href={`/demo/${template.slug}`} className="btn btn-secondary">
                Ouvrir la démo plein écran
              </Link>
            </div>
            {template.features.length ? (
              <div className="mt-12">
                <h2 className="eyebrow">Fonctionnalités incluses</h2>
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
                  <img key={src} src={src} alt={`${template.name} — visuel ${i + 1}`} className="aspect-[3/4] w-full bg-paper object-cover" loading="lazy" />
                ))}
              </div>
            ) : null}
          </div>
          <div className="md:sticky md:top-28 md:self-start">
            {definition ? (
              <>
                <PhoneFrame label={`Aperçu mobile du modèle ${template.name}`}>
                  <InvitationView content={definition.sample} renderer={definition.renderer} mode="demo" framed />
                </PhoneFrame>
                <p className="mt-4 text-center text-xs italic text-stone">Aperçu mobile — contenu de démonstration</p>
              </>
            ) : (
              <p className="text-sm text-stone">L&apos;aperçu de ce modèle n&apos;est pas encore disponible.</p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
