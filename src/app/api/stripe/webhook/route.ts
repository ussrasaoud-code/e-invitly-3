import { NextResponse } from "next/server";
import { markPaymentPaid } from "@/lib/payments";
import { verifyStripeSignature } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { confirmStripePayment } from "@/lib/stripe-confirm";

/**
 * Webhook Stripe (checkout.session.completed) : confirme le paiement même si le
 * client ferme la page avant de revenir sur le site. Signature obligatoire.
 */
export async function POST(req: Request) {
  const payload = await req.text();
  if (!verifyStripeSignature(payload, req.headers.get("stripe-signature"), process.env.STRIPE_WEBHOOK_SECRET ?? "")) {
    return NextResponse.json({ error: "signature" }, { status: 400 });
  }
  const event = JSON.parse(payload) as { type: string; data: { object: { id: string } } };
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const db = createAdminClient();
    if (db) await confirmStripePayment(event.data.object.id, markPaymentPaid);
  }
  return NextResponse.json({ received: true });
}
