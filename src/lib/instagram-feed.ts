import "server-only";
import { unstable_cache, revalidateTag } from "next/cache";
import { createAdminClient } from "./supabase/admin";

/**
 * Derniers posts Instagram affichés en bas du site vitrine.
 * Jeton d'accès (IGAA… « connexion Instagram », ou EAA… utilisateur système Meta Business) gardé
 * dans un paramètre privé (jamais lu par le navigateur), renouvelé automatiquement
 * avant ses 60 jours de validité. Les images passent par notre serveur :
 * les visiteurs ne contactent jamais Instagram (pas de bandeau cookies nécessaire).
 */

export type InstagramConnection = {
  token: string;
  username: string;
  /** « instagram » : jeton IGAA… (connexion Instagram, renouvelé tous les 60 jours) ;
   *  « facebook » : jeton EAA… (utilisateur système Meta Business, sans expiration) */
  kind?: "instagram" | "facebook";
  /** Identifiant du compte Instagram professionnel (jetons « facebook ») */
  igUserId?: string;
  savedAt: string;
  refreshedAt: string;
  lastError?: string;
};

export type InstagramPost = {
  id: string;
  caption: string;
  permalink: string;
  isVideo: boolean;
  /** Image à afficher (miniature pour une vidéo) — URL Instagram, servie via /api/instagram/image/:id */
  imageUrl: string;
};

const KEY = "instagram";
const TAG = "instagram-feed";
export const igBase = () => process.env.INSTAGRAM_API_BASE || "https://graph.instagram.com";
export const fbBase = () => process.env.FACEBOOK_GRAPH_BASE || "https://graph.facebook.com/v21.0";
export const tokenKind = (token: string): "instagram" | "facebook" => (/^EAA/.test(token) ? "facebook" : "instagram");

export async function loadConnection(): Promise<InstagramConnection | null> {
  const db = createAdminClient();
  if (!db) return null;
  const { data } = await db.from("settings").select("value").eq("key", KEY).maybeSingle();
  const v = data?.value as InstagramConnection | undefined;
  return v?.token ? v : null;
}

export async function saveConnection(value: InstagramConnection | null, actorId?: string, refresh = true) {
  const db = createAdminClient();
  if (!db) throw new Error("Base non configurée");
  const { error } = await db.from("settings").upsert({ key: KEY, value: value ?? {}, is_public: false, updated_by: actorId ?? null }, { onConflict: "key" });
  if (error) throw new Error(error.message);
  if (refresh) revalidateTag(TAG, "max");
}

type CheckResult = { ok: true; username: string; igUserId?: string } | { ok: false; message: string };

async function getJson(url: string) {
  const r = await fetch(url, { cache: "no-store" });
  const j = (await r.json().catch(() => ({}))) as Record<string, unknown> & { error?: { message?: string } };
  return { ok: r.ok && !j.error, status: r.status, j };
}

/**
 * Vérifie un jeton et renvoie le nom du compte Instagram.
 * Jeton Facebook (EAA…) : l'identifiant du compte Instagram est retrouvé via les pages
 * reliées, ou doit être indiqué (Meta Business Suite → Paramètres → Comptes Instagram).
 */
