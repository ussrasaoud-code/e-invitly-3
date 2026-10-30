"use server";

import { z } from "zod";
import { env } from "@/lib/env";
import { hashedClientIp } from "@/lib/net";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { status: "idle" | "sent" | "error"; message?: string };

const safeNext = (v: unknown) => (typeof v === "string" && /^\/(?!\/)[\w\-/]*$/.test(v) ? v : "/mon-espace");

/** Envoie un lien de connexion. Aucun compte n'est créé ici (comptes créés par l'administration). */
export async function sendMagicLink(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = z.string().trim().toLowerCase().email().safeParse(form.get("email"));
  if (!email.success) return { status: "error", message: "Adresse e-mail invalide." };

  const supabase = await createClient();
  if (!supabase) return { status: "error", message: "Le service de connexion n'est pas encore configuré." };

  const admin = createAdminClient();
  if (admin) {
    const { data: ok } = await admin.rpc("check_rate_limit", {
      p_bucket: `login:${await hashedClientIp()}`,
      p_limit: 8,
      p_window_seconds: 3600,
    });
    if (ok === false) return { status: "error", message: "Trop de tentatives. Réessayez dans une heure." };
  }

  const next = safeNext(form.get("suite"));
  const { error } = await supabase.auth.signInWithOtp({
    email: email.data,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${env.siteUrl}/auth/callback?suite=${encodeURIComponent(next)}`,
    },
  });
  // Même réponse que le compte existe ou non : on ne révèle pas qui est inscrit.
  if (error && !/not found|signups not allowed|otp_disabled/i.test(error.message)) {
    console.error("[login]", error.message);
    if (/rate limit/i.test(error.message)) {
      return { status: "error", message: "Trop de demandes de lien. Patientez quelques minutes." };
    }
  }
  return {
    status: "sent",
    message: "Si cette adresse est associée à un compte, un lien de connexion vient de lui être envoyé. Il est valable une heure.",
  };
}
