"use client";

import { useState, useTransition } from "react";
import { CopyButton } from "@/components/admin/CopyButton";
import { createPreviewLink, sendPreviewEmail } from "../actions";

/** Génère un lien d'aperçu privé (7 jours) à envoyer au couple pour validation. */
export function PreviewLink({ invitationId }: { invitationId: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ url: string; expiresAt: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [sending, startSend] = useTransition();
  const [sent, setSent] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
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
            if (res.ok) { setResult({ url: res.url, expiresAt: res.expiresAt }); setSent(null); setSendError(null); }
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
          <div className="mt-4 border-t border-sage pt-3">
            <label htmlFor="preview-note" className="block text-xs font-medium text-forest-deep">
              Message personnel (facultatif)
            </label>
            <textarea
              id="preview-note"
              rows={3}
              maxLength={1500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="field mt-1 text-sm"
              placeholder="Ex. : J'ai ajouté vos photos et le programme. Dites-moi si la couleur vous plaît !"
            />
            <p className="mt-1 text-xs text-stone">
              L&apos;e-mail part dans la langue de l&apos;invitation avec un bouton « Découvrir mon invitation ». Le couple n&apos;a qu&apos;à répondre pour demander des modifications : la réponse arrive sur votre e-mail de contact.
            </p>
            <button
              type="button"
              className="btn btn-primary btn-sm mt-2"
              disabled={sending}
              onClick={() =>
                startSend(async () => {
                  setSendError(null);
                  setSent(null);
                  const res = await sendPreviewEmail(invitationId, result.url, result.expiresAt, note);
                  if (res.ok) setSent(res.to.join(", "));
                  else setSendError(res.message);
                })
              }
            >
              {sending ? "Envoi…" : sent ? "Renvoyer l'e-mail" : "Envoyer l'aperçu au couple par e-mail"}
            </button>
            {sent ? <p role="status" className="mt-2 text-xs font-medium text-forest-deep">✓ E-mail envoyé à {sent}.</p> : null}
            {sendError ? <p role="alert" className="field-error">{sendError}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
