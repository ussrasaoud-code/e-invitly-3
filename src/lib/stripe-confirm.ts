import "server-only";
import { loadPaymentByToken, type PaymentContext } from "./payments";
import { getStripeSession } from "./stripe";
import { createAdminClient } from "./supabase/admin";

type MarkPaid = (ctx: PaymentContext, p: { method: "stripe"; providerRef: string | null; payerEmail: string | null }) => Promise<boolean>;

/**
 * Relit la session auprès de Stripe (jamais de confiance dans l'adresse de retour)
 * et valide le paiement si montant, devise et référence correspondent.
 */
export async function confirmStripePayment(sessionId: string, markPaid: MarkPaid): Promise<"paid" | "pending" | "invalid"> {
  const db = createAdminClient();
  if (!db) return "invalid";
  const { data: row } = await db.from("payments").select("token").eq("stripe_session_id", sessionId).maybeSingle();
  if (!row) return "invalid";
  const ctx = await loadPaymentByToken(row.token);
  if (!ctx) return "invalid";
  if (ctx.payment.status === "paid") return "paid";
  const s = await getStripeSession(sessionId);
  const ok =
    s.payment_status === "paid" &&
    s.client_reference_id === ctx.payment.id &&
    s.amount_total === ctx.payment.amount_cents &&
    (s.currency ?? "").toUpperCase() === ctx.payment.currency;
  if (!ok) return s.payment_status === "unpaid" ? "pending" : "invalid";
  await markPaid(ctx, { method: "stripe", providerRef: s.payment_intent, payerEmail: s.customer_details?.email ?? null });
  return "paid";
}
