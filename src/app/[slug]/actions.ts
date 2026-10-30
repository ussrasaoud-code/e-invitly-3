"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { hashedClientIp } from "@/lib/net";
import { accessCookieName, getPublicInvitation, hashAccessCode } from "@/lib/publication";
import { createAdminClient } from "@/lib/supabase/admin";

export type CodeState = { error?: string };

/** Vérifie le code d'accès d'une invitation protégée (10 essais / heure / connexion). */
export async function unlockInvitation(_prev: CodeState, form: FormData): Promise<CodeState> {
  const slug = z.string().max(80).parse(form.get("slug"));
  const code = z.string().max(60).parse(form.get("code") ?? "");
  if (!code.trim()) return { error: "Saisissez le code reçu avec l'invitation." };

  const admin = createAdminClient();
  if (admin) {
    const { data: allowed } = await admin.rpc("check_rate_limit", {
      p_bucket: `code:${slug}:${await hashedClientIp()}`,
      p_limit: 10,
      p_window_seconds: 3600,
    });
    if (allowed === false) return { error: "Trop de tentatives. Réessayez dans une heure." };
  }

  const first = await getPublicInvitation(slug);
  if (!first || first.kind === "redirect") return { error: "Cette invitation n'est plus disponible." };
  if (first.kind === "ok") redirect(`/${slug}`);

  const hash = hashAccessCode(first.invitationId, code);
  const check = await getPublicInvitation(slug, hash);
  if (check?.kind !== "ok") return { error: "Code incorrect. Vérifiez le message reçu avec l'invitation." };

  (await cookies()).set(accessCookieName(first.invitationId), hash, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 60,
  });
  redirect(`/${slug}`);
}
