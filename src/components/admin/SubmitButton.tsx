"use client";

import { useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

/** Bouton d'envoi qui se désactive pendant le traitement (évite les doubles clics). */
export function SubmitButton({
  children,
  pendingLabel,
  className = "btn btn-primary",
  confirm,
  name,
  value,
}: {
  children: ReactNode;
  pendingLabel?: string;
  className?: string;
  confirm?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  // Certains navigateurs bloquent les fenêtres de confirmation (« Empêcher cette page
  // d'ouvrir d'autres boîtes de dialogue ») : le bouton ne faisait alors rien.
  // Dans ce cas, la confirmation s'affiche directement à côté du bouton.
  const [asking, setAsking] = useState(false);
  if (asking && confirm) {
    return (
      <span role="alertdialog" aria-label={confirm} className="inline-flex flex-wrap items-center gap-2 rounded-sm border border-line bg-paper px-3 py-2 text-sm">
        <span>{confirm}</span>
        <button type="submit" name={name} value={value} className="btn btn-primary btn-sm" disabled={pending}>
          {pending ? pendingLabel ?? "…" : "Confirmer"}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAsking(false)}>
          Annuler
        </button>
      </span>
    );
  }
  return (
    <button
      type="submit"
      name={name}
      value={value}
      className={className}
      disabled={pending}
      aria-busy={pending}
      onClick={(e) => {
        if (!confirm) return;
        const t0 = performance.now();
        if (window.confirm(confirm)) return;
        e.preventDefault();
        // Réponse instantanée = fenêtre bloquée par le navigateur (personne n'a pu cliquer)
        if (performance.now() - t0 < 40) setAsking(true);
      }}
    >
      {pending ? pendingLabel ?? "…" : children}
    </button>
  );
}
