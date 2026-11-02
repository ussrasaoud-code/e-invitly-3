import type { Metadata } from "next";
import Link from "next/link";
import { Sprig } from "@/components/ornaments";
import { localePath } from "@/lib/i18n/config";
import { getDict } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDict();
  return { title: t.thanks.metaTitle, robots: { index: false } };
}

export default async function ThanksPage({ searchParams }: { searchParams: Promise<{ ref?: string; email?: string }> }) {
  const { ref, email } = await searchParams;
  const { lang, t } = await getDict();
  const m = t.thanks;
  const reference = ref && /^EI-\d{4}-\d{4,}$/.test(ref) ? ref : null;
  return (
    <main className="px-5 py-20 text-center md:py-28">
      <Sprig className="mx-auto h-28 w-16 text-forest" fill="#A6B5A2" />
      <p className="mt-6 font-script text-4xl text-forest">{m.script}</p>
      <h1 className="mt-3 font-serif text-4xl md:text-5xl">{m.title}</h1>
      {reference ? (
        <p className="mt-6 text-stone">
          {m.reference} <strong className="font-medium text-charcoal" dir="ltr">{reference}</strong>
        </p>
      ) : null}
      <p className="mx-auto mt-4 max-w-lg leading-relaxed text-stone">
        {email === "1" ? m.emailSent : m.keepRef} {m.next}
      </p>
      <Link href={localePath(lang, "/")} className="btn btn-secondary mt-10">
        {m.home}
      </Link>
    </main>
  );
}
