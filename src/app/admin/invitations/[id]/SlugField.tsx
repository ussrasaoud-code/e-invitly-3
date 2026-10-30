"use client";

import { useEffect, useState } from "react";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { checkSlug } from "../actions";

/** Champ d'adresse avec vérification de disponibilité en direct. */
export function SlugField({ invitationId, initial, host, published }: { invitationId: string; initial: string; host: string; published?: boolean }) {
  const [value, setValue] = useState(initial);
  const [check, setCheck] = useState<{ ok: boolean; message: string; slug: string } | null>(null);

  useEffect(() => {
    if (value === initial) {
      setCheck(null);
      return;
    }
    const t = window.setTimeout(async () => setCheck(await checkSlug(invitationId, value)), 400);
    return () => window.clearTimeout(t);
  }, [value, initial, invitationId]);

  const changed = value !== initial;
  return (
    <div>
      <label htmlFor="slug" className="field-label">Adresse</label>
      <div className="flex items-stretch">
        <span className="flex items-center border border-r-0 border-sand bg-paper px-3 text-sm text-stone">{host}/</span>
        <input
          id="slug"
          name="slug"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="field min-h-10 text-sm"
          aria-describedby="slug-status"
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      <p id="slug-status" role="status" className={`mt-1.5 text-xs ${check ? (check.ok ? "text-success" : "text-danger") : "text-stone"}`}>
        {check
          ? `${check.message}${check.slug !== value ? ` (sera enregistrée sous la forme « ${check.slug} »)` : ""}`
          : "Lettres minuscules, chiffres et tirets."}
      </p>
      {published && changed ? (
        <div className="mt-3 rounded-sm border border-line bg-paper p-3 text-sm">
          <p className="text-warning">Cette invitation est déjà en ligne : le lien envoyé aux invités va changer.</p>
          <label className="mt-2 flex items-start gap-2">
            <input type="checkbox" name="redirect" defaultChecked className="mt-0.5 h-4 w-4 accent-forest" />
            <span>Rediriger l&apos;ancien lien vers la nouvelle adresse (recommandé). Décochez seulement si l&apos;ancien lien ne doit plus rien afficher, par exemple pour des raisons de confidentialité.</span>
          </label>
        </div>
      ) : null}
      <SubmitButton className="btn btn-secondary btn-sm mt-3" pendingLabel="Enregistrement…">
        Enregistrer l&apos;adresse
      </SubmitButton>
    </div>
  );
}
