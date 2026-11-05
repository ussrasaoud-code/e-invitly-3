"use client";

import { useEffect } from "react";
import { trackConversion } from "./CookieConsent";

/** Paiement réussi : une seule conversion par paiement et par appareil (seulement si le visiteur a accepté la mesure). */
export function PurchaseTracker({ id, value, currency, item }: { id: string; value: number; currency: string; item: string }) {
  useEffect(() => {
    const key = `ei-purchase-${id}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch {
      /* stockage indisponible : on envoie quand même */
    }
    trackConversion({ name: "purchase", params: { id, value, currency, item } });
  }, [id, value, currency, item]);
  return null;
}
