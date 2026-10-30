import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";

/** Empreinte non réversible de l'adresse IP (anti-spam, sans stocker l'IP). */
export async function hashedClientIp(): Promise<string> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  return createHash("sha256")
    .update(`${process.env.IP_HASH_SALT ?? "e-invitly"}:${ip}`)
    .digest("hex")
    .slice(0, 32);
}
