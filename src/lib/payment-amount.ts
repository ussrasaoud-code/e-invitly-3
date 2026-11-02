import { parsePrice } from "./price";

/** Montant à payer (en centimes) d'après le prix affiché du modèle ; null si le prix n'est pas un montant. */
export function amountFromPriceLabel(label: string | null | undefined): number | null {
  const p = parsePrice(label);
  if (p.mode !== "from" && p.mode !== "fixed") return null;
  const cents = Math.round(Number(p.amount.replace(",", ".")) * 100);
  return Number.isFinite(cents) && cents > 0 ? cents : null;
}

/** 17500 → « 175,00 € » (ou « €175.00 » en anglais). */
export function formatMoney(cents: number, currency = "EUR", locale = "fr-FR"): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(cents / 100);
}

/** 17500 → « 175.00 » (format attendu par PayPal) */
export const decimalAmount = (cents: number) => (cents / 100).toFixed(2);
