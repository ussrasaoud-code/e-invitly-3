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
import { simulatePayment } from "./simulate-action";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { orderStateFor } from "@/lib/orders";
import { createAdminClient } from "@/lib/supabase/admin";

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
  const o = t.order;
  const db = createAdminClient();
  const order = db ? await orderStateFor(db, payment.invitation_id) : null;
  const selfService = !!order?.selfService;
  const user = await getCurrentUser();
  const staff = user?.role === "admin" || user?.role === "collaborator";
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

          {selfService ? (
            <div className="mt-6 rounded-sm bg-paper/70 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-stone">{o.promiseTitle}</p>
              <ul className="mt-3 space-y-2 text-sm">
                {[o.promiseRevisions, o.promisePreview, o.promiseLanguages].map((x) => (
                  <li key={x} className="flex items-start gap-2">
                    <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0 text-forest" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="m5 12 4.5 4.5L19 7" />
                    </svg>
                    {x}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-8">
            {payment.status === "paid" ? (
              <div role="status" className="text-center">
                <Sprig className="mx-auto h-20 w-12 text-forest" fill="#A6B5A2" />
                <p className="mt-4 leading-relaxed">{selfService ? o.paidOrderText : m.paidText}</p>
                {payment.paid_at ? (
                  <p className="mt-2 text-sm text-stone">
                    {fmt(m.paidOn, { date: new Intl.DateTimeFormat(intl, { dateStyle: "long" }).format(new Date(payment.paid_at)) })}
                  </p>
                ) : null}
                {selfService && !order?.detailsAt ? (
                  <Link href={`/mon-espace/${payment.invitation_id}/informations`} className="btn btn-primary mt-5">{o.paidButton}</Link>
                ) : null}
              </div>
            ) : payment.status === "cancelled" ? (
              <p role="alert" className="text-center text-stone">{m.cancelled}</p>
            ) : !paypalId && !stripeOn ? (
              <p role="alert" className="text-center text-stone">{m.unavailable}</p>
            ) : null}
            {payment.status === "pending" && (paypalId || stripeOn) ? (
              <>
                <p className="mb-5 text-center text-sm text-stone">{selfService ? o.introOrder : m.intro}</p>
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
            ) : null}
            {payment.status === "pending" && staff ? (
              <form action={simulatePayment} className="mt-6 border-t border-dashed border-line pt-5 text-center">
                <input type="hidden" name="token" value={token} />
                <button type="submit" className="btn btn-secondary btn-sm">{o.simulate}</button>
                <p className="mt-2 text-xs text-stone">{o.simulateHint}</p>
              </form>
            ) : null}
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
