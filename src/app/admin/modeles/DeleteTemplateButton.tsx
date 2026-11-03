"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { deleteTemplate } from "./actions";

/** Suppression en deux temps (pas de boîte de dialogue du navigateur). */
export function DeleteTemplateButton({ id, name, usage }: { id: string; name: string; usage: number }) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <button type="button" className="btn btn-ghost btn-sm text-danger" onClick={() => setAsking(true)}>
        Supprimer
      </button>
    );
  }
  return (
    <form action={deleteTemplate} className="mt-2 w-full rounded-sm border border-danger/40 bg-danger-soft p-3 text-sm" role="alertdialog" aria-label={`Supprimer ${name}`}>
      <input type="hidden" name="id" value={id} />
      <p className="font-medium text-danger">Supprimer « {name} » définitivement ?</p>
      <p className="mt-1 text-xs text-stone">
        Toutes ses versions et son brouillon seront effacés. Impossible d&apos;annuler.
        {usage ? ` Les ${usage} invitation(s) créée(s) avec ce modèle ne changent pas : elles gardent leur contenu et restent en ligne.` : ""}
      </p>
      <div className="mt-2 flex gap-2">
        <SubmitButton className="btn btn-sm bg-danger text-white hover:brightness-95" pendingLabel="Suppression…">Oui, supprimer</SubmitButton>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAsking(false)}>Annuler</button>
      </div>
    </form>
  );
}
