"use client";

import { useState } from "react";
import { formatPrice, parsePrice, type PriceMode } from "@/lib/price";

/** Saisie du prix d'un modèle : montant + format, avec aperçu du libellé affiché. */
export function PriceField({ defaultLabel }: { defaultLabel: string | null }) {
  const init = parsePrice(defaultLabel);
  const [mode, setMode] = useState<PriceMode>(init.mode === "none" ? "from" : init.mode);
  const [amount, setAmount] = useState(init.amount);
  const [text, setText] = useState(init.text);
  const preview = formatPrice(mode, amount, text);
  return (
    <fieldset className="md:col-span-2">
      <legend className="field-label">Prix affiché sur le site</legend>
      <div className="flex flex-wrap items-center gap-3">
        <select name="price_mode" value={mode} onChange={(e) => setMode(e.target.value as PriceMode)} className="field w-auto" aria-label="Format du prix">
          <option value="from">À partir de…</option>
          <option value="fixed">Prix fixe</option>
          <option value="text">Texte libre</option>
          <option value="none">Ne pas afficher de prix</option>
        </select>
        {mode === "from" || mode === "fixed" ? (
          <span className="flex items-center gap-2">
            <input name="price_amount" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className="field w-32" placeholder="175" aria-label="Montant en euros" />
            <span>€</span>
          </span>
        ) : null}
        {mode === "text" ? (
          <input name="price_text" value={text} onChange={(e) => setText(e.target.value)} maxLength={80} className="field min-w-64 flex-1" placeholder="ex. Inclus avec l'offre Premium" aria-label="Texte du prix" />
        ) : null}
      </div>
      <p className="mt-2 text-xs text-stone">
        Sur le site : {preview ? <strong className="text-charcoal">{preview}</strong> : <em>aucun prix affiché</em>}
      </p>
    </fieldset>
  );
}
