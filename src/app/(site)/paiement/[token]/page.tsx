import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Sprig } from "@/components/ornaments";
import { LANG_META, fmt } from "@/lib/i18n/config";
import { getDict } from "@/lib/i18n/server";
import { formatMoney } from "@/lib/payment-amount";
import { loadPaymentByToken, markPaymentPaid } from "@/lib/payments";
import { isPayPalConfigured } from "@/lib/paypal";
import { getSettings } from "@/lib/settings";
import { isStripeConfigured } from "@/lib/stripe";
import { confirmStripePayment } from "@/lib/stripe-confirm";
import { PayButtons } from "./PayButtons";

type Props = { params: Promise<{ token: string }>; searchParams: Promise<{ stripe?: string; session_id?: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDict();
  return { title: t.payment.metaTitle, robots: { index: false, follow: false } };
}

/** Page de paiement d'une commande (lien envoyé au client après validation de l'aperçu). */
export default async function PaymentPage({ params, searchParams }: Props) {
  const { token } = await params;
  const { stripe, session_id } = await searchParams;
  const { lang, t } = await getDict();
  const m = t.payment;

  // Retour de Stripe : on vérifie la session auprès de Stripe avant tout
  let confirmed = false;
  if (stripe === "retour" && session_id) {
    try {
      confirmed = (await confirmStripePayment(session_id, markPaymentPaid)) === "paid";
    } catch (e) {
      console.error("[stripe] retour", e);
    }
  }
  const ctx = await loadPaymentByToken(token);
  if (!ctx) notFound();
  // Les lectures d'une même page sont mises en commun par Next.js : on reprend le résultat de la vérification
  const payment = confirmed && ctx.payment.status === "pending" ? { ...ctx.payment, status: "paid" as const, paid_at: new Date().toISOString() } : ctx.payment;
  const { brand } = await getSettings();
  const intl = LANG_META[lang].intl;
  const amount = formatMoney(payment.amount_cents, payment.currency, intl);
  const paypalId = isPayPalConfigured() ? process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? null : null;
  const stripeOn = isStripeConfigured();
  const testMode = process.env.PAYPAL_ENV !== "live" && (paypalId !== null || stripeOn) && !(process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_live");

  return (
    <main className="px-5 pb-24 pt-12 md:pt-16">
      <div className="mx-auto max-w-lg">
        <div className="text-center">
          <p className="eyebrow">{m.eyebrow}</p>
          <h1 className="mt-4 font-serif text-4xl md:text-5xl">{payment.status === "paid" ? m.paidTitle : m.title}</h1>
        </div>

        <section className="card mt-10 p-6 md:p-8">
          <p className="font-serif text-2xl">{fmt(m.forCouple, { couple: ctx.couple })}</p>
          <dl className="mt-5 space-y-2 text-sm">
            {ctx.templateName ? (
              <div className="flex justify-between gap-4">
                <dt className="text-stone">{m.template}</dt>
                <dd>{ctx.templateName}</dd>
              </div>
            ) : null}
            <div className="flex items-baseline justify-between gap-4 border-t border-line pt-3">
              <dt className="text-stone">{m.amount}</dt>
              <dd className="font-serif text-3xl text-forest">{amount}</dd>
            </div>
          </dl>

          <div className="mt-8">
            {payment.status === "paid" ? (
              <div role="status" className="text-center">
                <Sprig className="mx-auto h-20 w-12 text-forest" fill="#A6B5A2" />
                <p className="mt-4 leading-relaxed">{m.paidText}</p>
                {payment.paid_at ? (
                  <p className="mt-2 text-sm text-stone">
                    {fmt(m.paidOn, { date: new Intl.DateTimeFormat(intl, { dateStyle: "long" }).format(new Date(payment.paid_at)) })}
                  </p>
                ) : null}
              </div>
            ) : payment.status === "cancelled" ? (
              <p role="alert" className="text-center text-stone">{m.cancelled}</p>
            ) : !paypalId && !stripeOn ? (
              <p role="alert" className="text-center text-stone">{m.unavailable}</p>
            ) : (
              <>
                <p className="mb-5 text-center text-sm text-stone">{m.intro}</p>
                {stripe === "annule" ? <p className="mb-4 text-center text-sm text-stone">{m.cancelledByUser}</p> : null}
                <PayButtons
                  token={token}
                  lang={lang}
                  currency={payment.currency}
                  t={m}
                  paypalClientId={paypalId}
                  paypalMock={process.env.NEXT_PUBLIC_PAYPAL_MOCK === "1"}
                  stripeEnabled={stripeOn}
                />
                {testMode ? <p className="mt-4 text-center text-xs text-warning">{m.testMode}</p> : null}
              </>
            )}
          </div>
        </section>

        <p className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-stone">
          <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="5" y="10" width="14" height="10" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          </svg>
          {m.secure}
        </p>
        <p className="mt-2 text-xs text-stone">
          {fmt(m.reference, { ref: payment.id.slice(0, 8).toUpperCase() })}
          {brand.contactEmail ? <> · {fmt(m.questions, { email: brand.contactEmail })}</> : null}
        </p>
      </div>
    </main>
  );
}
