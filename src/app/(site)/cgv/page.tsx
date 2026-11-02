import type { Metadata } from "next";
import { PolicyPage } from "@/components/site/PolicyPage";
import { pageMetadata } from "@/lib/i18n/metadata";
import { getDict } from "@/lib/i18n/server";
import { getSettings } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  const { lang, t } = await getDict();
  return pageMetadata(lang, "/cgv", { title: t.legal.terms });
}

export default async function Page() {
  const { lang, t } = await getDict();
  const { policies } = await getSettings();
  return (
    <PolicyPage
      title={t.legal.terms}
      body={policies.termsOfSale}
      frenchNote={lang === "fr" ? undefined : t.legal.frenchOnly}
      fallback={<p>{t.legal.termsPending}</p>}
    />
  );
}
