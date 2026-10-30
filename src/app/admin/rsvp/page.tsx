import Link from "next/link";
import { PageHeader, SoonPanel } from "@/components/admin/PageHeader";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "RSVP" };

export default async function RsvpPage() {
  await requireStaff();
  const supabase = (await createClient())!;
  const [{ data: stats }, { data: invitations }] = await Promise.all([
    supabase.from("rsvp_stats").select("*").gt("responses", 0),
    supabase.from("invitations").select("id, title").neq("status", "archived"),
  ]);
  const titles = new Map((invitations ?? []).map((i) => [i.id, i.title]));
  return (
    <>
      <PageHeader title="RSVP" description="Statistiques calculées par la base de données, invitation par invitation." />
      {stats?.length ? (
        <div className="card mb-6 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wider text-stone">
              <tr>
                <th className="px-4 py-3 font-normal">Invitation</th>
                <th className="px-4 py-3 text-right font-normal">Formulaires</th>
                <th className="px-4 py-3 text-right font-normal">Présents</th>
                <th className="px-4 py-3 text-right font-normal">Accompagnants</th>
                <th className="px-4 py-3 text-right font-normal">Personnes</th>
                <th className="px-4 py-3 text-right font-normal">Refus</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {stats.map((s) => (
                <tr key={s.invitation_id}>
                  <td className="px-4 py-3"><Link className="text-forest hover:underline" href={`/admin/invitations/${s.invitation_id}?onglet=rsvp`}>{titles.get(s.invitation_id) ?? "—"}</Link></td>
                  <td className="px-4 py-3 text-right tabular-nums">{s.responses}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{s.attending_responses}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{s.companions}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">{s.confirmed_people}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{s.declined_responses}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="card mb-6 p-5 text-sm text-stone">Aucune réponse reçue pour le moment.</p>
      )}
      <SoonPanel phase="phase 5">
        Formulaire RSVP opérationnel dans les invitations publiées, liste détaillée des réponses (recherche, filtres présents/absents,
        menus, commentaires), corrections tracées, exports CSV et Excel, notifications et espace couple complet.
      </SoonPanel>
    </>
  );
}
