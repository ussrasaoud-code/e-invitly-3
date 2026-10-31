"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logActivity } from "@/lib/audit";
import { requireStaff } from "@/lib/auth";
import { invitationContentSchema, type InvitationContent } from "@/lib/invitation/schema";
import { createClient } from "@/lib/supabase/server";
import { saveInvitationDraft } from "./actions";

const uuid = z.string().uuid();

export type DraftSnapshot = { id: string; kind: "auto" | "manual" | "restore"; label: string | null; created_at: string; author: string | null };

/** Points de restauration du brouillon, du plus récent au plus ancien. */
export async function listDraftHistory(invitationId: string): Promise<DraftSnapshot[]> {
  await requireStaff();
  const supabase = (await createClient())!;
  const { data, error } = await supabase
    .from("invitation_draft_history")
    .select("id, kind, label, created_at, profiles!created_by(full_name, email)")
    .eq("invitation_id", uuid.parse(invitationId))
    .order("created_at", { ascending: false })
    .limit(60);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => {
    const p = (r as { profiles?: { full_name?: string | null; email?: string | null } | null }).profiles;
    return { id: r.id, kind: r.kind as DraftSnapshot["kind"], label: r.label, created_at: r.created_at, author: p?.full_name || p?.email || null };
  });
}

/** « Créer un point de sauvegarde » : fige le brouillon actuel avec un nom. */
export async function createDraftCheckpoint(invitationId: string, label: string): Promise<{ ok: boolean; message?: string }> {
  const user = await requireStaff();
  const supabase = (await createClient())!;
  const id = uuid.parse(invitationId);
  const { data: inv } = await supabase.from("invitations").select("draft_content").eq("id", id).single();
  if (!inv) return { ok: false, message: "Invitation introuvable." };
  const name = z.string().trim().max(120).catch("").parse(label) || "Point de sauvegarde";
  const { error } = await supabase.from("invitation_draft_history").insert({ invitation_id: id, content: inv.draft_content, kind: "manual", label: name, created_by: user.id });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

/** Remet un point de restauration dans le brouillon (l'état remplacé est conservé). */
export async function restoreDraftSnapshot(invitationId: string, snapshotId: string): Promise<{ ok: true; content: InvitationContent; savedAt: string } | { ok: false; message: string }> {
  const user = await requireStaff();
  const supabase = (await createClient())!;
  const id = uuid.parse(invitationId);
  const [{ data: snap }, { data: inv }] = await Promise.all([
    supabase.from("invitation_draft_history").select("content, created_at").eq("id", uuid.parse(snapshotId)).eq("invitation_id", id).maybeSingle(),
    supabase.from("invitations").select("draft_content, title").eq("id", id).maybeSingle(),
  ]);
  if (!snap || !inv) return { ok: false, message: "Point de restauration introuvable." };
  const parsed = invitationContentSchema.safeParse(snap.content);
  if (!parsed.success) return { ok: false, message: "Ce point de restauration n'est plus lisible." };
  const when = new Date(snap.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris" });
  await supabase.from("invitation_draft_history").insert({ invitation_id: id, content: inv.draft_content, kind: "restore", label: `Avant la restauration du ${when}`, created_by: user.id });
  const saved = await saveInvitationDraft(id, parsed.data);
  if (!saved.ok) return { ok: false, message: saved.message };
  await logActivity({ actorId: user.id, action: "invitation.draft_restored", resourceType: "invitation", resourceId: id, summary: `Brouillon de ${inv.title} restauré (état du ${when})` });
  revalidatePath(`/admin/invitations/${id}`);
  return { ok: true, content: parsed.data, savedAt: saved.savedAt };
}
