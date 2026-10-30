"use client";

import { useState, useTransition } from "react";
import { CopyButton } from "@/components/admin/CopyButton";
import { createPreviewLink } from "../actions";

/** Génère un lien d'aperçu privé (7 jours) à envoyer au couple pour validation. */
export function PreviewLink({ invitationId }: { invitationId: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ url: string; expiresAt: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await createPreviewLink(invitationId);
            if (res.ok) setResult({ url: res.url, expiresAt: res.expiresAt });
            else setError(res.message);
          })
        }
      >
        {pending ? "Création…" : result ? "Créer un autre lien" : "Créer un lien d'aperçu"}
      </button>
      {error ? <p role="alert" className="field-error">{error}</p> : null}
      {result ? (
        <div className="mt-3 rounded-sm border border-sage bg-sage-soft p-3 text-sm">
          <p className="break-all font-medium text-forest-deep">{result.url}</p>
          <p className="mt-1 text-xs text-stone">
            Valable jusqu&apos;au {new Date(result.expiresAt).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" })}. Montre le brouillon actuel, même après de nouvelles modifications.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <CopyButton text={result.url} />
            <a href={result.url} target="_blank" rel="noopener" className="btn btn-ghost btn-sm">Ouvrir ↗</a>
          </div>
        </div>
      ) : null}
    </div>
  );
}
