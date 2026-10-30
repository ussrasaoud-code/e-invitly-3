import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { findAvailableSlug } from "@/lib/slug";

/** Un slug est pris s'il appartient à une invitation OU à une ancienne redirection. */
export async function isSlugTaken(db: SupabaseClient, slug: string, exceptInvitationId?: string) {
  let q = db.from("invitations").select("id").eq("slug", slug).limit(1);
  if (exceptInvitationId) q = q.neq("id", exceptInvitationId);
  const [{ data: inv }, { data: red }] = await Promise.all([
    q,
    db.from("slug_redirects").select("invitation_id").eq("old_slug", slug).limit(1),
  ]);
  const redirectOwner = red?.[0]?.invitation_id;
  return Boolean(inv?.length) || Boolean(redirectOwner && redirectOwner !== exceptInvitationId);
}

export function suggestSlug(db: SupabaseClient, base: string, exceptInvitationId?: string) {
  return findAvailableSlug(base, (c) => isSlugTaken(db, c, exceptInvitationId));
}
