import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { invitationContentSchema, type InvitationContent, type RendererKey } from "@/lib/invitation/schema";
import { validateSlug } from "@/lib/slug";

/** Adresse publique complète d'une invitation. */
export const publicUrl = (slug: string) => `${env.siteUrl}/${slug}`;

/* ── Code d'accès ─────────────────────────────────────────────────────
   Le code n'est jamais stocké en clair : on garde un HMAC calculé avec
   un secret serveur et l'identifiant de l'invitation. */
function codeSecret() {
  return process.env.ACCESS_CODE_SECRET || process.env.IP_HASH_SALT || "e-invitly-access-code";
}
export const normalizeAccessCode = (code: string) => code.trim().toLowerCase().replace(/\s+/g, "");
export function hashAccessCode(invitationId: string, code: string) {
  return createHmac("sha256", codeSecret()).update(`${invitationId}:${normalizeAccessCode(code)}`).digest("hex");
}
export const accessCookieName = (invitationId: string) => `ei_acces_${invitationId.replace(/-/g, "").slice(0, 16)}`;

/* ── Jetons d'aperçu ───────────────────────────────────────────────── */
export function newPreviewToken() {
  const token = randomBytes(24).toString("base64url");
  return { token, hash: hashPreviewToken(token) };
}
export const hashPreviewToken = (token: string) => createHash("sha256").update(token).digest("hex");
export function sameHash(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/* ── Lecture publique ──────────────────────────────────────────────── */
export type PublicInvitation =
  | { kind: "redirect"; to: string }
  | { kind: "locked"; invitationId: string; slug: string }
  | { kind: "ok"; invitationId: string; slug: string; renderer: RendererKey; noindex: boolean; content: InvitationContent; version: number };

/**
 * Lit la version publiée via la fonction SQL dédiée, avec la clé PUBLIQUE :
 * les règles de la base s'appliquent comme pour n'importe quel visiteur.
 */
export async function getPublicInvitation(slug: string, codeHash?: string | null): Promise<PublicInvitation | null> {
  if (validateSlug(slug) === "format" || validateSlug(slug) === "empty" || validateSlug(slug) === "too-long") return null;
  if (!env.supabaseUrl || !env.supabaseAnonKey) return null;
  const db = createSupabaseClient(env.supabaseUrl, env.supabaseAnonKey, { auth: { persistSession: false } });
  const { data, error } = await db.rpc("get_published_invitation", { p_slug: slug, p_code_hash: codeHash ?? null });
  if (error) {
    console.error("[invitation publique]", error.message);
    return null;
  }
  const row = (Array.isArray(data) ? data[0] : data) as
    | {
        invitation_id: string | null;
        slug: string | null;
        renderer: string;
        noindex: boolean;
        unlocked: boolean;
        content: unknown;
        version: number | null;
        redirect_to: string | null;
      }
    | undefined;
  if (!row) return null;
  if (row.redirect_to) return { kind: "redirect", to: row.redirect_to };
  if (!row.invitation_id || !row.slug) return null;
  if (!row.unlocked) return { kind: "locked", invitationId: row.invitation_id, slug: row.slug };
  const parsed = invitationContentSchema.safeParse(row.content);
  if (!parsed.success) {
    console.error("[invitation publique] contenu invalide", slug, parsed.error.issues.slice(0, 3));
    return null;
  }
  return {
    kind: "ok",
    invitationId: row.invitation_id,
    slug: row.slug,
    renderer: row.renderer as RendererKey,
    noindex: row.noindex,
    content: parsed.data,
    version: row.version ?? 0,
  };
}
