import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/admin/PageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { requireStaff } from "@/lib/auth";
import { categoryLabel } from "@/lib/catalog";
import { RENDERERS } from "@/lib/invitation/schema";
import { TEMPLATE_STATUS } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";
import { createTemplate, moveTemplate, setTemplateStatus, toggleFeatured } from "./actions";

export const metadata = { title: "Modèles" };

const RENDERER_LABEL: Record<string, string> = { "the-garden": "The Garden", province: "Province" };

export default async function TemplatesPage({ searchParams }: { searchParams: Promise<{ archives?: string }> }) {
  await requireStaff();
  const { archives } = await searchParams;
  const supabase = (await createClient())!;
  let q = supabase
    .from("templates")
    .select("id, slug, name, category, status, is_featured, sort_order, cover_image, updated_at, current:template_versions!templates_current_version_fk(version)")
    .order("sort_order")
    .order("name");
  q = archives ? q.eq("status", "archived") : q.neq("status", "archived");
  const [{ data, error }, { data: usage }] = await Promise.all([q, supabase.from("invitations").select("template_id")]);
  const usageCount = new Map<string, number>();
  for (const u of usage ?? []) if (u.template_id) usageCount.set(u.template_id, (usageCount.get(u.template_id) ?? 0) + 1);

  return (
    <>
      <PageHeader
        title={archives ? "Modèles archivés" : "Bibliothèque de modèles"}
        description="Chaque modèle est réutilisable à l'infini. Modifier un modèle crée une nouvelle version : les invitations existantes conservent la leur."
        actions={<Link href={archives ? "/admin/modeles" : "/admin/modeles?archives=1"} className="btn btn-ghost btn-sm">{archives ? "← Modèles actifs" : "Archives"}</Link>}
      />
      {error ? <p role="alert" className="text-danger">{error.message}</p> : null}
      {!data?.length ? (
        <EmptyState title="Aucun modèle">Créez votre premier modèle ci-dessous.</EmptyState>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {data.map((t, i) => {
            const st = TEMPLATE_STATUS[t.status as keyof typeof TEMPLATE_STATUS];
            const current = t.current as unknown as { version: number } | null;
            return (
              <li key={t.id} className="card flex gap-4 p-4">
                {t.cover_image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.cover_image} alt="" className="h-36 w-28 shrink-0 bg-paper object-cover" />
                ) : (
                  <div className="h-36 w-28 shrink-0 bg-paper" />
                )}
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Link href={`/admin/modeles/${t.id}`} className="font-serif text-2xl hover:text-forest">{t.name}</Link>
                      <p className="text-xs text-stone">
                        {categoryLabel(t.category)} · version {current?.version ?? "—"} · utilisé par {usageCount.get(t.id) ?? 0} invitation(s)
                      </p>
                    </div>
                    <StatusBadge {...st} />
                  </div>
                  <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-3">
                    <Link href={`/admin/modeles/${t.id}`} className="btn btn-secondary btn-sm">Modifier</Link>
                    {t.status === "published" ? (
                      <Link href={`/demo/${t.slug}`} target="_blank" className="btn btn-ghost btn-sm">Démo ↗</Link>
                    ) : null}
                    <form action={setTemplateStatus}>
                      <input type="hidden" name="id" value={t.id} />
                      <input type="hidden" name="status" value={t.status === "published" ? "draft" : "published"} />
                      <SubmitButton className="btn btn-ghost btn-sm">{t.status === "published" ? "Retirer du catalogue" : "Publier"}</SubmitButton>
                    </form>
                    {!archives ? (
                      <>
                        <form action={toggleFeatured}>
                          <input type="hidden" name="id" value={t.id} />
                          <SubmitButton className="btn btn-ghost btn-sm">{t.is_featured ? "★ En avant" : "☆ Mettre en avant"}</SubmitButton>
                        </form>
                        <form action={moveTemplate} className="flex">
                          <input type="hidden" name="id" value={t.id} />
                          <SubmitButton name="dir" value="up" className="btn btn-ghost btn-sm" >↑</SubmitButton>
                          <SubmitButton name="dir" value="down" className="btn btn-ghost btn-sm">↓</SubmitButton>
                        </form>
                      </>
                    ) : null}
                    <span className="sr-only">Position {i + 1}</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {!archives ? (
        <section className="card mt-10 max-w-2xl p-5">
          <h2 className="font-serif text-2xl">Nouveau modèle</h2>
          <p className="mt-1 text-sm text-stone">
            Part d&apos;un moteur de rendu existant (mise en page). Vous ajustez ensuite couleurs, polices, sections et textes ;
            il reste hors catalogue jusqu&apos;à sa publication. Une mise en page entièrement nouvelle demande un nouveau moteur de rendu (développement).
          </p>
          <form action={createTemplate} className="mt-4 grid gap-3 sm:grid-cols-[1fr_200px_auto] sm:items-end">
            <label>
              <span className="field-label !text-xs">Nom</span>
              <input name="name" required maxLength={80} className="field min-h-10 text-sm" />
            </label>
            <label>
              <span className="field-label !text-xs">Mise en page de base</span>
              <select name="renderer" className="field min-h-10 text-sm">
                {RENDERERS.map((r) => <option key={r} value={r}>{RENDERER_LABEL[r] ?? r}</option>)}
              </select>
            </label>
            <SubmitButton className="btn btn-primary btn-sm" pendingLabel="Création…">Créer</SubmitButton>
          </form>
        </section>
      ) : null}
    </>
  );
}
