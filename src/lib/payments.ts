import "server-only";
import { randomBytes } from "node:crypto";
import { logActivity } from "./audit";
import { sendEmail } from "./email";
import { env } from "./env";
import { LANG_META, fmt, isSiteLang, localePath, type SiteLang } from "./i18n/config";
import { dictFor } from "./i18n/server";
import { formatMoney } from "./payment-amount";
import { getSettings } from "./settings";
import { createAdminClient } from "./supabase/admin";
import { accessLink, ensureAccount } from "./login-link";
import { orderStateFor } from "./orders";

export type PaymentRow = {
  id: string;
  invitation_id: string;
  token: string;
  amount_cents: number;
  currency: string;
  description: string;
  status: "pending" | "paid" | "cancelled";
  method: "paypal" | "stripe" | "manual" | null;
  paypal_order_id: string | null;
  stripe_session_id: string | null;
  provider_ref: string | null;
  payer_email: string | null;
  created_at: string;
  paid_at: string | null;
};

export type PaymentContext = {
  payment: PaymentRow;
  couple: string;
  templateName: string;
  clientEmail: string | null;
  /** Langue de l'invitation (e-mails au client) */
  lang: SiteLang;
};

export const newPaymentToken = () => randomBytes(24).toString("base64url");
export const paymentUrl = (token: string, lang: SiteLang = "fr") => `${env.siteUrl}${localePath(lang, `/paiement/${token}`)}`;

/** Paiement + invitation associée, lus côté serveur (clé secrète) à partir du jeton public. */
export async function loadPaymentByToken(token: string): Promise<PaymentContext | null> {
  if (!/^[A-Za-z0-9_-]{24,64}$/.test(token)) return null;
  const db = createAdminClient();
  if (!db) return null;
  const { data } = await db
    .from("payments")
    .select("*, invitations(title, partner_one, partner_two, client_email, language, templates(name))")
    .eq("token", token)
    .maybeSingle();
  if (!data) return null;
  const inv = data.invitations as unknown as {
    title: string;
    partner_one: string | null;
    partner_two: string | null;
    client_email: string | null;
    language: string;
    templates: { name: string } | null;
  } | null;
  const { invitations: _i, ...payment } = data as PaymentRow & { invitations: unknown };
  void _i;
  return {
    payment: payment as PaymentRow,
    couple: inv?.partner_one && inv?.partner_two ? `${inv.partner_one} & ${inv.partner_two}` : inv?.title ?? "",
    templateName: inv?.templates?.name ?? "",
    clientEmail: inv?.client_email ?? null,
    lang: isSiteLang(inv?.language) ? inv.language : "fr",
  };
}

/**
 * Enregistre un paiement réussi, une seule fois (même si PayPal, Stripe et le
 * webhook le signalent tous). Envoie la confirmation au client et prévient l'équipe.
 */
export async function markPaymentPaid(
  ctx: PaymentContext,
  p: { method: "paypal" | "stripe" | "manual"; providerRef: string | null; payerEmail: string | null; actorId?: string },
): Promise<boolean> {
  const db = createAdminClient();
  if (!db) return false;
  const { data: updated } = await db
    .from("payments")
    .update({ status: "paid", method: p.method, provider_ref: p.providerRef, payer_email: p.payerEmail, paid_at: new Date().toISOString() })
    .eq("id", ctx.payment.id)
    .eq("status", "pending")
    .select("id");
  if (!updated?.length) return false; // déjà enregistré

  const amount = formatMoney(ctx.payment.amount_cents, ctx.payment.currency, LANG_META[ctx.lang].intl);
  const methodLabel = p.method === "paypal" ? "PayPal" : p.method === "stripe" ? "carte (Stripe)" : "manuel";
  await logActivity({
    actorId: p.actorId,
    action: "payment.paid",
    resourceType: "invitation",
    resourceId: ctx.payment.invitation_id,
    summary: `Paiement reçu (${methodLabel}) : ${formatMoney(ctx.payment.amount_cents, ctx.payment.currency)} — ${ctx.couple}`,
  });

  const settings = await getSettings();
  // Commande en ligne : le client reçoit l'accès à son formulaire détaillé (aussi pour un paiement manuel ou simulé)
  const order = await orderStateFor(db, ctx.payment.invitation_id);
  if (order.selfService) {
    await sendOrderPaidEmails(ctx, amount, methodLabel, p, settings);
    return true;
  }
  if (p.method !== "manual") {
    const to = ctx.clientEmail || p.payerEmail;
    const m = dictFor(ctx.lang).payment;
    if (to) {
      const r = await sendEmail({
        to,
        subject: fmt(m.emailPaidSubject, { couple: ctx.couple }),
        heading: m.emailPaidHeading,
        paragraphs: [fmt(m.emailPaidText, { amount, couple: ctx.couple }), m.emailPaidNext, fmt(m.emailSignature, { brand: settings.brand.name })],
        replyTo: settings.brand.contactEmail || undefined,
        lang: ctx.lang,
      });
      if (!r.sent) console.warn("[payment] confirmation client non envoyée :", r.error);
    }
    const adminTo = process.env.ADMIN_NOTIFICATION_EMAIL || settings.brand.contactEmail;
    if (adminTo) {
      const r = await sendEmail({
        to: adminTo,
        subject: `Paiement reçu — ${ctx.couple}`,
        heading: "Paiement reçu",
        paragraphs: [
          `${formatMoney(ctx.payment.amount_cents, ctx.payment.currency)} payés par ${methodLabel}${p.payerEmail ? ` (${p.payerEmail})` : ""}.`,
          `Invitation : ${ctx.couple}. Vous pouvez la publier : ${env.siteUrl}/admin/invitations/${ctx.payment.invitation_id}?onglet=publication`,
        ],
      });
      if (!r.sent) console.warn("[payment] notification équipe non envoyée :", r.error);
    }
  }
  return true;
}

