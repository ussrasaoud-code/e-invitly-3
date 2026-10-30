import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InvitationView } from "@/components/invitation/InvitationView";
import { getPublishedTemplate } from "@/lib/templates";

type Params = Promise<{ modele: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { modele } = await params;
  const found = await getPublishedTemplate(modele);
  return { title: found ? `Démo — ${found.template.name}` : "Démo", robots: { index: false } };
}

/** Démonstration plein écran d'un modèle, avec un contenu d'exemple clairement signalé. */
export default async function DemoPage({ params }: { params: Params }) {
  const { modele } = await params;
  const found = await getPublishedTemplate(modele);
  if (!found?.definition) notFound();
  const { template, definition } = found;
  return (
    <>
      <div className="fixed inset-x-0 top-0 z-50 flex items-center justify-between gap-3 bg-charcoal/85 px-4 py-2 text-[0.72rem] text-ivory backdrop-blur">
        <span>
          <strong className="font-normal uppercase tracking-[0.2em]">Démo</strong> · {template.name} — contenu fictif
        </span>
        <span className="flex gap-4">
          <Link href={`/invitations/${template.slug}`} className="underline-offset-4 hover:underline">Retour</Link>
          <Link href={`/personnalisation/${template.slug}`} className="underline underline-offset-4">Choisir ce modèle</Link>
        </span>
      </div>
      <div className="pt-9">
        <InvitationView content={definition.sample} renderer={definition.renderer} mode="demo" />
      </div>
    </>
  );
}
