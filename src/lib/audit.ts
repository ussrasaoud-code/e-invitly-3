import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/** Journalise une opération (alimente « Activité récente » et la traçabilité). */
export async function logActivity(entry: {
  actorId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  summary: string;
  details?: Record<string, unknown>;
}) {
  const db = createAdminClient();
  if (!db) return;
  const { error } = await db.from("audit_logs").insert({
    actor_id: entry.actorId ?? null,
    action: entry.action,
    resource_type: entry.resourceType,
    resource_id: entry.resourceId ?? null,
    summary: entry.summary,
    details: entry.details ?? {},
  });
  if (error) console.error("[audit] échec d'écriture du journal", error.message);
}
