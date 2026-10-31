"use client";

import { useEffect, useState } from "react";
import type { InvitationContent } from "@/lib/invitation/schema";

export type HistorySnapshot = { id: string; kind: "auto" | "manual" | "restore"; label: string | null; created_at: string; author: string | null };

export type HistoryApi = {
  list: () => Promise<HistorySnapshot[]>;
  checkpoint: (label: string) => Promise<{ ok: boolean; message?: string }>;
  restore: (snapshotId: string) => Promise<{ ok: true; content: InvitationContent; savedAt: string } | { ok: false; message: string }>;
};

const KIND_LABEL: Record<HistorySnapshot["kind"], string> = {
  auto: "Avant une séance de modifications",
  manual: "Point de sauvegarde",
  restore: "Avant une restauration",
};

/** Historique du brouillon : points automatiques et manuels, restauration. */
export function HistoryDrawer({ api, onClose, onRestored, dirty }: {
  api: HistoryApi;
  onClose: () => void;
  onRestored: (content: InvitationContent, savedAt: string) => void;
  dirty: boolean;
}) {
  const [items, setItems] = useState<HistorySnapshot[] | null>(null);
  const [error, setError] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      setItems(await api.list());
    } catch {
      setError("Impossible de charger l'historique.");
      setItems([]);
    }
  };
  useEffect(() => {
    void load();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-charcoal/40" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <section role="dialog" aria-modal="true" aria-label="Historique du brouillon" className="flex h-full w-[min(420px,100vw)] flex-col bg-ivory shadow-2xl">
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-serif text-2xl">Historique du brouillon</h2>
          <button type="button" onClick={onClose} aria-label="Fermer" className="px-2 text-xl text-stone hover:text-charcoal">×</button>
        </header>
        <form
          className="space-y-2 border-b border-line px-5 py-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            const res = await api.checkpoint(label).catch(() => ({ ok: false, message: "Connexion perdue." }));
            setBusy(false);
            if (!res.ok) setError(res.message ?? "Enregistrement impossible.");
            else {
              setLabel("");
              await load();
            }
          }}
        >
          <label className="block text-sm" htmlFor="checkpoint-label">Créer un point de sauvegarde du brouillon actuel</label>
          <div className="flex gap-2">
            <input id="checkpoint-label" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={120} placeholder="ex. Version validée par la cliente" className="field min-h-9 flex-1 py-1 text-sm" />
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy || dirty} title={dirty ? "Attendez la fin de l'enregistrement" : undefined}>Créer</button>
          </div>
          {dirty ? <p className="text-xs text-stone">Enregistrement en cours : patientez une seconde.</p> : null}
          {error ? <p role="alert" className="text-xs text-danger">{error}</p> : null}
        </form>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <p className="mb-3 text-xs text-stone">Un point est créé automatiquement au début de chaque séance de modifications. Les 60 derniers sont conservés.</p>
          {items === null ? (
            <p className="text-sm text-stone">Chargement…</p>
          ) : !items.length ? (
            <p className="text-sm text-stone">Aucun point pour l&apos;instant.</p>
          ) : (
            <ol className="space-y-2">
              {items.map((h) => (
                <li key={h.id} className="card flex items-start justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="text-sm">{h.label || KIND_LABEL[h.kind]}</p>
                    <p className="text-xs text-stone">
                      {new Date(h.created_at).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}
                      {h.author ? ` · ${h.author}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm shrink-0"
                    disabled={busy || dirty}
                    onClick={async () => {
                      if (!window.confirm("Remettre le brouillon dans cet état ? L'état actuel sera conservé dans l'historique.")) return;
                      setBusy(true);
                      setError("");
                      const res = await api.restore(h.id).catch(() => ({ ok: false as const, message: "Connexion perdue." }));
                      setBusy(false);
                      if (!res.ok) setError(res.message);
                      else {
                        onRestored(res.content, res.savedAt);
                        onClose();
                      }
                    }}
                  >
                    Restaurer
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>
    </div>
  );
}
