"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { createCollection, deleteCollection, moveMedia } from "@/app/admin/medias/actions";
import { formatBytes, type MediaItem } from "@/lib/media";
import { MediaThumb } from "./MediaThumb";

export type BoardCollection = { name: string; count: number; href: string; active: boolean; custom: boolean };

const DRAG_TYPE = "application/x-einvitly-media";

/**
 * Collections (à gauche) + fichiers (à droite).
 * Glisser un visuel sur une collection pour le ranger ; cocher plusieurs visuels pour les déplacer ensemble.
 */
export function MediaBoard({
  collections: initial,
  all,
  items: initialItems,
  activeCollection,
  toolbar,
  empty,
}: {
  collections: BoardCollection[];
  all: { count: number; href: string; active: boolean };
  items: MediaItem[];
  activeCollection: string;
  toolbar: ReactNode;
  empty: ReactNode;
}) {
  const router = useRouter();
  const [collections, setCollections] = useState(initial);
  const [items, setItems] = useState(initialItems);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [overName, setOverName] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [pending, start] = useTransition();
  const names = collections.map((c) => c.name);

  function move(ids: string[], target: string) {
    const moving = items.filter((m) => ids.includes(m.id) && m.collection !== target);
    if (!moving.length) return;
    // Mise à jour immédiate de l'affichage, puis enregistrement
    setCollections((cs) =>
      cs.map((c) => ({ ...c, count: c.count + (c.name === target ? moving.length : 0) - moving.filter((m) => m.collection === c.name).length })),
    );
    setItems((list) =>
      list.flatMap((m) => (ids.includes(m.id) ? (activeCollection && activeCollection !== target ? [] : [{ ...m, collection: target }]) : [m])),
    );
    setSelected(new Set());
    start(async () => {
      const res = await moveMedia(moving.map((m) => m.id), target);
      setMessage(res.ok ? { kind: "ok", text: `${moving.length} fichier(s) rangé(s) dans « ${target} ».` } : { kind: "error", text: res.message ?? "Erreur" });
      router.refresh();
    });
  }

  function addCollection() {
    const name = newName.trim();
    if (!name) return;
    start(async () => {
      const res = await createCollection(name);
      if (!res.ok) return setMessage({ kind: "error", text: res.message });
      if (!names.includes(res.name)) {
        setCollections((cs) => [...cs, { name: res.name, count: 0, href: `/admin/medias?collection=${encodeURIComponent(res.name)}`, active: false, custom: true }]);
      }
      setMessage({ kind: "ok", text: `Collection « ${res.name} » créée. Glissez-y vos visuels.` });
      setNewName("");
      setAdding(false);
      router.refresh();
    });
  }

  function removeCollection(name: string) {
    start(async () => {
      const res = await deleteCollection(name);
      if (!res.ok) return setMessage({ kind: "error", text: res.message ?? "Erreur" });
      setCollections((cs) => cs.filter((c) => c.name !== name));
      router.refresh();
    });
  }

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const dropProps = (name: string) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setOverName(name);
    },
    onDragLeave: () => setOverName((n) => (n === name ? null : n)),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setOverName(null);
      const ids = (e.dataTransfer.getData(DRAG_TYPE) || "").split(",").filter(Boolean);
      if (ids.length) move(ids, name);
    },
  });

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[230px_minmax(0,1fr)]">
      <nav aria-label="Collections" className="lg:sticky lg:top-6 lg:self-start">
        <p className="mb-2 text-xs uppercase tracking-wider text-stone">Collections</p>
        <ul className="flex flex-wrap gap-1 lg:flex-col">
          <li>
            <Link href={all.href} className={`flex justify-between gap-3 rounded-sm px-3 py-1.5 text-sm ${all.active ? "bg-forest text-ivory" : "hover:bg-sage-soft"}`}>
              Toutes <span className="opacity-70">{all.count}</span>
            </Link>
          </li>
          {collections.map((c) => (
            <li key={c.name} {...dropProps(c.name)} className="group relative">
              <Link
                href={c.href}
                className={`flex justify-between gap-3 rounded-sm px-3 py-1.5 text-sm transition ${
                  overName === c.name ? "bg-sage-soft ring-2 ring-forest" : c.active ? "bg-forest text-ivory" : "hover:bg-sage-soft"
                }`}
              >
                <span className="truncate">{c.name}</span> <span className="opacity-70">{c.count}</span>
              </Link>
              {c.custom && c.count === 0 ? (
                <button
                  type="button"
                  onClick={() => removeCollection(c.name)}
                  aria-label={`Supprimer la collection vide ${c.name}`}
                  title="Supprimer cette collection vide"
                  className="absolute end-9 top-1/2 hidden -translate-y-1/2 rounded px-1 text-xs text-stone hover:text-danger group-hover:block"
                >
                  ✕
                </button>
              ) : null}
            </li>
          ))}
        </ul>
        {adding ? (
          <form
            className="mt-3 space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              addCollection();
            }}
          >
            <label htmlFor="new-collection" className="sr-only">Nom de la nouvelle collection</label>
            <input id="new-collection" autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={60} placeholder="ex. Cadres" className="field min-h-9 py-1 text-sm" />
            <div className="flex gap-2">
              <button type="submit" className="btn btn-primary btn-sm" disabled={pending || !newName.trim()}>Enregistrer</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAdding(false)}>Annuler</button>
            </div>
          </form>
        ) : (
          <button type="button" className="mt-3 text-sm text-forest underline-offset-4 hover:underline" onClick={() => setAdding(true)}>
            + Nouvelle collection
          </button>
        )}
        <p className="mt-4 hidden text-xs leading-relaxed text-stone lg:block">Astuce : glissez un visuel sur une collection pour le ranger. Cochez-en plusieurs pour les déplacer ensemble.</p>
      </nav>

      <section aria-label="Fichiers">
        {toolbar}
        {message ? (
          <p role="status" className={`mb-3 rounded-sm px-4 py-2 text-sm ${message.kind === "ok" ? "bg-sage-soft" : "bg-danger-soft text-danger"}`}>{message.text}</p>
        ) : null}
        {selected.size ? (
          <div className="mb-3 flex flex-wrap items-center gap-3 rounded-sm border border-forest bg-white px-4 py-2 text-sm">
            <span>{selected.size} sélectionné(s)</span>
            <label className="flex items-center gap-2">
              Ranger dans
              <select aria-label="Ranger la sélection dans" className="field min-h-9 w-auto py-1 text-sm" value="" onChange={(e) => e.target.value && move([...selected], e.target.value)}>
                <option value="">Choisir…</option>
                {names.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <button type="button" className="text-stone underline" onClick={() => setSelected(new Set())}>Tout désélectionner</button>
          </div>
        ) : null}
        {!items.length ? (
          empty
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {items.map((m) => {
              const isSel = selected.has(m.id);
              return (
                <li
                  key={m.id}
                  draggable
                  onDragStart={(e) => {
                    const ids = isSel ? [...selected] : [m.id];
                    e.dataTransfer.setData(DRAG_TYPE, ids.join(","));
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  className={`group relative overflow-hidden rounded-sm border bg-white transition ${isSel ? "border-forest ring-2 ring-forest/40" : "border-line hover:border-forest"}`}
                >
                  <label className="absolute start-2 top-2 z-10 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-white/90 shadow-sm">
                    <input type="checkbox" className="h-4 w-4 accent-forest" checked={isSel} onChange={() => toggle(m.id)} aria-label={`Sélectionner ${m.name}`} />
                  </label>
                  <Link href={`/admin/medias/${m.id}`} draggable={false} className="block" title="Ouvrir la fiche" aria-label={`Ouvrir ${m.name}`}>
                    <div className="checker aspect-square cursor-grab active:cursor-grabbing">
                      <MediaThumb item={m} />
                    </div>
                  </Link>
                  <div className="space-y-1.5 border-t border-line px-2.5 py-2">
                    <p className="truncate text-xs font-medium">{m.name}</p>
                    <p className="truncate text-[0.68rem] text-stone">
                      {m.width && m.height ? `${m.width}×${m.height} · ` : ""}
                      {formatBytes(m.size_bytes)}
                    </p>
                    <select
                      aria-label={`Collection de ${m.name}`}
                      value={m.collection}
                      onChange={(e) => move([m.id], e.target.value)}
                      className="w-full rounded-sm border border-line bg-paper px-1.5 py-1 text-xs"
                    >
                      {names.includes(m.collection) ? null : <option value={m.collection}>{m.collection}</option>}
                      {names.map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
