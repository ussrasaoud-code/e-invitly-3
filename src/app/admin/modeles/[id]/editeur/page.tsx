import { notFound } from "next/navigation";
import { VisualEditor } from "@/components/editor/VisualEditor";
import { requireStaff } from "@/lib/auth";
import { templateDefinitionSchema } from "@/lib/invitation/schema";
import { createClient } from "@/lib/supabase/server";
import { publishTemplateDraft, saveTemplateDraft, setTemplateStatus, toggleFeatured } from "../../actions";

export const metadata = { title: "Éditeur visuel du modèle" };

export default async function TemplateVisualEditorPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = (await createClient())!;
  const { data: t } = await supabase.from("templates").select("id, name, status, is_featured, current_version_id").eq("id", id).maybeSingle();
  if (!t?.current_version_id) notFound();
  const { data: v } = await supabase.from("template_versions").select("version, definition, created_at").eq("id", t.current_version_id).single();
  // Brouillon automatique plus récent que la version courante ?
  const { data: draft } = await supabase.from("template_drafts").select("definition, updated_at").eq("template_id", t.id).maybeSingle();
  const useDraft = !!draft && !!v && new Date(draft.updated_at).getTime() > new Date(v.created_at).getTime();
  const def = templateDefinitionSchema.safeParse(useDraft ? draft!.definition : v?.definition);
  if (!v || !def.success) {
    return <p role="alert" className="card p-6 text-sm">Ce modèle n&apos;a pas de version valide.</p>;
  }
  return (
    <VisualEditor
      initial={def.data.sample}
      renderer={def.data.renderer}
      save={saveTemplateDraft.bind(null, t.id)}
      publish={publishTemplateDraft.bind(null, t.id)}
      initialSavedAt={useDraft ? draft!.updated_at : v.created_at}
      savedLabel="Brouillon enregistré"
      backupKey={`ei-backup:modele:${t.id}`}
      title={`Modèle ${t.name}`}
      backHref={`/admin/modeles/${t.id}?onglet=design`}
      backLabel="Fiche du modèle"
      formHref={`/admin/modeles/${t.id}?onglet=design`}
      headerExtra={
        <div className="flex items-center gap-2 border-l border-line pl-4 text-xs">
          <span className={t.status === "published" ? "text-success" : "text-stone"}>
            {t.status === "published" ? "● Visible sur le site" : t.status === "archived" ? "Archivé" : "○ Pas encore sur le site"}
          </span>
          {t.status !== "archived" ? (
            <>
              <form action={setTemplateStatus}>
                <input type="hidden" name="id" value={t.id} />
                <input type="hidden" name="status" value={t.status === "published" ? "draft" : "published"} />
                <button type="submit" className="underline underline-offset-4 hover:text-forest" title="Le site affiche la dernière version enregistrée du modèle">
                  {t.status === "published" ? "Retirer du site" : "Publier sur le site"}
                </button>
              </form>
              <form action={toggleFeatured}>
                <input type="hidden" name="id" value={t.id} />
                <button type="submit" className="underline underline-offset-4 hover:text-forest">{t.is_featured ? "★ Mis en avant" : "☆ Mettre en avant"}</button>
              </form>
            </>
          ) : null}
        </div>
      }
    />
  );
}