export async function checkToken(token: string, igUserId = ""): Promise<CheckResult> {
  const t = encodeURIComponent(token);
  try {
    if (tokenKind(token) === "instagram") {
      const { ok, status, j } = await getJson(`${igBase()}/me?fields=user_id,username&access_token=${t}`);
      if (!ok || typeof j.username !== "string") return { ok: false, message: j.error?.message ?? `Erreur ${status}` };
      return { ok: true, username: j.username };
    }
    if (igUserId) {
      const { ok, status, j } = await getJson(`${fbBase()}/${encodeURIComponent(igUserId)}?fields=id,username&access_token=${t}`);
      if (ok && typeof j.username === "string") return { ok: true, username: j.username, igUserId };
      // Certains jetons ne lisent pas la fiche du compte mais bien ses posts : on vérifie les posts
      const m = await getJson(`${fbBase()}/${encodeURIComponent(igUserId)}/media?fields=id,username&limit=1&access_token=${t}`);
      if (m.ok && Array.isArray(m.j.data)) {
        const first = (m.j.data as Array<{ username?: string }>)[0];
        return { ok: true, username: first?.username ?? "compte Instagram", igUserId };
      }
      return { ok: false, message: j.error?.message ?? m.j.error?.message ?? `Erreur ${status}` };
    }
    const { ok, j } = await getJson(`${fbBase()}/me/accounts?fields=instagram_business_account{id,username}&access_token=${t}`);
    const found = ok ? ((j.data as Array<{ instagram_business_account?: { id: string; username: string } }> | undefined) ?? []).find((p) => p.instagram_business_account)?.instagram_business_account : undefined;
    if (found) return { ok: true, username: found.username, igUserId: found.id };
    return { ok: false, message: "compte Instagram introuvable avec ce jeton : indiquez l'identifiant du compte Instagram (champ ci-dessous)" };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Instagram injoignable" };
  }
}

const DAY = 86_400_000;

/** Renouvelle le jeton (valable 60 jours) une fois par semaine. */
async function maybeRefresh(c: InstagramConnection): Promise<InstagramConnection> {
  // Jeton d'utilisateur système (EAA…) : n'expire pas, rien à renouveler
  if (c.kind === "facebook") return c;
  const age = Date.now() - new Date(c.refreshedAt || c.savedAt).getTime();
  if (age < 7 * DAY) return c;
  try {
    const r = await fetch(`${igBase()}/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(c.token)}`, { cache: "no-store" });
    const j = (await r.json()) as { access_token?: string; error?: { message?: string } };
    if (!r.ok || !j.access_token) {
      const next = { ...c, lastError: `Renouvellement impossible : ${j.error?.message ?? r.status}` };
      await saveConnection(next, undefined, false).catch(() => {});
      return next;
    }
    const next = { ...c, token: j.access_token, refreshedAt: new Date().toISOString(), lastError: undefined };
    await saveConnection(next, undefined, false).catch(() => {});
    return next;
  } catch {
    return c;
  }
}

async function fetchFeed(): Promise<InstagramPost[]> {
  const conn = await loadConnection();
  if (!conn) return [];
  const c = await maybeRefresh(conn);
  try {
    const fields = "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp";
    const url =
      c.kind === "facebook" && c.igUserId
        ? `${fbBase()}/${encodeURIComponent(c.igUserId)}/media?fields=${fields}&limit=12&access_token=${encodeURIComponent(c.token)}`
        : `${igBase()}/me/media?fields=${fields}&limit=12&access_token=${encodeURIComponent(c.token)}`;
    const r = await fetch(url, { cache: "no-store" });
    const j = (await r.json()) as { data?: Array<{ id: string; caption?: string; media_type: string; media_url?: string; thumbnail_url?: string; permalink: string }>; error?: { message?: string } };
    if (!r.ok || !j.data) {
      console.error("[instagram]", j.error?.message ?? r.status);
      if (!c.lastError) await saveConnection({ ...c, lastError: j.error?.message ?? `Erreur ${r.status}` }, undefined, false).catch(() => {});
      return [];
    }
    if (c.lastError) await saveConnection({ ...c, lastError: undefined }, undefined, false).catch(() => {});
    return j.data
      .map((m) => ({
        id: m.id,
        caption: (m.caption ?? "").slice(0, 300),
        permalink: m.permalink,
        isVideo: m.media_type === "VIDEO",
        imageUrl: (m.media_type === "VIDEO" ? m.thumbnail_url : m.media_url) ?? "",
      }))
      .filter((p) => p.imageUrl && /^https:\/\//.test(p.permalink))
      .slice(0, 8);
  } catch (e) {
    console.error("[instagram]", e);
    return [];
  }
}

/** Posts mis en cache une heure (et renouvellement du jeton au passage). */
export const getInstagramFeed = unstable_cache(fetchFeed, ["instagram-feed-v2"], { revalidate: 3600, tags: [TAG] });
