import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CoupleHeader } from "@/components/couple/CoupleHeader";
import { CoupleHelp } from "@/components/contact/CoupleHelp";
import { getSettings } from "@/lib/settings";
import { getCurrentUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { LANG_META, fmt, localePath } from "@/lib/i18n/config";
import { dictFor, getPreferredLang } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getPreferredLang();
  return { title: dictFor(lang).couple.metaTitle, robots: { index: false } };
}

/** Espace des mariés : uniquement LEURS invitations (règles RLS côté base). */
export default async function ClientSpace() {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion?suite=/mon-espace");
  const supabase = (await createClient())!;
  const [{ data: invitations }, { data: stats }] = await Promise.all([
    supabase.from("invitations").select("id, title, slug, status, event_at, language").neq("status", "archived").order("event_at"),
    supabase.from("rsvp_stats").select("*"),
  ]);
  const lang = await getPreferredLang(invitations?.[0]?.language);
  const t = dictFor(lang).couple;
  const { brand } = await getSettings();
  const byId = new Map((stats ?? []).map((s) => [s.invitation_id, s]));
  const host = env.siteUrl.replace(/^https?:\/\//, "");
  const date = (v: string | null) => (v ? new Intl.DateTimeFormat(LANG_META[lang].intl, { dateStyle: "long", timeZone: "Europe/Paris" }).format(new Date(v)) : "");
  return (
    <div className="min-h-dvh bg-ivory" lang={lang} dir={LANG_META[lang].dir}>
      <CoupleHeader lang={lang} logout={t.logout} languageLabel={t.language} />
      <main className="mx-auto max-w-3xl px-5 py-12">
        <p className="eyebrow">{t.eyebrow}</p>
        <h1 className="mt-3 font-serif text-4xl">{t.hello}</h1>
        <p className="mt-2 text-sm text-stone">{fmt(t.connectedAs, { email: user.email })}</p>
        {invitations?.length ? (
          <ul className="mt-8 space-y-4">
            {invitations.map((i) => {
              const s = byId.get(i.id);
              const live = i.status === "published";
              return (
                <li key={i.id} className="card p-5">
                  <h2 className="font-serif text-2xl">{i.title}</h2>
                  <p className="text-sm text-stone">{date(i.event_at)}</p>
                  <p className="mt-3 text-sm">
                    {live ? (
                      <>
                        {t.yourLink} <a className="text-forest underline" dir="ltr" href={`/${i.slug}`}>{host}/{i.slug}</a>
                      </>
                    ) : (
                      t.preparing
                    )}
                  </p>
                  <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      [t.sResponses, s?.responses ?? 0],
                      [t.sConfirmed, s?.confirmed_people ?? 0],
                      [t.sCompanions, s?.companions ?? 0],
                      [t.sDeclined, s?.declined_responses ?? 0],
                    ].map(([k, v]) => (
                      <div key={k as string}>
                        <dt className="text-xs text-stone">{k}</dt>
                        <dd className="font-serif text-2xl lining-nums tabular-nums">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <Link href={`/mon-espace/${i.id}`} className="btn btn-primary btn-sm mt-5">{t.seeAll}</Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="card mt-8 p-6 text-sm text-stone">
            {t.none}{" "}
            <Link href={localePath(lang, "/")} className="text-forest underline">{t.backSite}</Link>
          </p>
        )}
        <CoupleHelp brand={brand} t={dictFor(lang).contact} couple={invitations?.length === 1 ? invitations[0].title : undefined} />
      </main>
    </div>
  );
}
