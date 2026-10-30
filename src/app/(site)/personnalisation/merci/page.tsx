import type { Metadata } from "next";
import Link from "next/link";
import { Sprig } from "@/components/ornaments";

export const metadata: Metadata = { title: "Demande envoyée", robots: { index: false } };

export default async function ThanksPage({ searchParams }: { searchParams: Promise<{ ref?: string; email?: string }> }) {
  const { ref, email } = await searchParams;
  const reference = ref && /^EI-\d{4}-\d{4,}$/.test(ref) ? ref : null;
  return (
    <main className="px-5 py-20 text-center md:py-28">
      <Sprig className="mx-auto h-28 w-16 text-forest" fill="#A6B5A2" />
      <p className="mt-6 font-script text-4xl text-forest">Merci !</p>
      <h1 className="mt-3 font-serif text-4xl md:text-5xl">Votre demande est bien arrivée</h1>
      {reference ? (
        <p className="mt-6 text-stone">
          Votre référence : <strong className="font-medium text-charcoal">{reference}</strong>
        </p>
      ) : null}
      <p className="mx-auto mt-4 max-w-lg leading-relaxed text-stone">
        {email === "1"
          ? "Un e-mail de confirmation vient de vous être envoyé. "
          : "Conservez cette référence : elle nous permettra de retrouver votre demande. "}
        Nous préparons votre invitation et revenons vers vous avec un aperçu à valider. Rien ne sera publié sans votre accord.
      </p>
      <Link href="/" className="btn btn-secondary mt-10">
        Retour à l&apos;accueil
      </Link>
    </main>
  );
}
