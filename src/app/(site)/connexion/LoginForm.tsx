"use client";

import { useActionState } from "react";
import { sendMagicLink, type LoginState } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(sendMagicLink, { status: "idle" });
  if (state.status === "sent") {
    return (
      <p role="status" className="card p-6 text-center leading-relaxed">
        {state.message}
      </p>
    );
  }
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="suite" value={next} />
      <div>
        <label htmlFor="email" className="field-label">Adresse e-mail</label>
        <input id="email" name="email" type="email" required autoComplete="email" inputMode="email" className="field" />
      </div>
      {state.status === "error" ? <p role="alert" className="field-error">{state.message}</p> : null}
      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending ? "Envoi…" : "Recevoir mon lien de connexion"}
      </button>
    </form>
  );
}
