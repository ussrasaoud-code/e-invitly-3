import Link from "next/link";
import { notFound } from "next/navigation";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { VisualEditor } from "@/components/editor/VisualEditor";
import { requireStaff } from "@/lib/auth";
import { LANG_META } from "@/lib/i18n/config";
import { LANGUAGES, templateDefinitionSchema, type Language } from "@/lib/invitation/schema";
import { getVariant, mainLang, templateLangs } from "@/lib/invitation/variants";
import { createClient } from "@/lib/supabase/server";
import {
  addTemplateLanguage,
  publishTemplateDraft,
  removeTemplateLanguage,
  saveTemplateDraft,
  setTemplateStatus,
  syncTemplateLanguages,
  toggleFeatured,
} from "../../actions";

export const metadata = { title: "Éditeur visuel du modèle" };

export default async function TemplateVisualEditorPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ langue?: string }> }) {
  await requireStaff();
  const { id } = await params;
  const { langue } = await searchParams;
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
  const d = def.data;
  const main = mainLang(d);
  const langs = templateLangs(d);
  const lang: Language = (LANGUAGES as readonly string[]).includes(langue ?? "") && langs.includes(langue as Language) ? (langue as Language) : main;
  const content = getVariant(d, lang) ?? d.sample;
  const missing = LANGUAGES.filter((l) => !langs.includes(l));
  const base = `/admin/modeles/${t.id}/editeur`;

  return (
    <VisualEditor
      key={lang}
      initial={content}
      renderer={d.renderer}
      save={saveTemplateDraft.bind(null, t.id, lang)}
      publish={publishTemplateDraft.bind(null, t.id, lang)}
      initialSavedAt={useDraft ? draft!.updated_at : v.created_at}
      savedLabel="Brouillon enregistré"
      backupKey={`ei-backup:modele:${t.id}:${lang}`}
      translation={lang !== main ? { main: d.sample, mainLang: main, lang } : undefined}
      title={`Modèle ${t.name}`}
      backHref={`/admin/modeles/${t.id}?onglet=design`}
      backLabel="Fiche du modèle"
      formHref={`/admin/modeles/${t.id}?onglet=design`}
      headerExtra={
        <>
          <div className="flex items-center gap-2 border-s border-line ps-4 text-xs">
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
          {/* Versions par langue : un seul design, des textes traduits */}
          <div className="flex flex-wrap items-center gap-1.5 border-s border-line ps-4 text-xs" aria-label="Langues du modèle">
            {langs.map((l) => (
              <Link
                key={l}
                href={l === main ? base : `${base}?langue=${l}`}
                aria-current={l === lang ? "page" : undefined}
                title={`${LANG_META[l].native}${l === main ? " (langue principale)" : ""}`}
                className={`rounded-full border px-2.5 py-1 ${l === lang ? "border-forest bg-forest text-ivory" : "border-line hover:border-forest"}`}
              >
                {LANG_META[l].short}
                {l === main ? <span aria-hidden="true"> ★</span> : null}
              </Link>
            ))}
            {missing.length ? (
              <form action={addTemplateLanguage} className="flex items-center gap-1">
                <input type="hidden" name="id" value={t.id} />
                <label className="sr-only" htmlFor="ve-add-lang">Ajouter une langue</label>
                <select id="ve-add-lang" name="lang" className="field min-h-7 w-auto py-0 text-xs" defaultValue={missing[0]}>
                  {missing.map((l) => <option key={l} value={l}>{LANG_META[l].native}</option>)}
                </select>
                <SubmitButton className="btn btn-secondary btn-sm !min-h-7 !px-2" pendingLabel="…">+ Langue</SubmitButton>
              </form>
            ) : null}
            {lang === main && langs.length > 1 ? (
              <form action={syncTemplateLanguages}>
                <input type="hidden" name="id" value={t.id} />
                <SubmitButton
                  className="btn btn-ghost btn-sm !min-h-7 !px-2"
                  pendingLabel="…"
                  confirm="Appliquer le design de cette version à toutes les autres langues ? Les textes traduits sont conservés ; les ajustements de mise en page faits dans les autres langues sont remplacés."
                >
                  Appliquer ce design aux autres langues
                </SubmitButton>
              </form>
            ) : null}
            {lang !== main ? (
              <form action={removeTemplateLanguage}>
                <input type="hidden" name="id" value={t.id} />
                <input type="hidden" name="lang" value={lang} />
                <SubmitButton className="btn btn-ghost btn-sm !min-h-7 !px-2 text-danger" pendingLabel="…" confirm={`Retirer la version ${LANG_META[lang].native} de ce modèle ?`}>
                  Retirer cette langue
                </SubmitButton>
              </form>
            ) : null}
          </div>
        </>
      }
    />
  );
}
