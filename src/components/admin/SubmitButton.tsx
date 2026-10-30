"use client";

import type { ReactNode } from "react";
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
  return (
    <button
      type="submit"
      name={name}
      value={value}
      className={className}
      disabled={pending}
      aria-busy={pending}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {pending ? pendingLabel ?? "…" : children}
    </button>
  );
}
