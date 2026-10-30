"use client";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="card mx-auto mt-10 max-w-xl p-6">
      <h1 className="font-serif text-2xl">L&apos;opération n&apos;a pas abouti</h1>
      <p className="mt-3 text-sm text-stone">
        {error.message && !error.message.includes("digest") ? error.message : "Une erreur inattendue est survenue."}
      </p>
      {error.digest ? <p className="mt-2 text-xs text-stone">Code : {error.digest}</p> : null}
      <button type="button" onClick={reset} className="btn btn-secondary btn-sm mt-5">
        Réessayer
      </button>
    </div>
  );
}
