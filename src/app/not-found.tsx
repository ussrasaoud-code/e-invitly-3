import Link from "next/link";
import { Sprig } from "@/components/ornaments";
import { localePath } from "@/lib/i18n/config";
import { getDict } from "@/lib/i18n/server";

export default async function NotFound() {
  const { lang, t } = await getDict();
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 text-center">
      <Sprig className="h-24 w-14 text-forest" fill="#A6B5A2" />
      <h1 className="mt-6 font-serif text-4xl">{t.notFound.title}</h1>
      <p className="mt-3 max-w-sm text-stone">{t.notFound.text}</p>
      <Link href={localePath(lang, "/")} className="btn btn-secondary mt-8">{t.notFound.home}</Link>
    </main>
  );
}
