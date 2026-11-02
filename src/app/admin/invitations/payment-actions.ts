"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logActivity } from "@/lib/audit";
import { requireStaff } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { LANG_META, fmt } from "@/lib/i18n/config";
import { dictFor } from "@/lib/i18n/server";
import { amountFromPriceLabel, formatMoney } from "@/lib/payment-amount";
import { loadPaymentByToken, markPaymentPaid, newPaymentToken, paymentUrl } from "@/lib/payments";
import { getSettings } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";

const uuid = z.string().uuid();
const refresh = (id: string) => revalidatePath(`/admin/invitations/${id}`);

/** Crée le lien de paiement, au prix du modèle (figé au moment de la création). */
export async function createPaymentLink(form: FormData) {
  const user = await requireStaff();
  const invitationId = uuid.parse(form.get("id"));
  const supabase = (await createClient())!;
  const { data: inv } = await supabase.from("invitations").select("title, templates(name, price_label)").eq("id", invitationId).single();
  if (!inv) throw new Error("Invitation introuvable.");
  const { data: existing } = await supabase.from("payments").select("status").eq("invitation_id", invitationId).in("status", ["pending", "paid"]);
  if (existing?.length) throw new Error("Un lien de paiement existe déjà pour cette invitation.");
  const tpl = inv.templates as unknown as { name: string; price_label: string | null } | null;
  const amount = amountFromPriceLabel(tpl?.price_label);
  if (!amount) {
    throw new Error("Le modèle de cette invitation n'a pas de prix en euros. Ajoutez-le dans Modèles → fiche du modèle → « Prix affiché sur le site » (À partir de… ou Prix fixe).");
  }
  const { error } = await supabase.from("payments").insert({
    invitation_id: invitationId,
    token: newPaymentToken(),
    amount_cents: amount,
    currency: "EUR",
    description: `${tpl?.name ?? "Invitation"} — ${inv.title}`,
    created_by: user.id,
  });
  if (error) throw new Error(`Création impossible : ${error.message}`);
  await logActivity({ actorId: user.id, action: "payment.link_created", resourceType: "invitation", resourceId: invitationId, summary: `Lien de paiement créé (${formatMoney(amount)})` });
  refresh(invitationId);
}

/** Envoie le lien de paiement au client, dans la langue de son invitation. */
export async function sendPaymentLink(form: FormData) {
  const user = await requireStaff();
  const paymentId = uuid.parse(form.get("paymentId"));
  const supabase = (await createClient())!;
  const { data: row } = await supabase.from("payments").select("token, invitation_id").eq("id", paymentId).single();
  if (!row) throw new Error("Paiement introuvable.");
  const ctx = await loadPaymentByToken(row.token);
  if (!ctx || ctx.payment.status !== "pending") throw new Error("Ce lien n'est plus en attente de paiement.");
  if (!ctx.clientEmail) throw new Error("Aucun e-mail client sur cette invitation : copiez le lien et envoyez-le vous-même.");
  const m = dictFor(ctx.lang).payment;
  const settings = await getSettings();
  const amount = formatMoney(ctx.payment.amount_cents, ctx.payment.currency, LANG_META[ctx.lang].intl);
  const res = await sendEmail({
    to: ctx.clientEmail,
    subject: m.emailLinkSubject,
    heading: m.emailLinkHeading,
    paragraphs: [fmt(m.emailLinkText, { couple: ctx.couple, amount }), fmt(m.emailLinkCta, { url: paymentUrl(row.token, ctx.lang) }), fmt(m.emailSignature, { brand: settings.brand.name })],
    replyTo: settings.brand.contactEmail || undefined,
    lang: ctx.lang,
  });
  if (!res.sent) throw new Error(`E-mail non envoyé (${res.error ?? "service e-mail"}). Copiez le lien et envoyez-le vous-même.`);
  await logActivity({ actorId: user.id, action: "payment.link_sent", resourceType: "invitation", resourceId: row.invitation_id, summary: `Lien de paiement envoyé à ${ctx.clientEmail}` });
  refresh(row.invitation_id);
}

/** Paiement reçu autrement (virement, espèces…) ou commande offerte. */
export async function markPaidManually(form: FormData) {
  const user = await requireStaff();
  const paymentId = uuid.parse(form.get("paymentId"));
  const note = z.string().trim().max(120).parse(form.get("payment_ref") ?? "");
  const supabase = (await createClient())!;
  const { data: row } = await supabase.from("payments").select("token, invitation_id").eq("id", paymentId).single();
  if (!row) throw new Error("Paiement introuvable.");
  const ctx = await loadPaymentByToken(row.token);
  if (!ctx) throw new Error("Paiement introuvable.");
  await markPaymentPaid(ctx, { method: "manual", providerRef: note || null, payerEmail: null, actorId: user.id });
  refresh(row.invitation_id);
}

export async function cancelPaymentLink(form: FormData) {
  const user = await requireStaff();
  const paymentId = uuid.parse(form.get("paymentId"));
  const supabase = (await createClient())!;
  const { data } = await supabase.from("payments").update({ status: "cancelled" }).eq("id", paymentId).eq("status", "pending").select("invitation_id").maybeSingle();
  if (data) {
    await logActivity({ actorId: user.id, action: "payment.cancelled", resourceType: "invitation", resourceId: data.invitation_id, summary: "Lien de paiement annulé" });
    refresh(data.invitation_id);
  }
}
