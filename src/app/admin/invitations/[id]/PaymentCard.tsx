import { CopyButton } from "@/components/admin/CopyButton";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { formatDateTime } from "@/lib/time";
import type { SiteLang } from "@/lib/i18n/config";
import { amountFromPriceLabel, formatMoney } from "@/lib/payment-amount";
import type { PaymentRow } from "@/lib/payments";
import { paymentUrl } from "@/lib/payments";
import { isPayPalConfigured } from "@/lib/paypal";
import { isStripeConfigured } from "@/lib/stripe";
import { cancelPaymentLink, createPaymentLink, markPaidManually, sendPaymentLink } from "../payment-actions";

const METHOD: Record<string, string> = { paypal: "PayPal", stripe: "carte bancaire (Stripe)", manual: "manuel" };

/** Paiement de la commande : lien à envoyer au client, suivi, encaissement manuel. */
export function PaymentCard({
  invitationId,
  payments,
  templatePrice,
  clientEmail,
  lang,
  emailReady,
}: {
  invitationId: string;
  payments: PaymentRow[];
  templatePrice: string | null;
  clientEmail: string | null;
  lang: SiteLang;
  emailReady: boolean;
}) {
  const paid = payments.find((p) => p.status === "paid");
  const pending = payments.find((p) => p.status === "pending");
  const amount = amountFromPriceLabel(templatePrice);
  const providers = [isStripeConfigured() ? "carte bancaire" : null, isPayPalConfigured() ? "PayPal" : null].filter(Boolean);

  return (
    <section className="card p-5 lg:col-span-2" aria-labelledby="paiement-titre">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="paiement-titre" className="font-serif text-2xl">Paiement</h2>
          <p className="mt-1 text-sm text-stone">
            Après validation de l&apos;aperçu, envoyez le lien de paiement au client. L&apos;invitation se publie une fois le paiement reçu.
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs ${paid ? "bg-success/15 text-success" : pending ? "bg-warning/15 text-warning" : "bg-paper text-stone"}`}>
          {paid ? "Payé" : pending ? "En attente de paiement" : "Pas de lien de paiement"}
        </span>
      </div>

      {paid ? (
        <p className="mt-4 text-sm">
          <strong className="font-medium">{formatMoney(paid.amount_cents, paid.currency)}</strong> payés le {formatDateTime(paid.paid_at)} par {METHOD[paid.method ?? ""] ?? "—"}
          {paid.payer_email ? ` (${paid.payer_email})` : ""}
          {paid.provider_ref ? <span className="text-stone"> · réf. {paid.provider_ref}</span> : null}
        </p>
      ) : pending ? (
        <div className="mt-4 space-y-4">
          <div className="rounded-sm border border-line bg-paper p-4">
            <p className="text-xs uppercase tracking-wider text-stone">Lien de paiement · {formatMoney(pending.amount_cents, pending.currency)}</p>
            <p className="mt-1 break-all">{paymentUrl(pending.token, lang)}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <CopyButton text={paymentUrl(pending.token, lang)} className="btn btn-secondary btn-sm" />
              <a href={paymentUrl(pending.token, lang)} target="_blank" rel="noopener" className="btn btn-ghost btn-sm">Ouvrir ↗</a>
              {clientEmail && emailReady ? (
                <form action={sendPaymentLink}>
                  <input type="hidden" name="paymentId" value={pending.id} />
                  <SubmitButton className="btn btn-primary btn-sm" pendingLabel="Envoi…" confirm={`Envoyer le lien de paiement à ${clientEmail} ?`}>
                    Envoyer au client par e-mail
                  </SubmitButton>
                </form>
              ) : null}
            </div>
            {!providers.length ? (
              <p className="mt-3 text-sm text-warning">
                Aucun moyen de paiement en ligne n&apos;est encore configuré (clés PayPal et Stripe dans Netlify) : le client verra un message l&apos;invitant à vous contacter.
              </p>
            ) : (
              <p className="mt-3 text-xs text-stone">Moyens proposés au client : {providers.join(" et ")}.</p>
            )}
          </div>
          <div className="flex flex-wrap items-end gap-3 border-t border-line pt-4">
            <form action={markPaidManually} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="paymentId" value={pending.id} />
              <label className="text-sm">
                <span className="field-label !text-xs">Paiement reçu autrement</span>
                <input name="payment_ref" maxLength={120} placeholder="ex. virement du 12/11" className="field min-h-10 w-56 text-sm" />
              </label>
              <SubmitButton className="btn btn-secondary btn-sm" pendingLabel="…" confirm="Marquer cette commande comme payée ?">
                Marquer comme payé
              </SubmitButton>
            </form>
            <form action={cancelPaymentLink}>
              <input type="hidden" name="paymentId" value={pending.id} />
              <SubmitButton className="btn btn-ghost btn-sm text-danger" pendingLabel="…" confirm="Annuler ce lien de paiement ? Le client ne pourra plus l'utiliser.">
                Annuler le lien
              </SubmitButton>
            </form>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {amount ? (
            <form action={createPaymentLink}>
              <input type="hidden" name="id" value={invitationId} />
              <SubmitButton className="btn btn-primary btn-sm" pendingLabel="Création…">
                Créer le lien de paiement ({formatMoney(amount)})
              </SubmitButton>
            </form>
          ) : (
            <p className="text-sm text-warning">
              Le modèle n&apos;a pas de prix en euros : ajoutez-le dans la fiche du modèle (« Prix affiché sur le site ») pour créer le lien de paiement.
            </p>
          )}
          <p className="text-xs text-stone">Montant = prix du modèle{templatePrice ? ` (« ${templatePrice} »)` : ""}.</p>
        </div>
      )}
      {payments.some((p) => p.status === "cancelled") ? (
        <p className="mt-3 text-xs text-stone">{payments.filter((p) => p.status === "cancelled").length} lien(s) annulé(s) précédemment.</p>
      ) : null}
    </section>
  );
}
