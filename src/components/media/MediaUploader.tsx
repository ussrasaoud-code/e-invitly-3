"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { logUploadBatch, registerUpload, requestUpload } from "@/app/admin/medias/actions";
import { ACCEPT_ATTRIBUTE, MEDIA_TYPES, formatBytes, guessMime } from "@/lib/media";
import { browserClient } from "@/lib/supabase/browser";

type Row = { key: string; name: string; size: number; status: "waiting" | "uploading" | "done" | "error"; message?: string };

async function readDimensions(file: File, mime: string): Promise<{ width: number | null; height: number | null }> {
  const kind = MEDIA_TYPES[mime]?.kind;
  if (kind !== "image" && kind !== "svg" && kind !== "video") return { width: null, height: null };
  const url = URL.createObjectURL(file);
  try {
    if (kind === "video") {
      return await new Promise((resolve) => {
        const v = document.createElement("video");
        v.preload = "metadata";
        v.onloadedmetadata = () => resolve({ width: v.videoWidth || null, height: v.videoHeight || null });
        v.onerror = () => resolve({ width: null, height: null });
        v.src = url;
      });
    }
    return await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth || null, height: img.naturalHeight || null });
      img.onerror = () => resolve({ width: null, height: null });
      img.src = url;
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/** Import de plusieurs fichiers : glisser-déposer ou sélection. */
export function MediaUploader({ collections }: { collections: string[] }) {
  const [collection, setCollection] = useState(collections[0] ?? "Divers");
  const [newCollection, setNewCollection] = useState("");
  const [license, setLicense] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const target = collection === "__new" ? newCollection.trim() : collection;

  const update = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  async function handle(files: FileList | File[]) {
    const list = Array.from(files).slice(0, 50);
    if (!list.length) return;
    if (!target) {
      setRows([{ key: "x", name: "Indiquez le nom de la nouvelle collection.", size: 0, status: "error" }]);
      return;
    }
    setBusy(true);
    const batch = list.map((f, i) => ({ file: f, key: `${Date.now()}-${i}` }));
    setRows((rs) => [...batch.map(({ file, key }) => ({ key, name: file.name, size: file.size, status: "waiting" as const })), ...rs]);
    let ok = 0;
    for (const { file, key } of batch) {
      update(key, { status: "uploading" });
      try {
        const mime = guessMime(file.name, file.type);
        const ticket = await requestUpload({ name: file.name, type: mime, size: file.size, collection: target });
        if (!ticket.ok) {
          update(key, { status: "error", message: ticket.message });
          continue;
        }
        const dims = await readDimensions(file, mime);
        const { error } = await browserClient().storage.from("media").uploadToSignedUrl(ticket.path, ticket.token, new File([file], file.name, { type: ticket.mime }), { contentType: ticket.mime });
        if (error) {
          update(key, { status: "error", message: `Envoi interrompu : ${error.message}` });
          continue;
        }
        const res = await registerUpload({ path: ticket.path, name: file.name, collection: target, licenseNote: license, ...dims });
        if (res.ok) {
          ok++;
          update(key, { status: "done" });
        } else update(key, { status: "error", message: res.message });
      } catch {
        update(key, { status: "error", message: "Connexion perdue pendant l'envoi. Réessayez." });
      }
    }
    await logUploadBatch(ok, target).catch(() => {});
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  }

  return (
    <section className="card p-5">
      <h2 className="font-serif text-2xl">Importer des fichiers</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <label>
          <span className="field-label !text-xs">Collection</span>
          <select value={collection} onChange={(e) => setCollection(e.target.value)} aria-label="Collection de destination" className="field min-h-10 text-sm">
            {collections.map((c) => <option key={c} value={c}>{c}</option>)}
            <option value="__new">+ Nouvelle collection…</option>
          </select>
        </label>
        {collection === "__new" ? (
          <label>
            <span className="field-label !text-xs">Nom de la nouvelle collection</span>
            <input value={newCollection} onChange={(e) => setNewCollection(e.target.value)} maxLength={60} className="field min-h-10 text-sm" />
          </label>
        ) : null}
        <label className={collection === "__new" ? "" : "md:col-span-2"}>
          <span className="field-label !text-xs">Droits d&apos;utilisation (facultatif)</span>
          <input value={license} onChange={(e) => setLicense(e.target.value)} maxLength={300} placeholder="ex. Création personnelle · ou licence commerciale Creative Market" className="field min-h-10 text-sm" />
        </label>
      </div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (!busy) handle(e.dataTransfer.files);
        }}
        className={`mt-4 flex flex-col items-center justify-center rounded-sm border-2 border-dashed px-6 py-10 text-center transition-colors ${over ? "border-forest bg-sage-soft" : "border-sand bg-paper"}`}
      >
        <p className="text-sm">Glissez vos fichiers ici, ou</p>
        <button type="button" className="btn btn-primary btn-sm mt-3" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? "Envoi en cours…" : "Choisir des fichiers"}
        </button>
        <input ref={inputRef} type="file" multiple accept={ACCEPT_ATTRIBUTE} className="sr-only" aria-label="Choisir des fichiers à importer" onChange={(e) => e.target.files && handle(e.target.files)} />
        <p className="mt-3 text-xs text-stone">PNG, JPG, WebP, SVG (10 Mo, SVG 2 Mo) · MP4, WebM (15 Mo) · MP3, M4A, OGG (15 Mo) · 50 fichiers à la fois</p>
      </div>
      {rows.length ? (
        <ul className="mt-4 divide-y divide-line text-sm" aria-live="polite">
          {rows.slice(0, 60).map((r) => (
            <li key={r.key} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="min-w-0 truncate">{r.name} {r.size ? <span className="text-xs text-stone">· {formatBytes(r.size)}</span> : null}</span>
              <span className={`text-xs ${r.status === "error" ? "text-danger" : r.status === "done" ? "text-success" : "text-stone"}`}>
                {r.status === "waiting" ? "En attente" : r.status === "uploading" ? "Envoi…" : r.status === "done" ? "Ajouté ✓" : r.message}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
