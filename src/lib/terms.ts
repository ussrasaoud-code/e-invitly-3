import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Empreinte d'une version des CGV (le texte change → l'empreinte change). */
export const termsVersion = (body: string) => createHash("sha256").update(body.trim()).digest("hex").slice(0, 16);

/**
 * Enregistre la version des CGV en vigueur (une seule fois par version) et renvoie son empreinte,
 * à garder avec la commande. Renvoie null si aucune CGV n'est publiée.
 */
export async function recordTermsVersion(db: SupabaseClient, body: string | null | undefined): Promise<string | null> {
  const text = (body ?? "").trim();
  if (!text) return null;
  const hash = termsVersion(text);
  const { error } = await db.from("terms_versions").upsert({ hash, body: text }, { onConflict: "hash", ignoreDuplicates: true });
  if (error) console.error("[cgv] version non enregistrée :", error.message);
  return hash;
}
