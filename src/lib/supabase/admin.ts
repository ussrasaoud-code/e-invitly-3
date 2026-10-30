import "server-only";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Client « service_role » : contourne RLS. À n'utiliser QUE dans du code
 * serveur, après avoir vérifié les droits (requireStaff) ou validé une
 * saisie publique (demande, RSVP). `server-only` empêche tout import
 * accidentel dans le navigateur.
 */
let cached: SupabaseClient | null = null;

export function createAdminClient(): SupabaseClient | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!env.supabaseUrl || !key) return null;
  cached ??= createSupabaseClient(env.supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
