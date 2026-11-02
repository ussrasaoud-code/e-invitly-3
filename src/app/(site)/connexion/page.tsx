import type { Metadata } from "next";
import { getDict } from "@/lib/i18n/server";
import { LoginForm } from "./LoginForm";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDict();
  return { title: t.login.metaTitle, robots: { index: false } };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ suite?: string; erreur?: string }> }) {
  const { suite, erreur } = await searchParams;
  const { lang, t } = await getDict();
  const l = t.login;
  const ERRORS: Record<string, string> = { acces: l.noAccess, lien: l.expired };
  return (
    <main className="px-5 py-20 md:py-28">
      <div className="mx-auto max-w-md">
        <p className="eyebrow text-center">{l.eyebrow}</p>
        <h1 className="mt-3 text-center font-serif text-4xl">{l.title}</h1>
        <p className="mt-4 text-center leading-relaxed text-stone">{l.intro}</p>
        {erreur && ERRORS[erreur] ? (
          <p role="alert" className="mt-6 border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
            {ERRORS[erreur]}
          </p>
        ) : null}
        <div className="mt-8">
          <LoginForm next={suite ?? "/mon-espace"} t={l} lang={lang} />
        </div>
      </div>
    </main>
  );
}
