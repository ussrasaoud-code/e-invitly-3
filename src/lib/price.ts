/**
 * Prix d'un modèle. Stocké sous forme de libellé (`price_label`) pour rester
 * libre, mais saisi dans l'administration avec un montant et un format.
 */
export type PriceMode = "from" | "fixed" | "text" | "none";
export type Price = { mode: PriceMode; amount: string; text: string };

const RE = /^(À partir de |A partir de )?(\d+(?:[.,]\d{1,2})?)\s?€$/i;

export function parsePrice(label: string | null | undefined): Price {
  const l = (label ?? "").trim();
  if (!l) return { mode: "none", amount: "", text: "" };
  const m = l.match(RE);
  if (m) return { mode: m[1] ? "from" : "fixed", amount: m[2].replace(".", ","), text: "" };
  return { mode: "text", amount: "", text: l };
}

/** Libellé affiché sur le site (null = rien d'affiché). */
export function formatPrice(mode: string, amount: string, text: string): string | null {
  const a = amount.trim().replace(".", ",").replace(/\s|€/g, "");
  if ((mode === "from" || mode === "fixed") && /^\d+(,\d{1,2})?$/.test(a)) {
    return mode === "from" ? `À partir de ${a} €` : `${a} €`;
  }
  if (mode === "text") return text.trim().slice(0, 80) || null;
  return null;
}