/** Commande en ligne payée : accès direct au formulaire détaillé pour le client, et avis à l'équipe. */
async function sendOrderPaidEmails(
  ctx: PaymentContext,
  amount: string,
  methodLabel: string,
  p: { providerRef: string | null; payerEmail: string | null },
  settings: Awaited<ReturnType<typeof getSettings>>,
) {
  const to = ctx.clientEmail || p.payerEmail;
  const t = dictFor(ctx.lang);
  const o = t.order;
  const next = `/mon-espace/${ctx.payment.invitation_id}/informations`;
  const db = createAdminClient();
  const { data: req } = db ? await db.from("client_requests").select("reference, form_data").eq("invitation_id", ctx.payment.invitation_id).maybeSingle() : { data: null };
  const legal = { reference: (req?.reference as string | undefined) ?? null, orderedAt: ((req?.form_data ?? {}) as { orderedAt?: string }).orderedAt ?? null };
  if (to) {
    await ensureAccount(to);
    const link = (await accessLink(to, next)) ?? `${env.siteUrl}/connexion?suite=${encodeURIComponent(next)}`;
    const r = await sendEmail({
      to,
      subject: o.paidSubject,
      heading: o.paidHeading,
      paragraphs: [fmt(o.paidText, { amount, couple: ctx.couple }), o.paidNext],
      action: { label: o.paidButton, url: link },
      after: [
        // Récapitulatif légal : demande de démarrage immédiat, CGV, droit de rétractation
        fmt(o.paidLegal, {
          ref: legal.reference ?? ctx.payment.id.slice(0, 8).toUpperCase(),
          date: new Intl.DateTimeFormat(LANG_META[ctx.lang].intl, { dateStyle: "long" }).format(new Date(legal.orderedAt ?? ctx.payment.created_at)),
          template: ctx.templateName,
          amount,
          terms: `${env.siteUrl}${localePath(ctx.lang, "/cgv")}`,
        }),
        ...(settings.brand.contactEmail ? [fmt(o.paidWithdrawal, { email: settings.brand.contactEmail })] : []),
        fmt(t.access.welcomeLater, { login: `${env.siteUrl.replace(/^https?:\/\//, "")}${localePath(ctx.lang, "/connexion")}` }),
        fmt(t.payment.emailSignature, { brand: settings.brand.name }),
      ],
      lang: ctx.lang,
    });
    if (!r.sent) console.warn("[payment] accès formulaire non envoyé :", r.error);
  }
  const adminTo = process.env.ADMIN_NOTIFICATION_EMAIL || settings.brand.contactEmail;
  if (adminTo) {
    const test = p.providerRef === "SIMULATION";
    const r = await sendEmail({
      to: adminTo,
      subject: `${test ? "[TEST] " : ""}Commande payée — ${ctx.couple}`,
      heading: test ? "Paiement simulé (test)" : "Commande payée",
      paragraphs: [
        `${formatMoney(ctx.payment.amount_cents, ctx.payment.currency)} — ${test ? "simulation, aucun montant encaissé" : `payés par ${methodLabel}`}.`,
        `Le client a reçu l'accès à son formulaire détaillé. Vous serez prévenue dès qu'il l'aura envoyé : ${env.siteUrl}/admin/invitations/${ctx.payment.invitation_id}`,
      ],
    });
    if (!r.sent) console.warn("[payment] notification équipe non envoyée :", r.error);
  }
}
