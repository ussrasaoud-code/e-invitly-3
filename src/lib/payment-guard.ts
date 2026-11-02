import "server-only";
import { hashedClientIp } from "./net";
import { createAdminClient } from "./supabase/admin";

/** Limite les essais de paiement par connexion (20 par heure). */
export async function paymentRateLimitOk(): Promise<boolean> {
  const db = createAdminClient();
  if (!db) return false;
  const { data } = await db.rpc("check_rate_limit", { p_bucket: `pay:${await hashedClientIp()}`, p_limit: 20, p_window_seconds: 3600 });
  return data !== false;
}
