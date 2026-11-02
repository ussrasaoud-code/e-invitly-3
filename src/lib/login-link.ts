import "server-only";
import { sendEmail, isEmailConfigured } from "./email";
import { env } from "./env";
import { fmt, isSiteLang, localePath, type SiteLang } from "./i18n/config";
import { dictFor } from "./i18n/server";
import { getSettings } from "./settings";
import { createAdminClient } from "./supabase/admin";

const safeNext = (v: string) => (/^\/(?!\/)[\w\-/]*$/.test(v) ? v : "/mon-espace");

/**
 * Lien de connexion à usage unique (1 heure), envoyé par notre propre service
 * d'e-mails (Resend) plutôt que par celui de Supabase, très limité.
 * La page /auth/confirm vérifie le jeton et ouvre la session.
 */
async function generateLink(email: string, next: string): Promise<string | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data?.properties?.hashed_token) return null;
  const q = new URLSearchParams({ token_hash: data.properties.hashed_token, type: "magiclink", suite: safeNext(next) });
  return `${env.siteUrl}/auth/confirm?${q.toString()}`;
}

/** Crée le compte s'il n'existe pas encore (les inscriptions libres restent fermées). */
export async function ensureAccount(email: string): Promise<boolean> {
  const admin = createAdminClient();
  if (!admin) return false;
  const { error } = await admin.auth.admin.createUser({ email: email.toLowerCase(), email_confirm: true });
  return !error || /already|exists|registered/i.test(error.message);
}

/** Formulaire « Connexion » : n'envoie un lien qu'aux comptes existants (réponse identique sinon). */
export async function sendLoginEmail(email: string, next: string, lang: SiteLang): Promise<{ sent: boolean; error?: string }> {
  const link = await generateLink(email, next);
  if (!link) return { sent: false, error: "compte inconnu" };
  const t = dictFor(lang).access;
  const { brand } = await getSettings();
  return sendEmail({
    to: email,
    subject: t.loginSubject,
    heading: t.loginHeading,
    paragraphs: [fmt(t.loginText, { url: link }), t.loginIgnore, fmt(t.signature, { brand: brand.name })],
    lang,
  });
}

/** Ouverture de l'espace mariés : crée le compte si besoin et envoie l'e-mail de bienvenue. */
export async function sendWelcomeEmail(email: string, couple: string, lang: string): Promise<{ sent: boolean; error?: string }> {
  if (!isEmailConfigured()) return { sent: false, error: "Service d'e-mails non configuré (Resend)" };
  if (!(await ensureAccount(email))) return { sent: false, error: "Création du compte impossible" };
  const l: SiteLang = isSiteLang(lang) ? lang : "fr";
  const link = await generateLink(email, "/mon-espace");
  if (!link) return { sent: false, error: "Lien de connexion impossible à générer" };
  const t = dictFor(l).access;
  const { brand } = await getSettings();
  return sendEmail({
    to: email,
    subject: fmt(t.welcomeSubject, { couple }),
    heading: t.welcomeHeading,
    paragraphs: [
      fmt(t.welcomeText, { couple }),
      fmt(t.welcomeCta, { url: link }),
      fmt(t.welcomeLater, { login: `${env.siteUrl.replace(/^https?:\/\//, "")}${localePath(l, "/connexion")}` }),
      fmt(t.signature, { brand: brand.name }),
    ],
    replyTo: brand.contactEmail || undefined,
    lang: l,
  });
}
