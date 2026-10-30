import type { Metadata } from "next";
import { PolicyPage } from "@/components/site/PolicyPage";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Mentions légales" };

export default async function Page() {
  const { policies } = await getSettings();
  return <PolicyPage title="Mentions légales" body={policies.legalNotice} fallback={<p>Les mentions légales sont en cours de rédaction.</p>} />;
}
