import Link from "next/link";
import { notFound } from "next/navigation";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { VisualEditor } from "@/components/editor/VisualEditor";
import { requireStaff } from "@/lib/auth";
import { LANG_META } from "@/lib/i18n/config";
import { altOf, stripAlt, syncInvitationAlt } from "@/lib/invitation/bilingual";
import { LANGUAGES, invitationContentSchema, type RendererKey } from "@/lib/invitation/schema";
import { getSettings } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";
import { addInvitationLanguage, removeInvitationLanguage, saveInvitationAlt, saveInvitationDraft } from "../../actions";
import { createDraftCheckpoint, listDraftHistory, restoreDraftSnapshot } from "../../history-actions";

export const metadata = { title: "Éditeur visuel" };

export default async function InvitationVisualEditorPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ langue?: string }> }) {
  await requireStaff();
  const { id } = await params;
  const { langue } = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = (await createClient())!;
  const { data: inv } = await supabase.from("invitations").select("id, title, renderer, draft_content, draft_updated_at").eq("id", id).maybeSingle();
  if (!inv) notFound();
  const parsed = invitationContentSchema.safeParse(inv.draft_content);
  if (!parsed.success) {
    return <p role="alert" className="card p-6 text-sm">Le contenu de cette invitation ne respecte pas le format attendu et ne peut pas être édité.</p>;
  }
  const main = parsed.data;
  const alt = altOf(main);
  const editingAlt = !!alt && langue === alt.language;
  const base = `/admin/invitations/${inv.id}/editeur`;
  // Deuxième langue : celles ouvertes sur le site en priorité
  const { languages } = await getSettings();
  const offered = LANGUAGES.filter((l) => l !== main.language);
  const preferred = offered.filter((l) => languages.enabled.includes(l));

  const tabs = (
    <div className="flex flex-wrap items-center gap-1.5 border-s border-line ps-4 text-xs" aria-label="Langues de l'invitation">
      {[main.language, ...(alt ? [alt.language] : [])].map((l, i) => (
        <Link
          key={l}
          href={i === 0 ? base : `${base}?langue=${l}`}
          aria-current={(i === 0 ? !editingAlt : editingAlt) ? "page" : undefined}
          title={`${LANG_META[l].native}${i === 0 ? " (langue principale)" : ""}`}
          className={`rounded-full border px-2.5 py-1 ${(i === 0 ? !editingAlt : editingAlt) ? "border-forest bg-forest text-ivory" : "border-line hover:border-forest"}`}
        >
          {LANG_META[l].short}
          {i === 0 ? <span aria-hidden="true"> ★</span> : null}
        </Link>
      ))}
      {!alt ? (
        <form action={addInvitationLanguage} className="flex items-center gap-1">
          <input type="hidden" name="id" value={inv.id} />
          <label className="sr-only" htmlFor="ve-add-lang">Ajouter une deuxième langue</label>
          <select id="ve-add-lang" name="lang" className="field min-h-7 w-auto py-0 text-xs" defaultValue={(preferred[0] ?? offered[0]) as string}>
            {[...preferred, ...offered.filter((l) => !preferred.includes(l))].map((l) => <option key={l} value={l}>{LANG_META[l].native}</option>)}
          </select>
          <SubmitButton className="btn btn-secondary btn-sm !min-h-7 !px-2" pendingLabel="…">+ 2e langue</SubmitButton>
        </form>
      ) : editingAlt ? (
        <form action={removeInvitationLanguage}>
          <input type="hidden" name="id" value={inv.id} />
          <SubmitButton className="btn btn-ghost btn-sm !min-h-7 !px-2 text-danger" pendingLabel="…" confirm={`Retirer la version ${LANG_META[alt.language].native} de cette invitation ?`}>
            Retirer cette langue
          </SubmitButton>
        </form>
      ) : null}
      {editingAlt ? <span className="text-stone">Traduisez les textes ici : le design suit la version principale.</span> : null}
    </div>
  );

  if (editingAlt && alt) {
    return (
      <VisualEditor
        key={`alt-${alt.language}`}
        initial={syncInvitationAlt(main, alt)}
        renderer={inv.renderer as RendererKey}
        save={saveInvitationAlt.bind(null, inv.id)}
        initialSavedAt={inv.draft_updated_at}
        title={`${inv.title} · ${LANG_META[alt.language].native}`}
        backHref={`/admin/invitations/${inv.id}`}
        backLabel="Fiche de l'invitation"
        formHref={`/admin/invitations/${inv.id}?onglet=contenu`}
        backupKey={`ei-backup:invitation:${inv.id}:${alt.language}`}
        translation={{ main: stripAlt(main), mainLang: main.language, lang: alt.language }}
        headerExtra={tabs}
      />
    );
  }
  return (
    <VisualEditor
      key="main"
      initial={main}
      renderer={inv.renderer as RendererKey}
      save={saveInvitationDraft.bind(null, inv.id)}
      initialSavedAt={inv.draft_updated_at}
      title={inv.title}
      backHref={`/admin/invitations/${inv.id}`}
      backLabel="Fiche de l'invitation"
      formHref={`/admin/invitations/${inv.id}?onglet=contenu`}
      backupKey={`ei-backup:invitation:${inv.id}`}
      headerExtra={tabs}
      history={{
        list: listDraftHistory.bind(null, inv.id),
        checkpoint: createDraftCheckpoint.bind(null, inv.id),
        restore: restoreDraftSnapshot.bind(null, inv.id),
      }}
    />
  );
}
