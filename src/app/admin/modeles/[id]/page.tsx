import Link from "next/link";
import { notFound } from "next/navigation";
import { InvitationEditor } from "@/components/admin/InvitationEditor";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { requireStaff } from "@/lib/auth";
import { CATEGORIES, STYLES } from "@/lib/catalog";
import { templateDefinitionSchema } from "@/lib/invitation/schema";
import { TEMPLATE_STATUS } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/time";
import { duplicateTemplate, restoreTemplateVersion, saveTemplateVersion, setTemplateStatus, updateTemplateMeta } from "../actions";

export const metadata = { title: "Modèle" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ onglet?: string }> };

export default async function TemplatePage({ params, searchParams }: Props) {
  await requireStaff();
  const { id } = await params;
  const { onglet = "fiche" } = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = (await createClient())!;
  const [{ data: t }, { data: versions }] = await Promise.all([
    supabase.from("templates").select("*").eq("id", id).maybeSingle(),
    supabase.from("template_versions").select("id, version, created_at, note, renderer, definition").eq("template_id", id).order("version", { ascending: false }),
  ]);
  if (!t) notFound();
  const current = versions?.find((v) => v.id === t.current_version_id) ?? null;
  const def = current ? templateDefinitionSchema.safeParse(current.definition) : null;
  const st = TEMPLATE_STATUS[t.status as keyof typeof TEMPLATE_STATUS];

  const tabs = [
    { value: "fiche", label: "Fiche catalogue" },
    { value: "design", label: "Design et contenu de démo" },
    { value: "versions", label: `Versions (${versions?.length ?? 0})` },
  ];

  return (
    <>
      <PageHeader
        eyebrow={<Link href="/admin/modeles" className="hover:text-forest">← Modèles</Link>}
        title={t.name}
        description={`Version courante : ${current?.version ?? "aucune"} · mise en page « ${current?.renderer ?? "—"} »`}
        actions={
          <>
            <StatusBadge {...st} />
            {t.status === "published" ? <Link href={`/demo/${t.slug}`} target="_blank" className="btn btn-ghost btn-sm">Voir la démo ↗</Link> : null}
            <form action={duplicateTemplate}>
              <input type="hidden" name="id" value={t.id} />
              <SubmitButton className="btn btn-secondary btn-sm" pendingLabel="Duplication…">Dupliquer</SubmitButton>
            </form>
            <form action={setTemplateStatus}>
              <input type="hidden" name="id" value={t.id} />
              <input type="hidden" name="status" value={t.status === "archived" ? "draft" : "archived"} />
              <SubmitButton className="btn btn-ghost btn-sm">{t.status === "archived" ? "Désarchiver" : "Archiver"}</SubmitButton>
            </form>
          </>
        }
      />
      <nav aria-label="Onglets" className="mb-6 flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map((tab) => (
          <Link key={tab.value} href={`/admin/modeles/${t.id}?onglet=${tab.value}`} aria-current={onglet === tab.value ? "page" : undefined} className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm ${onglet === tab.value ? "border-forest text-forest" : "border-transparent text-stone hover:text-charcoal"}`}>
            {tab.label}
          </Link>
        ))}
      </nav>

      {onglet === "fiche" ? (
        <form action={updateTemplateMeta} className="card grid max-w-4xl gap-5 p-5 md:grid-cols-2">
          <input type="hidden" name="id" value={t.id} />
          <label>
            <span className="field-label">Nom</span>
            <input name="name" defaultValue={t.name} required maxLength={80} className="field" />
          </label>
          <label>
            <span className="field-label">Identifiant (adresse /invitations/…)</span>
            <input name="slug" defaultValue={t.slug} maxLength={60} className="field" />
          </label>
          <label className="md:col-span-2">
            <span className="field-label">Description courte (cartes du catalogue)</span>
            <input name="short_description" defaultValue={t.short_description} maxLength={200} className="field" />
          </label>
          <label className="md:col-span-2">
            <span className="field-label">Description complète</span>
            <textarea name="description" defaultValue={t.description} rows={4} className="field" />
          </label>
          <label>
            <span className="field-label">Catégorie</span>
            <select name="category" defaultValue={t.category} className="field">
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </label>
          <label>
            <span className="field-label">Prix affiché (facultatif)</span>
            <input name="price_label" defaultValue={t.price_label ?? ""} maxLength={80} className="field" placeholder="Laisser vide pour ne rien afficher" />
          </label>
          <fieldset className="md:col-span-2">
            <legend className="field-label">Styles</legend>
            <div className="flex flex-wrap gap-4">
              {STYLES.map((s) => (
                <label key={s.value} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="styles" value={s.value} defaultChecked={t.styles.includes(s.value)} className="h-4 w-4 accent-forest" />
                  {s.label}
                </label>
              ))}
            </div>
          </fieldset>
          <label>
            <span className="field-label">Fonctionnalités (une par ligne)</span>
            <textarea name="features" defaultValue={t.features.join("\n")} rows={6} className="field text-sm" />
          </label>
          <div className="space-y-4">
            <label className="block">
              <span className="field-label">Image principale (lien)</span>
              <input name="cover_image" defaultValue={t.cover_image ?? ""} className="field text-sm" />
            </label>
            <label className="block">
              <span className="field-label">Galerie (un lien par ligne)</span>
              <textarea name="gallery" defaultValue={(t.gallery as string[]).join("\n")} rows={3} className="field text-sm" />
            </label>
            <p className="text-xs text-stone">L&apos;import de fichiers depuis la bibliothèque de médias arrive en phase 3b.</p>
          </div>
          <div className="md:col-span-2">
            <SubmitButton className="btn btn-primary" pendingLabel="Enregistrement…">Enregistrer la fiche</SubmitButton>
          </div>
        </form>
      ) : null}

      {onglet === "design" ? (
        def?.success ? (
          <>
            <p className="mb-4 max-w-3xl text-sm text-stone">
              Ces réglages forment la base de chaque nouvelle invitation créée avec ce modèle. Les prénoms, lieux et contacts
              servent uniquement à la démo : ils sont remplacés par ceux du client lors de la conversion d&apos;une demande.
            </p>
            <InvitationEditor
              save={saveTemplateVersion.bind(null, t.id)}
              autosave={false}
              initial={def.data.sample}
              renderer={def.data.renderer}
              initialSavedAt={current!.created_at}
              savedLabel={`Version ${current!.version} enregistrée`}
              previewNote="Aperçu de la démo du modèle"
            />
          </>
        ) : (
          <p className="card p-6 text-sm">Ce modèle n&apos;a pas de version valide.</p>
        )
      ) : null}

      {onglet === "versions" ? (
        <div className="card max-w-3xl divide-y divide-line">
          {versions?.map((v) => (
            <div key={v.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
              <div>
                <p>
                  Version {v.version}
                  {v.id === t.current_version_id ? <span className="ml-2 text-xs text-forest">· courante</span> : null}
                </p>
                <p className="text-xs text-stone">{formatDateTime(v.created_at)}{v.note ? ` · ${v.note}` : ""}</p>
              </div>
              {v.id !== t.current_version_id ? (
                <form action={restoreTemplateVersion}>
                  <input type="hidden" name="id" value={t.id} />
                  <input type="hidden" name="versionId" value={v.id} />
                  <SubmitButton className="btn btn-ghost btn-sm" confirm={`Rétablir la version ${v.version} comme version courante ?`}>Rétablir</SubmitButton>
                </form>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}
