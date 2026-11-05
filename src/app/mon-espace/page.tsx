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
import { createAdminClient } from "@/lib/supabase/admin";
import { ProjectTimeline, type ProjectState } from "@/components/couple/ProjectTimeline";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getPreferredLang();
  return { title: dictFor(lang).couple.metaTitle, robots: { index: false } };
}

/** Espace des mariés : uniquement LEURS invitations (règles RLS côté base). */
export default async function ClientSpace() {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion?suite=/mon-espace");
  const supabase = (await createClient())!;
  const [{ data: invitations }, { data: stats }, { data: tokens }] = await Promise.all([
    supabase.from("invitations").select("id, title, slug, status, event_at, language, templates(name, category)").neq("status", "archived").order("event_at"),
    supabase.from("rsvp_stats").select("*"),
    // Liens privés des groupes d'invités (colonne ajoutée par la migration « groupes_invites » ; ignorée si absente)
    supabase.from("invitations").select("id, private_links, groups:draft_content->guestGroups"),
  ]);
  const privateLinks = new Map(
    (tokens ?? []).map((x) => {
      const links = (x.private_links ?? {}) as Record<string, string>;
      const names = new Map(((x.groups ?? []) as Array<{ id: string; name: string }>).map((g) => [g.id, g.name]));
      return [x.id as string, Object.entries(links).map(([id, token]) => ({ name: names.get(id) ?? id, token }))];
    }),
  );
  // Commandes en ligne : paiement puis formulaire détaillé (ids issus de la lecture protégée ci-dessus)
  const ids = (invitations ?? []).map((i) => i.id);
  const admin = ids.length ? createAdminClient() : null;
  const [{ data: orderRows }, { data: payRows }, { data: previewRows }] = admin
    ? await Promise.all([
        admin.from("client_requests").select("invitation_id, form_data").in("invitation_id", ids),
        admin.from("payments").select("invitation_id, token, status").in("invitation_id", ids).order("created_at", { ascending: false }),
        admin.from("preview_tokens").select("invitation_id").in("invitation_id", ids),
      ])
    : [{ data: null }, { data: null }, { data: null }];
  const lang = await getPreferredLang(invitations?.[0]?.language);
  const o = dictFor(lang).order;
  const cats = dictFor(lang).categories as Record<string, string>;
  const project = (i: NonNullable<typeof invitations>[number]): ProjectState => {
    const fd = ((orderRows ?? []).find((r) => r.invitation_id === i.id)?.form_data ?? {}) as { selfService?: boolean; detailsAt?: string; validatedAt?: string; eventType?: string };
    const pays = (payRows ?? []).filter((p) => p.invitation_id === i.id);
    const tpl = i.templates as unknown as { name: string; category: string } | null;
    return {
      id: i.id,
      eventLabel: cats[fd.eventType ?? tpl?.category ?? "mariage"] ?? cats.mariage,
      templateName: tpl?.name ?? "",
      selfService: !!fd.selfService,
      paid: pays.some((p) => p.status === "paid"),
      payToken: pays.find((p) => p.status === "pending")?.token as string | undefined,
      detailsAt: fd.detailsAt ?? null,
      previewSent: (previewRows ?? []).some((p) => p.invitation_id === i.id),
      validatedAt: fd.validatedAt ?? null,
      status: i.status,
      responses: byId.get(i.id)?.responses ?? 0,
    };
  };
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
                  <ProjectTimeline p={project(i)} o={o} date={(iso) => new Intl.DateTimeFormat(LANG_META[lang].intl, { dateStyle: "long" }).format(new Date(iso))} />
                  <p className="mt-3 text-sm">
                    {live && privateLinks.get(i.id)?.length ? (
                      <span className="block space-y-1">
                        <span className="block">{t.mainLink} <a className="text-forest underline" dir="ltr" href={`/${i.slug}`}>{host}/{i.slug}</a></span>
                        {privateLinks.get(i.id)!.map((l) => (
                          <span key={l.token} className="block">
                            {fmt(t.groupLink, { name: l.name })} <a className="break-all text-forest underline" dir="ltr" href={`/${i.slug}?g=${encodeURIComponent(l.token)}`}>{host}/{i.slug}?g={l.token}</a>
                          </span>
                        ))}
                        <span className="block text-xs text-stone">{t.groupHint}</span>
                      </span>
                    ) : live ? (
                      <>
                        {t.yourLink} <a className="text-forest underline" dir="ltr" href={`/${i.slug}`}>{host}/{i.slug}</a>
                      </>
                    ) : null /* l'avancement est détaillé dans « Votre projet » */}
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
