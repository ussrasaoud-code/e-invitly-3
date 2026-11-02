import { NextResponse } from "next/server";
import { isSiteLang } from "@/lib/i18n/config";
import { paymentRateLimitOk } from "@/lib/payment-guard";
import { loadPaymentByToken, paymentUrl } from "@/lib/payments";
import { createStripeSession, isStripeConfigured } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

type Ctx = { params: Promise<{ token: string }> };

/** Carte bancaire : crée une session Stripe Checkout au montant enregistré, renvoie son adresse. */
export async function POST(req: Request, { params }: Ctx) {
  const { token } = await params;
  if (!isStripeConfigured()) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  if (!(await paymentRateLimitOk())) return NextResponse.json({ error: "rate" }, { status: 429 });
  const ctx = await loadPaymentByToken(token);
  if (!ctx) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (ctx.payment.status !== "pending") return NextResponse.json({ error: ctx.payment.status }, { status: 409 });
  const body = (await req.json().catch(() => ({}))) as { lang?: string };
  const lang = isSiteLang(body.lang) ? body.lang : ctx.lang;
  const back = paymentUrl(token, lang);
  try {
    const session = await createStripeSession({
      amountCents: ctx.payment.amount_cents,
      currency: ctx.payment.currency,
      reference: ctx.payment.id,
      name: `E-Invitly — ${ctx.templateName} — ${ctx.couple}`,
      successUrl: `${back}?stripe=retour&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${back}?stripe=annule`,
      locale: lang,
      email: ctx.clientEmail,
    });
    await createAdminClient()!.from("payments").update({ stripe_session_id: session.id }).eq("id", ctx.payment.id).eq("status", "pending");
    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("[stripe] session", e);
    return NextResponse.json({ error: "provider" }, { status: 502 });
  }
}
