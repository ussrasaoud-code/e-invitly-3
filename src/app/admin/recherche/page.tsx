import Link from "next/link";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { requireStaff } from "@/lib/auth";
import { INVITATION_STATUS, REQUEST_STATUS, type InvitationStatus, type RequestStatus } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";
import { formatShortDate } from "@/lib/time";

export const metadata = { title: "Recherche" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireStaff();
  const { q = "" } = await searchParams;
  const term = q.trim().replace(/[%,()]/g, " ").slice(0, 80);
  const supabase = (await createClient())!;
  const [requests, invitations, templates] = term
    ? await Promise.all([
        supabase
          .from("client_requests")
          .select("id, reference, partner_one, partner_two, email, status, submitted_at")
          .or(`reference.ilike.%${term}%,email.ilike.%${term}%,contact_last_name.ilike.%${term}%,contact_first_name.ilike.%${term}%,partner_one.ilike.%${term}%,partner_two.ilike.%${term}%`)
          .limit(20),
        supabase.from("invitations").select("id, title, slug, status, event_at").or(`title.ilike.%${term}%,slug.ilike.%${term}%,client_email.ilike.%${term}%`).limit(20),
        supabase.from("templates").select("id, name, slug").or(`name.ilike.%${term}%,slug.ilike.%${term}%`).limit(10),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];
  const total = (requests.data?.length ?? 0) + (invitations.data?.length ?? 0) + (templates.data?.length ?? 0);

  return (
    <>
      <PageHeader title="Recherche" description={term ? `${total} résultat(s) pour « ${term} »` : "Saisissez un nom, un e-mail, une référence ou une adresse."} />
      {term ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <section className="card p-5">
            <h2 className="font-serif text-xl">Demandes</h2>
            <ul className="mt-3 divide-y divide-line text-sm">
              {requests.data?.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 py-2">
                  <Link href={`/admin/demandes/${r.id}`} className="hover:text-forest">{r.reference} · {r.partner_one} &amp; {r.partner_two}</Link>
                  <StatusBadge {...REQUEST_STATUS[r.status as RequestStatus]} />
                </li>
              ))}
              {!requests.data?.length ? <li className="py-2 text-stone">Aucune</li> : null}
            </ul>
          </section>
          <section className="card p-5">
            <h2 className="font-serif text-xl">Invitations</h2>
            <ul className="mt-3 divide-y divide-line text-sm">
              {invitations.data?.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-2 py-2">
                  <Link href={`/admin/invitations/${i.id}`} className="hover:text-forest">{i.title} <span className="text-xs text-stone">{formatShortDate(i.event_at)}</span></Link>
                  <StatusBadge {...INVITATION_STATUS[i.status as InvitationStatus]} />
                </li>
              ))}
              {!invitations.data?.length ? <li className="py-2 text-stone">Aucune</li> : null}
            </ul>
          </section>
          <section className="card p-5">
            <h2 className="font-serif text-xl">Modèles</h2>
            <ul className="mt-3 divide-y divide-line text-sm">
              {templates.data?.map((t) => (
                <li key={t.id} className="py-2"><Link href={`/admin/modeles/${t.id}`} className="hover:text-forest">{t.name}</Link></li>
              ))}
              {!templates.data?.length ? <li className="py-2 text-stone">Aucun</li> : null}
            </ul>
          </section>
        </div>
      ) : null}
    </>
  );
}
