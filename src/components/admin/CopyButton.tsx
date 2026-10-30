"use client";

import { useState } from "react";

/** Copie un texte (lien) dans le presse-papiers, avec confirmation visible. */
export function CopyButton({ text, label = "Copier le lien", className = "btn btn-secondary btn-sm" }: { text: string; label?: string; className?: string }) {
  const [state, setState] = useState<"idle" | "ok" | "error">("idle");
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setState("ok");
        } catch {
          setState("error");
        }
        window.setTimeout(() => setState("idle"), 2500);
      }}
    >
      <span aria-live="polite">{state === "ok" ? "Lien copié ✓" : state === "error" ? "Copie impossible" : label}</span>
    </button>
  );
}
