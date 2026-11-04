import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { Sprig } from "@/components/ornaments";
import { InvitationView } from "@/components/invitation/InvitationView";
import { headers } from "next/headers";
import { LangSwitch } from "@/components/invitation/LangSwitch";
import { forGroup } from "@/lib/invitation/audience";
import { contentInLang, invitationLangs, pickLang } from "@/lib/invitation/bilingual";
import { groupForToken, loadPublicInvitation } from "@/lib/publication";
import { getPublicRsvpConfig } from "@/lib/rsvp-server";
import { CodeForm } from "./CodeForm";

/**
 * Invitation publiée : e-invitly.com/<adresse>.
 * Une seule route pour toutes les invitations : publier = écrire en base,
 * jamais redéployer. Seule la version publiée est lue, jamais le brouillon.
 */
type Params = Promise<{ slug: string }>;
type Search = Promise<{ g?: string; langue?: string }>;

const load = loadPublicInvitation;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const inv = await load(decodeURIComponent(slug).toLowerCase());
  if (!inv || inv.kind !== "ok") return { title: "Invitation", robots: { index: false, follow: false } };
  const { couple, mainVenue } = inv.content;
  const title = `${couple.partnerOne} & ${couple.partnerTwo}`;
  return {
    title: { absolute: title },
    description: mainVenue.name ? `Invitation — ${mainVenue.name}` : "Invitation",
    robots: inv.noindex ? { index: false, follow: false } : undefined,
    openGraph: { title, type: "website" },
  };
}

export default async function PublicInvitationPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw).toLowerCase();
  const inv = await load(slug);
  if (!inv) notFound();
  if (inv.kind === "redirect") permanentRedirect(`/${inv.to}`);
  if (raw !== slug) permanentRedirect(`/${slug}`);

  if (inv.kind === "locked") {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-ivory px-5 paper-texture">
        <div className="w-full max-w-sm text-center">
          <Sprig className="mx-auto h-24 w-14 text-forest" fill="#A6B5A2" />
          <h1 className="mt-6 font-serif text-3xl">Invitation privée</h1>
          <p className="mt-3 text-sm leading-relaxed text-stone">
            Cette invitation est protégée. Saisissez le code qui vous a été communiqué avec le lien.
          </p>
          <CodeForm slug={slug} />
        </div>
      </main>
    );
  }

  // Lien privé d'un groupe d'invités : le jeton est vérifié ici ; sinon seuls les moments ouverts à tous sont envoyés
  const { g, langue } = await searchParams;
  const group = await groupForToken(inv.invitationId, g);
  // Invitation en deux langues : ?langue=…, sinon la langue du téléphone si elle est proposée
  const langs = invitationLangs(inv.content);
  const lang = pickLang(langs, langue, (await headers()).get("accept-language"));
  const content = forGroup(contentInLang(inv.content, lang), group);
  const base = await getPublicRsvpConfig(inv.invitationId);
  const rsvp = base && group ? { ...base, groupToken: g } : base;
  const hrefFor = (l: string) => {
    const q = new URLSearchParams();
    if (g) q.set("g", g);
    q.set("langue", l);
    return `/${inv.slug}?${q.toString()}`;
  };
  return (
    <>
      <LangSwitch langs={langs} current={lang} hrefFor={hrefFor} />
      <InvitationView key={lang} content={content} renderer={inv.renderer} mode="live" slug={inv.slug} rsvp={rsvp} />
    </>
  );
}
