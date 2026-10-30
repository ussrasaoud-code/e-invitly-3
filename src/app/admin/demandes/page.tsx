import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/admin/PageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { requireStaff } from "@/lib/auth";
import { REQUEST_STATUS, REQUEST_STATUSES, type RequestStatus } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";
import { formatShortDate } from "@/lib/time";

export const metadata = { title: "Demandes clients" };

type Search = Promise<{ statut?: string; q?: string; archives?: string }>;

export default async function RequestsPage({ searchParams }: { searchParams: Search }) {
  await requireStaff();
  const { statut = "", q = "", archives } = await searchParams;
  const supabase = (await createClient())!;

  let query = supabase
    .from("client_requests")
    .select("id, reference, contact_first_name, contact_last_name, email, partner_one, partner_two, event_date, submitted_at, status, templates(name)")
    .order("submitted_at", { ascending: false })
    .limit(200);
  query = archives ? query.not("archived_at", "is", null) : query.is("archived_at", null);
  if (statut === "a-traiter") query = query.in("status", ["new", "in_progress", "missing_info"]);
  else if ((REQUEST_STATUSES as readonly string[]).includes(statut)) query = query.eq("status", statut);
  const term = q.trim().replace(/[%,()]/g, " ").slice(0, 80);
  if (term) {
    query = query.or(
      `reference.ilike.%${term}%,email.ilike.%${term}%,contact_last_name.ilike.%${term}%,contact_first_name.ilike.%${term}%,partner_one.ilike.%${term}%,partner_two.ilike.%${term}%`,
    );
  }
  const { data, error } = await query;

  const tabs = [
    { value: "", label: "Toutes" },
    { value: "a-traiter", label: "À traiter" },
    ...REQUEST_STATUSES.map((s) => ({ value: s, label: REQUEST_STATUS[s].label })),
  ];
  const href = (s: string, a = archives) => {
    const p = new URLSearchParams();
    if (s) p.set("statut", s);
    if (term) p.set("q", term);
    if (a) p.set("archives", "1");
    return `/admin/demandes${p.size ? `?${p}` : ""}`;
  };

  return (
    <>
      <PageHeader
        title={archives ? "Demandes archivées" : "Demandes clients"}
        description="Chaque demande envoyée depuis le site. Ouvrez-en une pour voir toutes les réponses et la transformer en invitation."
        actions={
          <Link href={href(statut, archives ? undefined : "1")} className="btn btn-ghost btn-sm">
            {archives ? "← Demandes actives" : "Voir les archives"}
          </Link>
        }
      />
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {tabs.map((t) => (
          <Link
            key={t.value}
            href={href(t.value)}
            className={`rounded-full border px-3 py-1.5 text-xs ${statut === t.value ? "border-forest bg-forest text-ivory" : "border-line bg-white hover:border-forest"}`}
          >
            {t.label}
          </Link>
        ))}
        <form className="ml-auto flex gap-2" role="search">
          {statut ? <input type="hidden" name="statut" value={statut} /> : null}
          {archives ? <input type="hidden" name="archives" value="1" /> : null}
          <label htmlFor="q" className="sr-only">Filtrer</label>
          <input id="q" name="q" defaultValue={term} placeholder="Nom, e-mail, référence…" className="field min-h-9 w-56 py-1 text-sm" />
        </form>
      </div>

      {error ? <p role="alert" className="text-danger">Erreur de chargement : {error.message}</p> : null}
      {!data?.length ? (
        <EmptyState title="Aucune demande">Les demandes envoyées depuis le formulaire du site apparaîtront ici.</EmptyState>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wider text-stone">
              <tr>
                <th scope="col" className="px-4 py-3 font-normal">Référence</th>
                <th scope="col" className="px-4 py-3 font-normal">Client</th>
                <th scope="col" className="px-4 py-3 font-normal">Couple</th>
                <th scope="col" className="px-4 py-3 font-normal">Modèle</th>
                <th scope="col" className="px-4 py-3 font-normal">Événement</th>
                <th scope="col" className="px-4 py-3 font-normal">Reçue le</th>
                <th scope="col" className="px-4 py-3 font-normal">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.map((r) => {
                const tpl = r.templates as unknown as { name: string } | null;
                return (
                  <tr key={r.id} className="hover:bg-paper/60">
                    <td className="px-4 py-3">
                      <Link href={`/admin/demandes/${r.id}`} className="font-medium text-forest underline-offset-4 hover:underline">
                        {r.reference}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {r.contact_first_name} {r.contact_last_name}
                      <span className="block text-xs text-stone">{r.email}</span>
                    </td>
                    <td className="px-4 py-3">{r.partner_one} &amp; {r.partner_two}</td>
                    <td className="px-4 py-3">{tpl?.name ?? "—"}</td>
                    <td className="px-4 py-3">{formatShortDate(r.event_date)}</td>
                    <td className="px-4 py-3">{formatShortDate(r.submitted_at)}</td>
                    <td className="px-4 py-3"><StatusBadge {...REQUEST_STATUS[r.status as RequestStatus]} /></td>
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
