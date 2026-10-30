import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Connexion", robots: { index: false } };

const ERRORS: Record<string, string> = {
  acces: "Votre compte n'a pas accès à cet espace.",
  lien: "Ce lien de connexion n'est plus valable. Demandez-en un nouveau.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ suite?: string; erreur?: string }> }) {
  const { suite, erreur } = await searchParams;
  return (
    <main className="px-5 py-20 md:py-28">
      <div className="mx-auto max-w-md">
        <p className="eyebrow text-center">Espace privé</p>
        <h1 className="mt-3 text-center font-serif text-4xl">Connexion</h1>
        <p className="mt-4 text-center leading-relaxed text-stone">
          Saisissez votre adresse e-mail : nous vous envoyons un lien de connexion sécurisé, sans mot de passe.
        </p>
        {erreur && ERRORS[erreur] ? (
          <p role="alert" className="mt-6 border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
            {ERRORS[erreur]}
          </p>
        ) : null}
        <div className="mt-8">
          <LoginForm next={suite ?? "/mon-espace"} />
        </div>
      </div>
    </main>
  );
}
