import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CoupleHeader } from "@/components/couple/CoupleHeader";
import { CoupleHelp } from "@/components/contact/CoupleHelp";
import { getSettings } from "@/lib/settings";
import { getCurrentUser } from "@/lib/auth";
import { publicUrl } from "@/lib/publication";
import { loadRsvpOverview } from "@/lib/rsvp-data";
import { createClient } from "@/lib/supabase/server";
import { LANG_META, fmt } from "@/lib/i18n/config";
import { dictFor, getPreferredLang } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getPreferredLang();
  return { title: dictFor(lang).couple.metaResponses, robots: { index: false } };
}

/**
 * Réponses d'une invitation, pour le couple.
 * Lecture avec la session du couple : la base ne renvoie rien pour une
 * invitation qui ne lui appartient pas (même en changeant l'adresse).
 */
export default async function CoupleResponses({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ presence?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion?suite=/mon-espace");
  const { id } = await params;
  const { presence = "" } = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = (await createClient())!;
  const o = await loadRsvpOverview(supabase, id);
  if (!o) notFound();

  const { data: invLang } = await supabase.from("invitations").select("language").eq("id", id).maybeSingle();
  const lang = await getPreferredLang(invLang?.language);
  const t = dictFor(lang).couple;
  const { brand } = await getSettings();
  const when = (v: string) => new Intl.DateTimeFormat(LANG_META[lang].intl, { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris" }).format(new Date(v));
  const list = o.responses.filter((r) => (presence === "oui" ? r.attending : presence === "non" ? !r.attending : true));
  const questionLabel = new Map((o.form?.questions ?? []).map((x) => [x.id, x.label]));
  const live = o.status === "published";
  const stats = [
    [t.sConfirmed, o.stats.people],
    [t.sYes, o.stats.attending],
    [t.sCompanions, o.stats.companions],
    [t.sDeclined, o.stats.declined],
    [t.sForms, o.stats.responses],
    ...(o.form?.fields.childMenus ? [[t.sChild, o.stats.childMenus]] : []),
  ] as Array<[string, number]>;

  return (
    <div className="min-h-dvh bg-ivory" lang={lang} dir={LANG_META[lang].dir}>
      <CoupleHeader lang={lang} logout={t.logout} languageLabel={t.language} />
      <main className="mx-auto max-w-4xl px-5 py-10">
        <Link href="/mon-espace" className="text-sm text-stone hover:text-forest">{t.back}</Link>
        <h1 className="mt-3 font-serif text-4xl">{o.title}</h1>
        {live ? (
          <p className="mt-2 text-sm">
            {t.shareLink} <a href={`/${o.slug}`} dir="ltr" className="break-all text-forest underline">{publicUrl(o.slug)}</a>
          </p>
        ) : (
          <p className="mt-2 text-sm text-stone">{t.notLive}</p>
        )}

        <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {stats.map(([k, v]) => (
            <div key={k} className="card p-4">
              <dd className="font-serif text-3xl lining-nums tabular-nums">{v}</dd>
              <dt className="mt-1 text-xs text-stone">{k}</dt>
            </div>
          ))}
        </dl>
        {o.events.length > 1 ? (
          <p className="mt-3 text-sm text-stone">
            {o.events.map((e) => fmt(t.perEvent, { title: e.title, n: o.byEvent[e.id] ?? 0 })).join(" · ")}
          </p>
        ) : null}

        <section className="mt-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-serif text-2xl">{t.responses}</h2>
            <form action={`/api/exports/${id}`} method="get" className="flex flex-wrap items-center gap-3 text-sm">
              <select name="format" defaultValue="xlsx" className="field min-h-9 w-auto py-1 text-sm" aria-label={t.format}>
                <option value="xlsx">Excel (.xlsx)</option>
                <option value="csv">CSV</option>
              </select>
              <label className="flex items-center gap-1.5">
                <input type="checkbox" name="regimes" value="1" className="h-4 w-4 accent-forest" />
                {t.withDiet}
              </label>
              <button type="submit" className="btn btn-secondary btn-sm">{t.download}</button>
            </form>
          </div>
          <div className="mt-4 flex gap-2">
            {[["", t.all], ["oui", t.present], ["non", t.absent]].map(([v, l]) => (
              <Link key={v} href={`/mon-espace/${id}${v ? `?presence=${v}` : ""}`} className={`rounded-full border px-3 py-1.5 text-xs ${presence === v ? "border-forest bg-forest text-ivory" : "border-line bg-white"}`}>
                {l}
              </Link>
            ))}
          </div>
          {list.length ? (
            <ul className="card mt-4 divide-y divide-line">
              {list.map((r) => (
                <li key={r.id} className="p-4 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-medium">
                      {r.first_name} {r.last_name}{" "}
                      <span className={r.attending ? "text-success" : "text-danger"}>· {r.attending ? fmt(t.attending, { n: 1 + r.companions_count }) : t.notAttending}</span>
                      {r.audience && r.audience !== "all" ? <span className="ms-2 text-xs text-forest">· {o.groups[r.audience] ?? r.audience}</span> : null}
                    </p>
                    <time className="text-xs text-stone" dateTime={r.submitted_at}>{when(r.submitted_at)}</time>
                  </div>
                  <p className="mt-1 text-stone">
                    {[
                      r.companions.length ? fmt(t.with, { names: r.companions.join(", ") }) : null,
                      r.attending && o.events.length > 1 && r.events.length ? o.events.filter((e) => r.events.includes(e.id)).map((e) => e.title).join(", ") : null,
                      r.child_menus ? fmt(t.childMenus, { n: r.child_menus }) : null,
                      r.dietary ? fmt(t.diet, { text: r.dietary }) : null,
                      ...Object.entries(r.answers).map(([k, v]) => `${questionLabel.get(k) ?? k} : ${v}`),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {r.comment ? <p className="mt-1 italic">« {r.comment} »</p> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="card mt-4 p-6 text-sm text-stone">{t.noResponse}</p>
          )}
        </section>
        <p className="mt-8 text-xs text-stone">{t.fix}</p>
        <CoupleHelp brand={brand} t={dictFor(lang).contact} couple={o.title} />
      </main>
    </div>
  );
}
