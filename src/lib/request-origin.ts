import type { NextRequest } from "next/server";
import { env } from "./env";

/**
 * Adresse publique réellement utilisée par le visiteur (ex. https://e-invitly.com).
 * Sur Netlify, l'URL interne d'une requête peut être l'adresse technique du
 * déploiement (xxxx--site.netlify.app) : y rediriger ferait perdre la session,
 * dont les cookies appartiennent au domaine du visiteur.
 */
export function publicOrigin(request: NextRequest | Request): string {
  const h = request.headers;
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(",")[0].trim();
  if (host && /^[a-z0-9.-]+(:\d+)?$/i.test(host)) {
    const proto = (h.get("x-forwarded-proto") ?? "").split(",")[0].trim() || (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
    return `${proto}://${host}`;
  }
  return env.siteUrl;
}

export const publicUrl = (path: string, request: NextRequest | Request) => new URL(path, publicOrigin(request));
