import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/admin/PageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { requireStaff } from "@/lib/auth";
import { env } from "@/lib/env";
import { INVITATION_STATUS, INVITATION_STATUSES, type InvitationStatus } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";
import { formatShortDate, relativeFromNow } from "@/lib/time";

export const metadata = { title: "Invitations" };

type Search = Promise<{ statut?: string; q?: string }>;

export default async function InvitationsPage({ searchParams }: { searchParams: Search }) {
  await requireStaff();
  const { statut = "", q = "" } = await searchParams;
  const supabase = (await createClient())!;

  let query = supabase
    .from("invitations")
    .select("id, title, slug, status, event_at, published_at, updated_at, draft_updated_at, templates(name)")
    .order("updated_at", { ascending: false })
    .limit(300);
  if (statut === "preparation") query = query.in("status", ["draft", "customizing"]);
  else if ((INVITATION_STATUSES as readonly string[]).includes(statut)) query = query.eq("status", statut);
  else query = query.neq("status", "archived");
  const term = q.trim().replace(/[%,()]/g, " ").slice(0, 80);
  if (term) query = query.or(`title.ilike.%${term}%,slug.ilike.%${term}%,client_email.ilike.%${term}%`);

  const [{ data, error }, { data: stats }] = await Promise.all([query, supabase.from("rsvp_stats").select("invitation_id, responses, confirmed_people")]);
  const statsById = new Map((stats ?? []).map((s) => [s.invitation_id, s]));
  const host = env.siteUrl.replace(/^https?:\/\//, "");

  const tabs = [
    { value: "", label: "Actives" },
    { value: "preparation", label: "En préparation" },
    ...INVITATION_STATUSES.filter((s) => !["draft", "customizing"].includes(s)).map((s) => ({ value: s, label: INVITATION_STATUS[s].label })),
  ];

  return (
    <>
      <PageHeader
        title="Invitations"
        description="Les invitations naissent d'une demande client (bouton « Transformer en invitation »). Chacune garde sa propre copie du modèle."
        actions={<Link href="/admin/demandes" className="btn btn-secondary btn-sm">Voir les demandes</Link>}
      />
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {tabs.map((t) => (
          <Link
            key={t.value}
            href={`/admin/invitations${t.value ? `?statut=${t.value}` : ""}`}
            className={`rounded-full border px-3 py-1.5 text-xs ${statut === t.value ? "border-forest bg-forest text-ivory" : "border-line bg-white hover:border-forest"}`}
          >
            {t.label}
          </Link>
        ))}
        <form className="ml-auto" role="search">
          {statut ? <input type="hidden" name="statut" value={statut} /> : null}
          <label htmlFor="q" className="sr-only">Filtrer</label>
          <input id="q" name="q" defaultValue={term} placeholder="Prénoms, adresse, e-mail…" className="field min-h-9 w-56 py-1 text-sm" />
        </form>
      </div>
      {error ? <p role="alert" className="text-danger">Erreur de chargement : {error.message}</p> : null}
      {!data?.length ? (
        <EmptyState title="Aucune invitation">Transformez une demande client en invitation pour commencer.</EmptyState>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wider text-stone">
              <tr>
                <th scope="col" className="px-4 py-3 font-normal">Couple</th>
                <th scope="col" className="px-4 py-3 font-normal">Date</th>
                <th scope="col" className="px-4 py-3 font-normal">Modèle</th>
                <th scope="col" className="px-4 py-3 font-normal">Statut</th>
                <th scope="col" className="px-4 py-3 font-normal">Adresse</th>
                <th scope="col" className="px-4 py-3 font-normal">Publiée le</th>
                <th scope="col" className="px-4 py-3 font-normal">Modifiée</th>
                <th scope="col" className="px-4 py-3 text-right font-normal">RSVP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.map((i) => {
                const s = statsById.get(i.id);
                const tpl = i.templates as unknown as { name: string } | null;
                return (
                  <tr key={i.id} className="hover:bg-paper/60">
                    <td className="px-4 py-3">
                      <Link href={`/admin/invitations/${i.id}`} className="font-medium text-forest underline-offset-4 hover:underline">{i.title}</Link>
                    </td>
                    <td className="px-4 py-3">{formatShortDate(i.event_at)}</td>
                    <td className="px-4 py-3">{tpl?.name ?? "—"}</td>
                    <td className="px-4 py-3"><StatusBadge {...INVITATION_STATUS[i.status as InvitationStatus]} /></td>
                    <td className="px-4 py-3 text-xs text-stone">{host}/<span className="text-charcoal">{i.slug}</span></td>
                    <td className="px-4 py-3">{formatShortDate(i.published_at)}</td>
                    <td className="px-4 py-3 text-xs text-stone">{relativeFromNow(i.draft_updated_at)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {s ? (
                        <span title={`${s.confirmed_people} personne(s) confirmée(s)`}>
                          {s.responses}
                          <span className="text-xs text-stone"> · {s.confirmed_people} pers.</span>
                        </span>
                      ) : (
                        "0"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
