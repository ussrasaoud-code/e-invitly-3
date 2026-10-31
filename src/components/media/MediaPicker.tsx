"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { listMediaForPicker } from "@/app/admin/medias/actions";
import { KIND_LABELS, formatBytes, type MediaItem, type MediaKind } from "@/lib/media";
import { MediaThumb } from "./MediaThumb";

/** Fenêtre de choix d'un fichier dans la bibliothèque de médias. */
export function MediaPicker({ kinds, open, onClose, onSelect, title = "Choisir dans la bibliothèque" }: {
  kinds: MediaKind[];
  open: boolean;
  onClose: () => void;
  onSelect: (item: MediaItem) => void;
  title?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [collection, setCollection] = useState("");
  const [q, setQ] = useState("");
  const kindsKey = kinds.join(",");

  async function load() {
    setFailed(false);
    try {
      setItems(await listMediaForPicker(kindsKey.split(",") as MediaKind[]));
    } catch {
      setFailed(true);
      setItems([]);
    }
  }

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      void load();
    } else if (!open && d.open) d.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const collections = useMemo(() => [...new Set((items ?? []).map((i) => i.collection))].sort((a, b) => a.localeCompare(b, "fr")), [items]);
  const shown = (items ?? []).filter(
    (i) => (!collection || i.collection === collection) && (!q.trim() || `${i.name} ${i.tags.join(" ")}`.toLowerCase().includes(q.trim().toLowerCase())),
  );

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-label={title}
      className="m-auto w-[min(960px,94vw)] max-h-[88vh] rounded-sm bg-ivory p-0 text-charcoal shadow-2xl backdrop:bg-charcoal/50"
    >
      <div className="flex max-h-[88vh] flex-col">
        <header className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
          <h2 className="font-serif text-2xl">{title}</h2>
          <span className="text-xs text-stone">{kinds.map((k) => KIND_LABELS[k]).join(" · ")}</span>
          <button type="button" onClick={onClose} className="ml-auto rounded-sm px-2 py-1 text-xl leading-none hover:bg-sage-soft" aria-label="Fermer">×</button>
        </header>
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3">
          <select value={collection} onChange={(e) => setCollection(e.target.value)} className="field min-h-9 w-auto py-1 text-sm" aria-label="Collection">
            <option value="">Toutes les collections</option>
            {collections.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher…" aria-label="Rechercher un fichier" className="field min-h-9 w-48 py-1 text-sm" />
          <button type="button" onClick={() => void load()} className="btn btn-secondary btn-sm">Actualiser</button>
          <a href="/admin/medias" target="_blank" rel="noopener" className="btn btn-secondary btn-sm ml-auto">Importer de nouveaux fichiers ↗</a>
        </div>
        <div className="min-h-60 overflow-y-auto p-5">
          {items === null ? (
            <p className="text-sm text-stone">Chargement…</p>
          ) : failed ? (
            <p role="alert" className="text-sm text-danger">Impossible de charger la bibliothèque. Réessayez avec « Actualiser ».</p>
          ) : !shown.length ? (
            <p className="text-sm text-stone">
              {items.length ? "Aucun fichier ne correspond." : "Aucun fichier de ce type dans la bibliothèque. Importez-en depuis la page Médias, puis cliquez sur « Actualiser »."}
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
              {shown.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(m);
                      onClose();
                    }}
                    className="group block w-full overflow-hidden rounded-sm border border-line bg-white text-left transition hover:border-forest focus-visible:border-forest"
                  >
                    <div className="checker aspect-square"><MediaThumb item={m} /></div>
                    <div className="border-t border-line px-2 py-1.5">
                      <p className="truncate text-xs group-hover:text-forest">{m.name}</p>
                      <p className="truncate text-[0.65rem] text-stone">{m.collection} · {formatBytes(m.size_bytes)}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </dialog>
  );
}
