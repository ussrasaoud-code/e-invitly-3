"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { SiteDict } from "@/lib/i18n/dict";

type PayPalButtons = { render: (el: HTMLElement) => Promise<void>; close?: () => void };
type PayPalSdk = {
  Buttons: (opts: {
    style?: Record<string, string | number>;
    createOrder: () => Promise<string>;
    onApprove: (data: { orderID: string }) => Promise<void>;
    onCancel?: () => void;
    onError?: (err: unknown) => void;
  }) => PayPalButtons;
};
declare global {
  interface Window {
    paypal?: PayPalSdk;
  }
}

const PAYPAL_LOCALES: Record<string, string> = { fr: "fr_FR", en: "en_GB", ar: "ar_EG", es: "es_ES", it: "it_IT", de: "de_DE", nl: "nl_NL" };

/**
 * Boutons de paiement : carte bancaire (Stripe Checkout, avec Apple Pay et
 * Google Pay) et PayPal. Le montant est toujours fixé par le serveur.
 */
export function PayButtons({
  token,
  lang,
  currency,
  t,
  paypalClientId,
  paypalMock,
  stripeEnabled,
}: {
  token: string;
  lang: string;
  currency: string;
  t: SiteDict["payment"];
  paypalClientId: string | null;
  paypalMock: boolean;
  stripeEnabled: boolean;
}) {
  const router = useRouter();
  const box = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"idle" | "processing" | "redirecting" | "error">("idle");
  const [message, setMessage] = useState("");

  const api = (path: string, body: unknown) =>
    fetch(`/api/paiement/${token}/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

  const createOrder = async () => {
    setMessage("");
    const res = await api("paypal", { action: "create" });
    const data = (await res.json()) as { id?: string };
    if (!res.ok || !data.id) throw new Error("create");
    return data.id;
  };
  const capture = async (orderID: string) => {
    setState("processing");
    const res = await api("paypal", { action: "capture", orderID });
    if (res.ok) router.refresh();
    else {
      setState("error");
      setMessage(t.failed);
    }
  };

  // Boutons PayPal officiels (script chargé depuis paypal.com)
  useEffect(() => {
    if (!paypalClientId || paypalMock || !box.current) return;
    let buttons: PayPalButtons | null = null;
    const render = () => {
      if (!window.paypal || !box.current) return;
      box.current.innerHTML = "";
      buttons = window.paypal.Buttons({
        style: { layout: "vertical", shape: "rect", color: "gold", label: "paypal", height: 46 },
        createOrder,
        onApprove: (d) => capture(d.orderID),
        onCancel: () => setMessage(t.cancelledByUser),
        onError: () => {
          setState("error");
          setMessage(t.failed);
        },
      });
      void buttons.render(box.current);
    };
    const src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(paypalClientId)}&currency=${currency}&intent=capture&components=buttons&locale=${PAYPAL_LOCALES[lang] ?? "fr_FR"}`;
    const existing = document.querySelector<HTMLScriptElement>(`script[data-paypal-sdk]`);
    if (existing && window.paypal) render();
    else {
      const s = existing ?? document.createElement("script");
      s.src = src;
      s.dataset.paypalSdk = "1";
      s.async = true;
      s.addEventListener("load", render);
      if (!existing) document.body.appendChild(s);
    }
    return () => buttons?.close?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paypalClientId, paypalMock, currency, lang]);

  const payByCard = async () => {
    setState("redirecting");
    setMessage("");
    const res = await api("stripe", { lang });
    const data = (await res.json().catch(() => ({}))) as { url?: string };
    if (res.ok && data.url) window.location.assign(data.url);
    else {
      setState("error");
      setMessage(t.failed);
    }
  };

  const busy = state === "processing" || state === "redirecting";
  return (
    <div className="space-y-5">
      {stripeEnabled ? (
        <div>
          <button type="button" onClick={payByCard} disabled={busy} className="btn btn-primary w-full !min-h-12 !text-[0.85rem]">
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2.5" y="5" width="19" height="14" rx="2" />
              <path d="M2.5 9.5h19M6 15h4" />
            </svg>
            {t.cardButton}
          </button>
          <p className="mt-2 text-center text-xs text-stone">{t.card}</p>
        </div>
      ) : null}

      {paypalClientId ? (
        <div>
          {stripeEnabled ? (
            <p className="mb-3 flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-stone">
              <span className="h-px flex-1 bg-line" />
              {t.paypal}
              <span className="h-px flex-1 bg-line" />
            </p>
          ) : null}
          {paypalMock ? (
            <button
              type="button"
              disabled={busy}
              className="w-full rounded-md bg-[#ffc439] px-4 py-3 font-medium text-[#111]"
              onClick={async () => {
                try {
                  await capture(await createOrder());
                } catch {
                  setState("error");
                  setMessage(t.failed);
                }
              }}
            >
              {t.testPaypal}
            </button>
          ) : (
            <div ref={box} className="min-h-12" />
          )}
          <p className="mt-2 text-center text-xs text-stone">{t.paypalHint}</p>
        </div>
      ) : null}

      <p role="status" aria-live="polite" className={`text-center text-sm ${state === "error" ? "text-danger" : "text-stone"}`}>
        {state === "processing" ? t.processing : state === "redirecting" ? t.redirecting : message}
      </p>
    </div>
  );
}
