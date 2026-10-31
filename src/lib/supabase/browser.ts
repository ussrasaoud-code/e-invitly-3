"use client";

import { createBrowserClient } from "@supabase/ssr";

/** Client Supabase du navigateur (clé publique) : utilisé uniquement pour envoyer
 *  un fichier avec une autorisation à usage unique délivrée par le serveur. */
let client: ReturnType<typeof createBrowserClient> | null = null;
export function browserClient() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");
  client ??= createBrowserClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "");
  return client;
}
