import { notFound } from "next/navigation";
import { VisualEditor } from "@/components/editor/VisualEditor";
import { requireStaff } from "@/lib/auth";
import { invitationContentSchema, type RendererKey } from "@/lib/invitation/schema";
import { createClient } from "@/lib/supabase/server";
import { saveInvitationDraft } from "../../actions";
import { createDraftCheckpoint, listDraftHistory, restoreDraftSnapshot } from "../../history-actions";

export const metadata = { title: "Éditeur visuel" };

export default async function InvitationVisualEditorPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = (await createClient())!;
  const { data: inv } = await supabase.from("invitations").select("id, title, renderer, draft_content, draft_updated_at").eq("id", id).maybeSingle();
  if (!inv) notFound();
  const parsed = invitationContentSchema.safeParse(inv.draft_content);
  if (!parsed.success) {
    return <p role="alert" className="card p-6 text-sm">Le contenu de cette invitation ne respecte pas le format attendu et ne peut pas être édité.</p>;
  }
  return (
    <VisualEditor
      initial={parsed.data}
      renderer={inv.renderer as RendererKey}
      save={saveInvitationDraft.bind(null, inv.id)}
      initialSavedAt={inv.draft_updated_at}
      title={inv.title}
      backHref={`/admin/invitations/${inv.id}`}
      backLabel="Fiche de l'invitation"
      formHref={`/admin/invitations/${inv.id}?onglet=contenu`}
      history={{
        list: listDraftHistory.bind(null, inv.id),
        checkpoint: createDraftCheckpoint.bind(null, inv.id),
        restore: restoreDraftSnapshot.bind(null, inv.id),
      }}
    />
  );
}
