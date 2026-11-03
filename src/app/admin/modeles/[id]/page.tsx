import { MediaListField, MediaUrlField } from "@/components/media/MediaUrlField";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InvitationEditor } from "@/components/admin/InvitationEditor";
import { normalizeCultures } from "@/lib/validation/request";
import { PriceField } from "@/components/admin/PriceField";
import { LANGUAGES, LANGUAGE_LABELS } from "@/lib/invitation/schema";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { requireStaff } from "@/lib/auth";
import { CATEGORIES, STYLES } from "@/lib/catalog";
import { templateDefinitionSchema } from "@/lib/invitation/schema";
import { TEMPLATE_STATUS } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/time";
import { duplicateTemplate, publishTemplateDraft, restoreTemplateVersion, saveTemplateDraft, setTemplateStatus, toggleFeatured, updateTemplateMeta } from "../actions";

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
  // Brouillon enregistré automatiquement, plus récent que la version courante ?
  const { data: draft } = await supabase.from("template_drafts").select("definition, updated_at").eq("template_id", id).maybeSingle();
  const useDraft = !!draft && !!current && new Date(draft.updated_at).getTime() > new Date(current.created_at).getTime();
  const def = current ? templateDefinitionSchema.safeParse(useDraft ? draft!.definition : current.definition) : null;
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
            {t.status !== "archived" ? (
              <>
                <form action={setTemplateStatus}>
                  <input type="hidden" name="id" value={t.id} />
                  <input type="hidden" name="status" value={t.status === "published" ? "draft" : "published"} />
                  <SubmitButton className={`btn btn-sm ${t.status === "published" ? "btn-ghost" : "btn-primary"}`} pendingLabel="…">
                    {t.status === "published" ? "Retirer du catalogue" : "Publier dans le catalogue"}
                  </SubmitButton>
                </form>
                <form action={toggleFeatured}>
                  <input type="hidden" name="id" value={t.id} />
                  <SubmitButton className="btn btn-ghost btn-sm" pendingLabel="…">{t.is_featured ? "★ Mis en avant" : "☆ Mettre en avant"}</SubmitButton>
                </form>
              </>
            ) : null}
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
      {t.status !== "published" ? (
        <p className="mb-4 max-w-3xl border border-warning/40 bg-[#fbf3e2] px-4 py-2 text-sm">
          Ce modèle n&apos;est pas visible sur le site. Cliquez sur « Publier dans le catalogue » pour l&apos;afficher
          {t.is_featured ? " (il est déjà marqué « mis en avant » : il apparaîtra en premier)" : ""}.
        </p>
      ) : !t.cover_image ? (
        <p className="mb-4 max-w-3xl border border-line bg-white px-4 py-2 text-sm text-stone">
          Conseil : ajoutez une image de couverture (onglet « Fiche catalogue ») pour que la carte du catalogue montre un aperçu.
        </p>
      ) : null}
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
          <fieldset className="md:col-span-2">
            <legend className="field-label">Types de mariage proposés avec ce modèle</legend>
            <input type="hidden" name="cultures_present" value="1" />
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {([
                ["europeen", "Français / européen", "cérémonies, cocktail, dîner"],
                ["maghrebin", "Maghrébin", "henné, soirée, plusieurs jours"],
                ["mixte", "Franco-maghrébin", "cérémonie civile ou religieuse + henné + soirée"],
              ] as const).map(([v, label, hint]) => (
                <label key={v} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="cultures" value={v} defaultChecked={normalizeCultures((t as { cultures?: unknown }).cultures).includes(v)} className="h-4 w-4 accent-forest" />
                  <span>{label} <span className="text-xs text-stone">({hint})</span></span>
                </label>
              ))}
            </div>
            <span className="field-hint">Si plusieurs types sont cochés, la cliente choisit le sien au début du formulaire, qui s&apos;adapte. Au moins un type (par défaut : français / européen).</span>
          </fieldset>
          <PriceField defaultLabel={t.price_label} />
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
            <div>
              <span className="field-label">Image principale</span>
              <MediaUrlField kinds={["image", "svg"]} name="cover_image" defaultValue={t.cover_image ?? ""} className="field text-sm" label="Image principale" />
            </div>
            <div>
              <span className="field-label">Galerie (un lien par ligne) — la 1<sup>re</sup> image s&apos;affiche dans le 2<sup>e</sup> téléphone de la page d&apos;accueil</span>
              <MediaListField name="gallery" defaultValue={(t.gallery as string[]).join("\n")} />
            </div>
          </div>
          <fieldset className="md:col-span-2">
            <legend className="field-label">Fiche dans les autres langues du site</legend>
            <p className="mb-3 text-xs text-stone">
              Laissez un champ vide pour reprendre le texte français. Les prix « À partir de… » et « Prix fixe » sont traduits automatiquement.
            </p>
            <div className="divide-y divide-line border-y border-line">
              {LANGUAGES.filter((l) => l !== "fr").map((l) => {
                const tr = ((t as { translations?: Record<string, Record<string, string>> }).translations ?? {})[l] ?? {};
                const filled = Object.values(tr).some((v) => v?.trim());
                return (
                  <details key={l} className="group py-3" open={false}>
                    <summary className="flex cursor-pointer list-none items-center justify-between text-sm">
                      <span>
                        {LANGUAGE_LABELS[l]} <span className="text-stone">· {filled ? "traduite" : "à traduire"}</span>
                      </span>
                      <span aria-hidden="true" className="text-forest transition-transform group-open:rotate-45">+</span>
                    </summary>
                    <div className="mt-3 grid gap-3 md:grid-cols-2" dir={l === "ar" ? "rtl" : undefined} lang={l}>
                      <label>
                        <span className="field-label !text-xs">Nom</span>
                        <input name={`tr_${l}_name`} defaultValue={tr.name ?? ""} maxLength={80} className="field text-sm" placeholder={t.name} />
                      </label>
                      <label>
                        <span className="field-label !text-xs">Prix en texte libre (facultatif)</span>
                        <input name={`tr_${l}_price_label`} defaultValue={tr.price_label ?? ""} maxLength={80} className="field text-sm" />
                      </label>
                      <label className="md:col-span-2">
                        <span className="field-label !text-xs">Description courte</span>
                        <input name={`tr_${l}_short_description`} defaultValue={tr.short_description ?? ""} maxLength={200} className="field text-sm" placeholder={t.short_description} />
                      </label>
                      <label className="md:col-span-2">
                        <span className="field-label !text-xs">Description complète</span>
                        <textarea name={`tr_${l}_description`} defaultValue={tr.description ?? ""} rows={3} className="field text-sm" />
                      </label>
                      <label className="md:col-span-2">
                        <span className="field-label !text-xs">Fonctionnalités (une par ligne)</span>
                        <textarea name={`tr_${l}_features`} defaultValue={tr.features ?? ""} rows={3} className="field text-sm" placeholder={(t.features as string[]).join("\n")} />
                      </label>
                    </div>
                  </details>
                );
              })}
            </div>
          </fieldset>
          <div className="md:col-span-2">
            <SubmitButton className="btn btn-primary" pendingLabel="Enregistrement…">Enregistrer la fiche</SubmitButton>
          </div>
        </form>
      ) : null}

      {onglet === "design" ? (
        def?.success ? (
          <>
            <p className="mb-4 max-w-3xl text-sm text-stone">
              Ces réglages forment la base de chaque nouvelle invitation créée avec ce modèle. Vos changements sont enregistrés automatiquement comme brouillon ; « Enregistrer une nouvelle version » les applique aux nouvelles invitations. Les prénoms, lieux et contacts
              servent uniquement à la démo : ils sont remplacés par ceux du client lors de la conversion d&apos;une demande.
            </p>
            <p className="mb-4">
              <Link href={`/admin/modeles/${t.id}/editeur`} className="btn btn-secondary btn-sm">Ouvrir l&apos;éditeur visuel (décors, textes libres, animations)</Link>
            </p>
            <InvitationEditor
              save={saveTemplateDraft.bind(null, t.id, null)}
              publish={publishTemplateDraft.bind(null, t.id, null)}
              lockLanguage="Langue principale du modèle. Les autres langues se créent dans l'éditeur visuel (bouton « + Langue »)."
              backupKey={`ei-backup:modele:${t.id}`}
              initial={def.data.sample}
              renderer={def.data.renderer}
              initialSavedAt={useDraft ? draft!.updated_at : current!.created_at}
              savedLabel="Brouillon enregistré"
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
