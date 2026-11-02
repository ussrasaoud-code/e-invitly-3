import "server-only";
import { decimalAmount } from "./payment-amount";

/**
 * PayPal Checkout (API REST v2). Le navigateur n'a que l'identifiant public ;
 * la clé secrète reste sur le serveur. PAYPAL_ENV=live pour les vrais paiements,
 * sinon le bac à sable (sandbox) de PayPal.
 */
const base = () =>
  process.env.PAYPAL_API_BASE || (process.env.PAYPAL_ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com");

export const isPayPalConfigured = () => Boolean(process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);

async function accessToken(): Promise<string> {
  const id = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID!;
  const secret = process.env.PAYPAL_CLIENT_SECRET!;
  const res = await fetch(`${base()}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`PayPal auth ${res.status}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

export async function createPayPalOrder(p: { amountCents: number; currency: string; reference: string; description: string }): Promise<string> {
  const res = await fetch(`${base()}/v2/checkout/orders`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json", "PayPal-Request-Id": `order-${p.reference}-${p.amountCents}` },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: p.reference,
          custom_id: p.reference,
          description: p.description.slice(0, 127),
          amount: { currency_code: p.currency, value: decimalAmount(p.amountCents) },
        },
      ],
      payment_source: { paypal: { experience_context: { brand_name: "E-Invitly", shipping_preference: "NO_SHIPPING", user_action: "PAY_NOW" } } },
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`PayPal order ${res.status}: ${await res.text()}`);
  return ((await res.json()) as { id: string }).id;
}

export type PayPalCapture = { completed: boolean; captureId: string | null; amount: string | null; currency: string | null; customId: string | null; payerEmail: string | null };

export async function capturePayPalOrder(orderId: string): Promise<PayPalCapture> {
  if (!/^[A-Z0-9-]{5,40}$/i.test(orderId)) throw new Error("Commande PayPal invalide");
  const res = await fetch(`${base()}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json", "PayPal-Request-Id": `capture-${orderId}` },
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as {
    status?: string;
    payer?: { email_address?: string };
    purchase_units?: Array<{ custom_id?: string; payments?: { captures?: Array<{ id: string; status: string; custom_id?: string; amount: { value: string; currency_code: string } }> } }>;
    details?: Array<{ issue?: string }>;
  };
  // Déjà capturée (double clic, rechargement) : on relit la commande
  if (!res.ok && data.details?.some((d) => d.issue === "ORDER_ALREADY_CAPTURED")) return readPayPalOrder(orderId);
  if (!res.ok) throw new Error(`PayPal capture ${res.status}`);
  return parseOrder(data);
}

async function readPayPalOrder(orderId: string): Promise<PayPalCapture> {
  const res = await fetch(`${base()}/v2/checkout/orders/${orderId}`, { headers: { Authorization: `Bearer ${await accessToken()}` }, cache: "no-store" });
  if (!res.ok) throw new Error(`PayPal lecture ${res.status}`);
  return parseOrder(await res.json());
}

function parseOrder(data: {
  status?: string;
  payer?: { email_address?: string };
  purchase_units?: Array<{ custom_id?: string; payments?: { captures?: Array<{ id: string; status: string; custom_id?: string; amount: { value: string; currency_code: string } }> } }>;
}): PayPalCapture {
  const unit = data.purchase_units?.[0];
  const cap = unit?.payments?.captures?.[0];
  return {
    completed: data.status === "COMPLETED" && cap?.status === "COMPLETED",
    captureId: cap?.id ?? null,
    amount: cap?.amount?.value ?? null,
    currency: cap?.amount?.currency_code ?? null,
    customId: cap?.custom_id ?? unit?.custom_id ?? null,
    payerEmail: data.payer?.email_address ?? null,
  };
}
