"use client";

import { useActionState } from "react";
import { unlockInvitation, type CodeState } from "./actions";

export function CodeForm({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState<CodeState, FormData>(unlockInvitation, {});
  return (
    <form action={action} className="mt-8 space-y-4 text-left">
      <input type="hidden" name="slug" value={slug} />
      <div>
        <label htmlFor="code" className="field-label">Code d&apos;accès</label>
        <input id="code" name="code" required autoComplete="off" autoCapitalize="none" className="field text-center tracking-[0.2em]" />
      </div>
      {state.error ? <p role="alert" className="field-error">{state.error}</p> : null}
      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending ? "Vérification…" : "Ouvrir l'invitation"}
      </button>
    </form>
  );
}
