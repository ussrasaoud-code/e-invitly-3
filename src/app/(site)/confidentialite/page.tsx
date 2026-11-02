import type { Metadata } from "next";
import { PolicyPage } from "@/components/site/PolicyPage";
import { fmt } from "@/lib/i18n/config";
import { pageMetadata } from "@/lib/i18n/metadata";
import { getDict } from "@/lib/i18n/server";
import { getSettings } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  const { lang, t } = await getDict();
  return pageMetadata(lang, "/confidentialite", { title: t.legal.privacy });
}

export default async function Page() {
  const { lang, t } = await getDict();
  const { policies, brand } = await getSettings();
  const l = t.legal;
  return (
    <PolicyPage
      title={l.privacy}
      body={policies.privacyPolicy}
      frenchNote={lang === "fr" ? undefined : l.frenchOnly}
      fallback={
        <>
          <p className="italic text-stone">{l.privacyIntro}</p>
          {l.privacySections.map((s) => (
            <section key={s.title}>
              <h2>{s.title}</h2>
              <p>{s.text}</p>
            </section>
          ))}
          <h2>{l.rightsTitle}</h2>
          <p>{brand.contactEmail ? fmt(l.rightsWithEmail, { email: brand.contactEmail }) : l.rights}</p>
        </>
      }
    />
  );
}
