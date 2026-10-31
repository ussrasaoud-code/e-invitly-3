"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import type { MediaKind } from "@/lib/media";
import { MediaPicker } from "./MediaPicker";

/**
 * Champ d'adresse de fichier avec bouton « Bibliothèque ».
 * Contrôlé (value + onChange) ou autonome dans un formulaire (name + defaultValue).
 */
export function MediaUrlField({
  kinds,
  value,
  onChange,
  name,
  defaultValue = "",
  placeholder = "https://…",
  className = "field",
  label,
}: {
  kinds: MediaKind[];
  value?: string;
  onChange?: (v: string) => void;
  name?: string;
  defaultValue?: string;
  placeholder?: string;
  className?: string;
  label?: string;
}) {
  const [own, setOwn] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const current = value ?? own;
  const set = (v: string) => (onChange ? onChange(v) : setOwn(v));
  const isImage = kinds.some((k) => k === "image" || k === "svg");

  return (
    <span className="block">
      <span className="flex gap-2">
        {isImage && current ? <img src={current} alt="" className="checker h-10 w-10 shrink-0 rounded-sm border border-line object-contain" /> : null}
        <input name={name} value={current} onChange={(e) => set(e.target.value)} placeholder={placeholder} aria-label={label} className={`${className} min-w-0 flex-1`} />
        <button type="button" onClick={() => setOpen(true)} className="btn btn-secondary btn-sm shrink-0">Bibliothèque</button>
        {current ? (
          <button type="button" onClick={() => set("")} className="shrink-0 px-1 text-lg leading-none text-stone hover:text-danger" aria-label="Retirer le fichier">×</button>
        ) : null}
      </span>
      <MediaPicker kinds={kinds} open={open} onClose={() => setOpen(false)} onSelect={(m) => set(m.url)} />
    </span>
  );
}

/** Liste d'adresses (une par ligne) avec ajout depuis la bibliothèque. */
export function MediaListField({ name, defaultValue, kinds = ["image", "svg"], rows = 3 }: { name: string; defaultValue: string; kinds?: MediaKind[]; rows?: number }) {
  const [text, setText] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  return (
    <span className="block">
      <textarea name={name} value={text} onChange={(e) => setText(e.target.value)} rows={rows} className="field text-sm" />
      <button type="button" onClick={() => setOpen(true)} className="btn btn-secondary btn-sm mt-2">Ajouter depuis la bibliothèque</button>
      <MediaPicker kinds={kinds} open={open} onClose={() => setOpen(false)} onSelect={(m) => setText((t) => (t.trim() ? `${t.trim()}\n${m.url}` : m.url))} />
    </span>
  );
}
