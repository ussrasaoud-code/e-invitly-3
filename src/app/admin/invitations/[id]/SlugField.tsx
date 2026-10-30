"use client";

import { useEffect, useState } from "react";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { checkSlug } from "../actions";

/** Champ d'adresse avec vérification de disponibilité en direct. */
export function SlugField({ invitationId, initial, host, disabled }: { invitationId: string; initial: string; host: string; disabled?: boolean }) {
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
          disabled={disabled}
          className="field min-h-10 text-sm"
          aria-describedby="slug-status"
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      <p id="slug-status" role="status" className={`mt-1.5 text-xs ${check ? (check.ok ? "text-success" : "text-danger") : "text-stone"}`}>
        {disabled
          ? "Adresse figée depuis la publication."
          : check
            ? `${check.message}${check.slug !== value ? ` (sera enregistrée sous la forme « ${check.slug} »)` : ""}`
            : "Lettres minuscules, chiffres et tirets."}
      </p>
      {!disabled ? (
        <SubmitButton className="btn btn-secondary btn-sm mt-3" pendingLabel="Enregistrement…">
          Enregistrer l&apos;adresse
        </SubmitButton>
      ) : null}
    </div>
  );
}
