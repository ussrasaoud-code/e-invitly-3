import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SetupNotice } from "@/components/site/SetupNotice";
import { isSupabaseConfigured } from "@/lib/env";
import { getPublishedTemplate } from "@/lib/templates";
import { RequestForm } from "./RequestForm";

type Params = Promise<{ modele: string }>;

export const metadata: Metadata = { title: "Demande de personnalisation", robots: { index: false } };

export default async function PersonalisationPage({ params }: { params: Params }) {
  const { modele } = await params;
  if (!isSupabaseConfigured()) {
    return (
      <main className="px-5 py-20">
        <SetupNotice what="le formulaire de demande" />
      </main>
    );
  }
  const found = await getPublishedTemplate(modele);
  if (!found) notFound();
  const { template } = found;
  return (
    <main className="px-5 pb-24 pt-10 md:pt-14">
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1fr_300px]">
        <div>
          <p className="eyebrow">Demande de personnalisation</p>
          <h1 className="mt-3 font-serif text-4xl md:text-5xl">Votre invitation « {template.name} »</h1>
          <p className="mt-4 max-w-2xl leading-relaxed text-stone">
            Quelques minutes suffisent. Remplissez ce que vous savez déjà : nous reviendrons vers vous pour compléter
            le reste avant de vous présenter un aperçu.
          </p>
          <div className="mt-10">
            <RequestForm templateSlug={template.slug} templateName={template.name} />
          </div>
        </div>
        <aside className="hidden lg:block">
          <div className="sticky top-28">
            {template.cover_image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={template.cover_image} alt={`Modèle ${template.name}`} className="aspect-[3/4] w-full bg-paper object-cover" />
            ) : null}
            <p className="mt-4 font-serif text-2xl">{template.name}</p>
            <p className="mt-1 text-sm text-stone">{template.short_description}</p>
            <Link href={`/demo/${template.slug}`} className="mt-3 inline-block text-sm text-forest underline underline-offset-4" target="_blank">
              Revoir la démo
            </Link>
          </div>
        </aside>
      </div>
    </main>
  );
}
