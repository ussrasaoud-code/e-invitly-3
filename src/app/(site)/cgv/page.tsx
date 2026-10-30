import type { Metadata } from "next";
import { PolicyPage } from "@/components/site/PolicyPage";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Conditions générales de vente" };

export default async function Page() {
  const { policies } = await getSettings();
  return (
    <PolicyPage
      title="Conditions générales de vente"
      body={policies.termsOfSale}
      fallback={<p>Les conditions générales de vente seront publiées ici dès qu&apos;elles seront établies.</p>}
    />
  );
}
