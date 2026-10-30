import Link from "next/link";
import { Sprig } from "@/components/ornaments";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 text-center">
      <Sprig className="h-24 w-14 text-forest" fill="#A6B5A2" />
      <h1 className="mt-6 font-serif text-4xl">Page introuvable</h1>
      <p className="mt-3 max-w-sm text-stone">
        Cette page n&apos;existe pas ou n&apos;est plus disponible. Si vous cherchez une invitation, vérifiez le lien reçu.
      </p>
      <Link href="/" className="btn btn-secondary mt-8">Retour à l&apos;accueil</Link>
    </main>
  );
}
