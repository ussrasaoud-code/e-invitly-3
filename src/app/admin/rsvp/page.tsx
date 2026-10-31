import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/admin/PageHeader";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatShortDate } from "@/lib/time";

export const metadata = { title: "RSVP" };

/** Vue d'ensemble des réponses, toutes invitations confondues. */
export default async function RsvpPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireStaff();
  const { q = "" } = await searchParams;
  const term = q.trim().replace(/[%,()]/g, " ").slice(0, 60);
  const supabase = (await createClient())!;

  let recentQuery = supabase
    .from("rsvp_responses")
    .select("id, invitation_id, first_name, last_name, attending, companions_count, submitted_at")
    .order("submitted_at", { ascending: false })
    .limit(term ? 100 : 15);
  if (term) recentQuery = recentQuery.or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%`);

  const [{ data: invitations }, { data: stats }, { data: recent }] = await Promise.all([
    supabase.from("invitations").select("id, title, event_at, status").neq("status", "archived").order("event_at"),
    supabase.from("rsvp_stats").select("*"),
    recentQuery,
  ]);
  const byId = new Map((stats ?? []).map((s) => [s.invitation_id, s]));
  const titles = new Map((invitations ?? []).map((i) => [i.id, i.title]));
  const active = (invitations ?? []).filter((i) => i.status === "published" || byId.get(i.id)?.responses > 0);

  return (
    <>
      <PageHeader title="RSVP" description="Choisissez une invitation pour voir le détail des réponses, corriger, régler le formulaire ou exporter." />
      {active.length ? (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wider text-stone">
              <tr>
                <th className="px-4 py-3 font-normal">Invitation</th>
                <th className="px-4 py-3 font-normal">Date</th>
                <th className="px-4 py-3 text-right font-normal">Formulaires</th>
                <th className="px-4 py-3 text-right font-normal">Personnes</th>
                <th className="px-4 py-3 text-right font-normal">Accompagnants</th>
                <th className="px-4 py-3 text-right font-normal">Refus</th>
                <th className="px-4 py-3 font-normal">Dernière réponse</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {active.map((i) => {
                const s = byId.get(i.id);
                return (
                  <tr key={i.id} className="hover:bg-paper/60">
                    <td className="px-4 py-3"><Link className="font-medium text-forest hover:underline" href={`/admin/invitations/${i.id}?onglet=rsvp`}>{i.title}</Link></td>
                    <td className="px-4 py-3">{formatShortDate(i.event_at)}</td>
                    <td className="px-4 py-3 text-right lining-nums tabular-nums">{s?.responses ?? 0}</td>
                    <td className="px-4 py-3 text-right font-medium lining-nums tabular-nums">{s?.confirmed_people ?? 0}</td>
                    <td className="px-4 py-3 text-right lining-nums tabular-nums">{s?.companions ?? 0}</td>
                    <td className="px-4 py-3 text-right lining-nums tabular-nums">{s?.declined_responses ?? 0}</td>
                    <td className="px-4 py-3 text-xs text-stone">{s?.last_response_at ? formatDateTime(s.last_response_at) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="Aucune invitation en ligne">Les réponses apparaîtront ici dès qu&apos;une invitation sera publiée.</EmptyState>
      )}

      <section className="card mt-8 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-serif text-2xl">{term ? `Invités correspondant à « ${term} »` : "Dernières réponses"}</h2>
          <form role="search" className="flex gap-2">
            <label htmlFor="rq" className="sr-only">Rechercher un invité</label>
            <input id="rq" name="q" defaultValue={term} placeholder="Rechercher un invité…" className="field min-h-9 w-60 py-1 text-sm" />
          </form>
        </div>
        {recent?.length ? (
          <ul className="mt-3 divide-y divide-line text-sm">
            {recent.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  {r.first_name} {r.last_name} —{" "}
                  <span className={r.attending ? "text-success" : "text-danger"}>{r.attending ? `présent·e (${1 + r.companions_count} pers.)` : "absent·e"}</span>{" "}
                  <Link href={`/admin/invitations/${r.invitation_id}?onglet=rsvp`} className="text-stone hover:text-forest">· {titles.get(r.invitation_id) ?? "invitation archivée"}</Link>
                </span>
                <time className="text-xs text-stone" dateTime={r.submitted_at}>{formatDateTime(r.submitted_at)}</time>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-stone">{term ? "Aucun invité trouvé." : "Aucune réponse pour le moment."}</p>
        )}
      </section>
    </>
  );
}
