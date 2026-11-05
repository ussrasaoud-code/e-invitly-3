import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { RequestForm } from "@/app/(site)/personnalisation/[modele]/RequestForm";
import { CoupleHeader } from "@/components/couple/CoupleHeader";
import { CoupleHelp } from "@/components/contact/CoupleHelp";
import { getCurrentUser } from "@/lib/auth";
import { LANG_META, SITE_LANGS, fmt, isSiteLang, type SiteLang } from "@/lib/i18n/config";
import { dictFor, getEnabledLangs, getPreferredLang } from "@/lib/i18n/server";
import { getSettings } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getPreferredLang();
  return { title: dictFor(lang).order.detailsMeta, robots: { index: false } };
}

/**
 * Formulaire détaillé de la commande, dans l'espace client (après le paiement).
 * L'accès à l'invitation est vérifié avec la session du client (règles de la base).
 */
export default async function OrderDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const user = await getCurrentUser();
  if (!user) redirect(`/connexion?suite=${encodeURIComponent(`/mon-espace/${id}/informations`)}`);
  const supabase = (await createClient())!;
  const { data: inv } = await supabase.from("invitations").select("id, title, language, templates(slug, name)").eq("id", id).maybeSingle();
  if (!inv) notFound();

  const db = createAdminClient();
  if (!db) notFound();
  const [{ data: req }, { data: payments }] = await Promise.all([
    db.from("client_requests").select("language, partner_one, partner_two, event_date, form_data").eq("invitation_id", id).maybeSingle(),
    db.from("payments").select("token, status").eq("invitation_id", id).order("created_at", { ascending: false }),
  ]);
  const fd = (req?.form_data ?? {}) as { selfService?: boolean; detailsAt?: string; secondLanguage?: string };
  if (!req || !fd.selfService) redirect(`/mon-espace/${id}`);

  const lang = await getPreferredLang(inv.language);
  const d = dictFor(lang);
  const o = d.order;
  const { brand } = await getSettings();
  const paid = payments?.some((p) => p.status === "paid");
  const pending = payments?.find((p) => p.status === "pending");
  const tpl = inv.templates as unknown as { slug: string; name: string } | null;
  const invLang: SiteLang = isSiteLang(req.language) ? req.language : "fr";
  const enabled = await getEnabledLangs();
  const second = SITE_LANGS.find((l) => l === fd.secondLanguage) ?? "";

  return (
    <div className="min-h-dvh bg-ivory" lang={lang} dir={LANG_META[lang].dir}>
      <CoupleHeader lang={lang} logout={d.couple.logout} languageLabel={d.couple.language} />
      <main className="mx-auto max-w-3xl px-5 py-10">
        <Link href="/mon-espace" className="text-sm text-stone hover:text-forest">{d.couple.back}</Link>
        <p className="eyebrow mt-6">{inv.title}</p>
        <h1 className="mt-3 font-serif text-4xl">{o.detailsTitle}</h1>
        {!paid ? (
          <div className="card mt-8 p-6">
            <p>{o.detailsNotPaid}</p>
            {pending ? <Link href={`/paiement/${pending.token}`} className="btn btn-primary mt-4">{o.bannerPayButton}</Link> : null}
          </div>
        ) : fd.detailsAt ? (
          <div role="status" className="card mt-8 p-6 leading-relaxed">
            <p className="font-serif text-2xl">{o.detailsSentTitle}</p>
            <p className="mt-2">{o.bannerReceived}</p>
            <p className="mt-3 text-sm text-stone">{fmt(o.detailsLocked, { date: new Intl.DateTimeFormat(LANG_META[lang].intl, { dateStyle: "long" }).format(new Date(fd.detailsAt)) })}</p>
          </div>
        ) : (
          <>
            <p className="mt-4 leading-relaxed text-stone">{o.detailsIntro}</p>
            <div className="mt-10">
              <RequestForm
                mode="details"
                invitationId={id}
                templateSlug={tpl?.slug ?? ""}
                templateName={tpl?.name ?? ""}
                t={d.request}
                rsvpT={d.rsvpSetup}
                detailsT={o}
                lang={lang}
                invitationLang={invLang}
                languages={enabled}
                initial={{ partnerOne: req.partner_one ?? "", partnerTwo: req.partner_two ?? "", eventDate: req.event_date ?? "", language: invLang, secondLanguage: second }}
              />
            </div>
          </>
        )}
        <CoupleHelp brand={brand} t={d.contact} couple={inv.title} />
      </main>
    </div>
  );
}
