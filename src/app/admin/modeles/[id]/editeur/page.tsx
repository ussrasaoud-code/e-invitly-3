import { notFound } from "next/navigation";
import { VisualEditor } from "@/components/editor/VisualEditor";
import { requireStaff } from "@/lib/auth";
import { templateDefinitionSchema } from "@/lib/invitation/schema";
import { createClient } from "@/lib/supabase/server";
import { saveTemplateVersion } from "../../actions";

export const metadata = { title: "Éditeur visuel du modèle" };

export default async function TemplateVisualEditorPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = (await createClient())!;
  const { data: t } = await supabase.from("templates").select("id, name, current_version_id").eq("id", id).maybeSingle();
  if (!t?.current_version_id) notFound();
  const { data: v } = await supabase.from("template_versions").select("version, definition, created_at").eq("id", t.current_version_id).single();
  const def = templateDefinitionSchema.safeParse(v?.definition);
  if (!v || !def.success) {
    return <p role="alert" className="card p-6 text-sm">Ce modèle n&apos;a pas de version valide.</p>;
  }
  return (
    <VisualEditor
      initial={def.data.sample}
      renderer={def.data.renderer}
      save={saveTemplateVersion.bind(null, t.id)}
      autosave={false}
      initialSavedAt={v.created_at}
      savedLabel="Version enregistrée"
      title={`Modèle ${t.name}`}
      backHref={`/admin/modeles/${t.id}?onglet=design`}
      backLabel="Fiche du modèle"
      formHref={`/admin/modeles/${t.id}?onglet=design`}
    />
  );
}
