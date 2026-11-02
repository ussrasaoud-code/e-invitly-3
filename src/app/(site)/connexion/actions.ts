"use server";

import { z } from "zod";
import { isEmailConfigured } from "@/lib/email";
import { env } from "@/lib/env";
import { sendLoginEmail } from "@/lib/login-link";
import { isSiteLang } from "@/lib/i18n/config";
import { dictFor } from "@/lib/i18n/server";
import { hashedClientIp } from "@/lib/net";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { status: "idle" | "sent" | "error"; message?: string };

const safeNext = (v: unknown) => (typeof v === "string" && /^\/(?!\/)[\w\-/]*$/.test(v) ? v : "/mon-espace");

/** Envoie un lien de connexion. Aucun compte n'est créé ici (comptes créés par l'administration). */
export async function sendMagicLink(_prev: LoginState, form: FormData): Promise<LoginState> {
  const uiLang = form.get("lang");
  const t = dictFor(isSiteLang(uiLang) ? uiLang : "fr").login;
  const email = z.string().trim().toLowerCase().email().safeParse(form.get("email"));
  if (!email.success) return { status: "error", message: t.invalidEmail };

  const supabase = await createClient();
  if (!supabase) return { status: "error", message: t.notConfigured };

  const admin = createAdminClient();
  if (admin) {
    const { data: ok } = await admin.rpc("check_rate_limit", {
      p_bucket: `login:${await hashedClientIp()}`,
      p_limit: 8,
      p_window_seconds: 3600,
    });
    if (ok === false) return { status: "error", message: t.tooMany };
  }

  const next = safeNext(form.get("suite"));
  const lang = isSiteLang(uiLang) ? uiLang : "fr";
  if (isEmailConfigured()) {
    // Notre service d'e-mails (Resend) : fiable et dans la langue du visiteur
    const r = await sendLoginEmail(email.data, next, lang);
    if (!r.sent && r.error !== "compte inconnu") console.error("[login] e-mail", r.error);
  } else {
    // Repli : e-mail envoyé par Supabase (limité à quelques envois par heure)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.data,
      options: { shouldCreateUser: false, emailRedirectTo: `${env.siteUrl}/auth/callback?suite=${encodeURIComponent(next)}` },
    });
    if (error && !/not found|signups not allowed|otp_disabled/i.test(error.message)) {
      console.error("[login]", error.message);
      if (/rate limit/i.test(error.message)) return { status: "error", message: t.tooManyLinks };
    }
  }
  // Même réponse que le compte existe ou non : on ne révèle pas qui est inscrit.
  return {
    status: "sent",
    message: t.sent,
  };
}
