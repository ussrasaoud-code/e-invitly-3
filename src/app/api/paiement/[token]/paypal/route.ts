import { NextResponse } from "next/server";
import { decimalAmount } from "@/lib/payment-amount";
import { paymentRateLimitOk } from "@/lib/payment-guard";
import { loadPaymentByToken, markPaymentPaid } from "@/lib/payments";
import { capturePayPalOrder, createPayPalOrder, isPayPalConfigured } from "@/lib/paypal";
import { createAdminClient } from "@/lib/supabase/admin";

type Ctx = { params: Promise<{ token: string }> };

/**
 * PayPal : { action: "create" } crée la commande au montant enregistré en base
 * (jamais un montant envoyé par le navigateur) ; { action: "capture", orderID }
 * encaisse puis vérifie montant, devise et référence avant de valider.
 */
export async function POST(req: Request, { params }: Ctx) {
  const { token } = await params;
  if (!isPayPalConfigured()) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  if (!(await paymentRateLimitOk())) return NextResponse.json({ error: "rate" }, { status: 429 });
  const ctx = await loadPaymentByToken(token);
  if (!ctx) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as { action?: string; orderID?: string };
  const { payment } = ctx;
  const db = createAdminClient()!;

  if (body.action === "create") {
    if (payment.status !== "pending") return NextResponse.json({ error: payment.status }, { status: 409 });
    try {
      const id = await createPayPalOrder({
        amountCents: payment.amount_cents,
        currency: payment.currency,
        reference: payment.id,
        description: `E-Invitly — ${ctx.templateName} — ${ctx.couple}`,
      });
      await db.from("payments").update({ paypal_order_id: id }).eq("id", payment.id).eq("status", "pending");
      return NextResponse.json({ id });
    } catch (e) {
      console.error("[paypal] create", e);
      return NextResponse.json({ error: "provider" }, { status: 502 });
    }
  }

  if (body.action === "capture") {
    if (payment.status === "paid") return NextResponse.json({ ok: true });
    if (payment.status !== "pending" || !body.orderID || body.orderID !== payment.paypal_order_id) {
      return NextResponse.json({ error: "invalid" }, { status: 400 });
    }
    try {
      const cap = await capturePayPalOrder(body.orderID);
      const valid =
        cap.completed && cap.customId === payment.id && cap.currency === payment.currency && cap.amount === decimalAmount(payment.amount_cents);
      if (!valid) {
        console.error("[paypal] capture non conforme", { payment: payment.id, cap });
        return NextResponse.json({ error: "failed" }, { status: 402 });
      }
      await markPaymentPaid(ctx, { method: "paypal", providerRef: cap.captureId, payerEmail: cap.payerEmail });
      return NextResponse.json({ ok: true });
    } catch (e) {
      console.error("[paypal] capture", e);
      return NextResponse.json({ error: "failed" }, { status: 502 });
    }
  }
  return NextResponse.json({ error: "invalid" }, { status: 400 });
}
