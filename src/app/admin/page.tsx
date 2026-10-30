import Link from "next/link";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { requireStaff } from "@/lib/auth";
import { INVITATION_STATUS, type InvitationStatus } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";
import { formatShortDate, relativeFromNow } from "@/lib/time";

export const metadata = { title: "Vue d'ensemble" };

const PERIODS = [
  { value: "7", label: "7 jours" },
  { value: "30", label: "30 jours" },
  { value: "90", label: "90 jours" },
  { value: "tout", label: "Tout" },
];
const ACTIVITY_TYPES = [
  { value: "", label: "Toute l'activité" },
  { value: "client_request", label: "Demandes" },
  { value: "invitation", label: "Invitations" },
  { value: "template", label: "Modèles" },
  { value: "rsvp_response", label: "RSVP" },
];

type Search = Promise<{ periode?: string; type?: string }>;

export default async function AdminHome({ searchParams }: { searchParams: Search }) {
  await requireStaff();
  const { periode = "30", type = "" } = await searchParams;
  const supabase = (await createClient())!;
  const since = periode === "tout" ? null : new Date(Date.now() - Number(periode) * 86_400_000).toISOString();

  const count = async (table: string, apply: (q: any) => any) => {
    const { count, error } = await apply(supabase.from(table).select("id", { count: "exact", head: true }));
    if (error) console.error("[dashboard]", table, error.message);
    return count ?? 0;
  };

  const nowIso = new Date().toISOString();
  const in60 = new Date(Date.now() + 60 * 86_400_000).toISOString();

  const [received, toProcess, preparing, pendingReview, ready, published, rsvps, upcoming, activity] = await Promise.all([
    count("client_requests", (q) => (since ? q.gte("submitted_at", since) : q)),
    count("client_requests", (q) => q.in("status", ["new", "in_progress", "missing_info"]).is("archived_at", null)),
    count("invitations", (q) => q.in("status", ["draft", "customizing"])),
    count("invitations", (q) => q.eq("status", "pending_review")),
    count("invitations", (q) => q.eq("status", "ready")),
    count("invitations", (q) => q.eq("status", "published")),
    count("rsvp_responses", (q) => (since ? q.gte("submitted_at", since) : q)),
    supabase
      .from("invitations")
      .select("id, title, slug, status, event_at")
      .gte("event_at", nowIso)
      .lte("event_at", in60)
      .neq("status", "archived")
      .order("event_at")
      .limit(8),
    (() => {
      let q = supabase.from("audit_logs").select("id, action, resource_type, resource_id, summary, created_at").order("created_at", { ascending: false }).limit(15);
      if (since) q = q.gte("created_at", since);
      if (type) q = q.eq("resource_type", type);
      return q;
    })(),
  ]);

  const kpis = [
    { label: `Demandes reçues (${PERIODS.find((p) => p.value === periode)?.label ?? ""})`, value: received, href: "/admin/demandes" },
    { label: "Demandes à traiter", value: toProcess, href: "/admin/demandes?statut=a-traiter", highlight: toProcess > 0 },
    { label: "Invitations en préparation", value: preparing, href: "/admin/invitations?statut=preparation" },
    { label: "En attente de validation", value: pendingReview, href: "/admin/invitations?statut=pending_review" },
    { label: "Prêtes à publier", value: ready, href: "/admin/invitations?statut=ready" },
    { label: "Invitations publiées", value: published, href: "/admin/invitations?statut=published" },
    { label: `Réponses RSVP (${PERIODS.find((p) => p.value === periode)?.label ?? ""})`, value: rsvps, href: "/admin/rsvp" },
  ];

  const link = (p: { periode?: string; type?: string }) => {
    const s = new URLSearchParams();
    const pe = p.periode ?? periode;
    const ty = p.type ?? type;
    if (pe !== "30") s.set("periode", pe);
    if (ty) s.set("type", ty);
    return `/admin${s.size ? `?${s}` : ""}`;
  };

  const resourceHref = (r: { resource_type: string; resource_id: string | null }) =>
    !r.resource_id
      ? null
      : r.resource_type === "client_request"
        ? `/admin/demandes/${r.resource_id}`
        : r.resource_type === "invitation"
          ? `/admin/invitations/${r.resource_id}`
          : r.resource_type === "template"
            ? `/admin/modeles/${r.resource_id}`
            : null;

  return (
    <>
      <PageHeader
        title="Vue d'ensemble"
        description="Chiffres calculés en direct à partir de la base de données."
        actions={
          <div className="flex rounded-sm border border-line bg-white p-0.5" role="group" aria-label="Période">
            {PERIODS.map((p) => (
              <Link
                key={p.value}
                href={link({ periode: p.value })}
                aria-current={periode === p.value ? "true" : undefined}
                className={`px-3 py-1.5 text-xs ${periode === p.value ? "bg-forest text-ivory" : "text-charcoal hover:bg-paper"}`}
              >
                {p.label}
              </Link>
            ))}
          </div>
        }
      />

      <section aria-label="Indicateurs" className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        {kpis.map((k) => (
          <Link key={k.label} href={k.href} className={`card block p-4 transition-shadow hover:shadow-paper ${k.highlight ? "border-forest" : ""}`}>
            <span className="block font-serif text-4xl leading-none tabular-nums">{k.value}</span>
            <span className="mt-2 block text-xs leading-snug text-stone">{k.label}</span>
          </Link>
        ))}
      </section>

      <div className="mt-10 grid gap-8 xl:grid-cols-[1.4fr_1fr]">
        <section className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-serif text-2xl">Activité récente</h2>
            <div className="flex flex-wrap gap-1">
              {ACTIVITY_TYPES.map((t) => (
                <Link
                  key={t.value}
                  href={link({ type: t.value })}
                  className={`rounded-full border px-3 py-1 text-xs ${type === t.value ? "border-forest bg-forest text-ivory" : "border-line hover:border-forest"}`}
                >
                  {t.label}
                </Link>
              ))}
            </div>
          </div>
          {activity.data?.length ? (
            <ul className="mt-4 divide-y divide-line">
              {activity.data.map((a) => {
                const href = resourceHref(a);
                return (
                  <li key={a.id} className="flex items-start justify-between gap-4 py-3 text-sm">
                    {href ? <Link href={href} className="hover:text-forest">{a.summary}</Link> : <span>{a.summary}</span>}
                    <time dateTime={a.created_at} className="shrink-0 text-xs text-stone">{relativeFromNow(a.created_at)}</time>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-6 text-sm text-stone">Aucune activité sur cette période.</p>
          )}
        </section>

        <section className="card p-5">
          <h2 className="font-serif text-2xl">Événements des 60 prochains jours</h2>
          {upcoming.data?.length ? (
            <ul className="mt-4 divide-y divide-line">
              {upcoming.data.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div>
                    <Link href={`/admin/invitations/${i.id}`} className="hover:text-forest">{i.title}</Link>
                    <p className="text-xs text-stone">{formatShortDate(i.event_at)}</p>
                  </div>
                  <StatusBadge {...INVITATION_STATUS[i.status as InvitationStatus]} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-6 text-sm text-stone">Aucun événement prévu dans les 60 prochains jours.</p>
          )}
        </section>
      </div>
    </>
  );
}
