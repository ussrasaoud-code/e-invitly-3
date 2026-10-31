import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/admin/PageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { requireStaff } from "@/lib/auth";
import { INVITATION_STATUS, type InvitationStatus } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";
import { relativeFromNow } from "@/lib/time";

export const metadata = { title: "Éditeur" };

export default async function EditorPage() {
  await requireStaff();
  const supabase = (await createClient())!;
  const [{ data: invitations }, { data: templates }] = await Promise.all([
    supabase.from("invitations").select("id, title, status, draft_updated_at").neq("status", "archived").order("draft_updated_at", { ascending: false }).limit(30),
    supabase.from("templates").select("id, name, status").order("sort_order", { ascending: true }),
  ]);

  return (
    <>
      <PageHeader
        title="Éditeur visuel"
        description="Décors de la bibliothèque (fleurs, colombes, textures), textes libres, animations par élément, sections ajoutées ou dupliquées, historique du brouillon. Les textes, dates et lieux restent dans le formulaire de chaque invitation."
      />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section>
          <h2 className="mb-3 font-serif text-2xl">Invitations récentes</h2>
          {!invitations?.length ? (
            <EmptyState title="Aucune invitation">Transformez une demande client en invitation pour commencer.</EmptyState>
          ) : (
            <ul className="card divide-y divide-line">
              {invitations.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate">{i.title}</p>
                    <p className="text-xs text-stone">Brouillon modifié {relativeFromNow(i.draft_updated_at)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge {...INVITATION_STATUS[i.status as InvitationStatus]} />
                    <Link href={`/admin/invitations/${i.id}/editeur`} className="btn btn-secondary btn-sm">Ouvrir</Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h2 className="mb-3 font-serif text-2xl">Modèles</h2>
          <p className="mb-3 text-sm text-stone">Les décors ajoutés à un modèle sont repris par chaque nouvelle invitation créée avec lui ; les invitations existantes ne changent pas.</p>
          <ul className="card divide-y divide-line">
            {(templates ?? []).map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span>{t.name} <span className="text-xs text-stone">· {t.status === "published" ? "au catalogue" : "hors catalogue"}</span></span>
                <Link href={`/admin/modeles/${t.id}/editeur`} className="btn btn-secondary btn-sm">Ouvrir</Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
