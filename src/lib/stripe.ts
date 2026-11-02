import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Stripe Checkout : page de paiement hébergée par Stripe (carte, Apple Pay,
 * Google Pay et moyens locaux activés dans le tableau de bord Stripe).
 * Clé secrète côté serveur uniquement.
 */
const base = () => process.env.STRIPE_API_BASE || "https://api.stripe.com";
export const isStripeConfigured = () => Boolean(process.env.STRIPE_SECRET_KEY);

function form(obj: Record<string, string | number | undefined>): string {
  return Object.entries(obj)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
}

async function stripe<T>(path: string, init: { method?: string; body?: string; idempotencyKey?: string } = {}): Promise<T> {
  const res = await fetch(`${base()}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
      ...(init.idempotencyKey ? { "Idempotency-Key": init.idempotencyKey } : {}),
    },
    body: init.body,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Stripe ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

export type StripeSession = { id: string; url: string | null; payment_status: string; status: string; amount_total: number | null; currency: string | null; client_reference_id: string | null; payment_intent: string | null; customer_details?: { email?: string | null } | null };

export async function createStripeSession(p: {
  amountCents: number;
  currency: string;
  reference: string;
  name: string;
  successUrl: string;
  cancelUrl: string;
  locale: string;
  email?: string | null;
}): Promise<StripeSession> {
  return stripe<StripeSession>("/v1/checkout/sessions", {
    method: "POST",
    body: form({
      mode: "payment",
      client_reference_id: p.reference,
      "metadata[payment_id]": p.reference,
      "payment_intent_data[metadata][payment_id]": p.reference,
      "line_items[0][quantity]": 1,
      "line_items[0][price_data][currency]": p.currency.toLowerCase(),
      "line_items[0][price_data][unit_amount]": p.amountCents,
      "line_items[0][price_data][product_data][name]": p.name.slice(0, 250),
      success_url: p.successUrl,
      cancel_url: p.cancelUrl,
      locale: p.locale,
      customer_email: p.email || undefined,
    }),
  });
}

export const getStripeSession = (id: string) => {
  if (!/^cs_[A-Za-z0-9_]{6,200}$/.test(id)) throw new Error("Session Stripe invalide");
  return stripe<StripeSession>(`/v1/checkout/sessions/${id}`);
};

/** Vérifie la signature d'un webhook Stripe (en-tête Stripe-Signature, tolérance 5 minutes). */
export function verifyStripeSignature(payload: string, header: string | null, secret: string, now = Date.now()): boolean {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(",").map((kv) => kv.split("=", 2) as [string, string]));
  const t = Number(parts.t);
  const v1 = header.split(",").filter((kv) => kv.startsWith("v1=")).map((kv) => kv.slice(3));
  if (!t || !v1.length || Math.abs(now / 1000 - t) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  return v1.some((sig) => sig.length === expected.length && timingSafeEqual(Buffer.from(sig), Buffer.from(expected)));
}
