"use client";

import { useState } from "react";
import { removePhoto, requestPhotoUpload } from "@/app/mon-espace/details-actions";
import type { SiteDict } from "@/lib/i18n/dict";
import { browserClient } from "@/lib/supabase/browser";

type F = SiteDict["request"]["f"];

/** Couleurs proposées pour le dress code (les mariés peuvent aussi ajouter les leurs). */
const SUGGESTED = [
  "#F8F4EC", "#E8D9B5", "#C9A45C", "#EBC7C1", "#C98B8B", "#C0664A", "#7A2E3A",
  "#A6B5A2", "#6B7445", "#2F5D50", "#9DB4C8", "#233A5E", "#B9A9CF", "#8C6A8F",
  "#A8968A", "#5A3E33", "#3A3A3A", "#FFFFFF", "#111111",
];

export function ColorPalette({ value, onChange, f }: { value: string[]; onChange: (next: string[]) => void; f: F }) {
  const [custom, setCustom] = useState("#C9A45C");
  const has = (c: string) => value.some((v) => v.toLowerCase() === c.toLowerCase());
  const toggle = (c: string) => (has(c) ? onChange(value.filter((v) => v.toLowerCase() !== c.toLowerCase())) : value.length < 8 && onChange([...value, c.toUpperCase()]));
  return (
    <fieldset className="sm:col-span-2">
      <legend className="field-label">{f.dressColors}</legend>
      <p className="field-hint !mt-0 mb-3">{f.dressColorsHint}</p>
      <ul className="flex flex-wrap gap-2">
        {SUGGESTED.map((c) => (
          <li key={c}>
            <button
              type="button"
              aria-pressed={has(c)}
              aria-label={c}
              title={c}
              onClick={() => toggle(c)}
              className={`h-9 w-9 rounded-full border transition ${has(c) ? "border-forest ring-2 ring-forest ring-offset-2" : "border-line"}`}
              style={{ backgroundColor: c }}
            />
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input type="color" aria-label={f.customColor} value={custom} onChange={(e) => setCustom(e.target.value)} className="h-10 w-12 cursor-pointer rounded-sm border border-line bg-transparent" />
        <button type="button" className="btn btn-secondary btn-sm" disabled={value.length >= 8} onClick={() => !has(custom) && onChange([...value, custom.toUpperCase()])}>
          + {f.customColor}
        </button>
      </div>
      {value.length ? (
        <ul className="mt-4 flex flex-wrap gap-2" aria-label={f.dressColors}>
          {value.map((c) => (
            <li key={c} className="flex items-center gap-2 rounded-full border border-line bg-white py-1 pe-2 ps-1 text-xs">
              <span className="h-6 w-6 rounded-full border border-line" style={{ backgroundColor: c }} aria-hidden="true" />
              <span dir="ltr">{c}</span>
              <button type="button" onClick={() => toggle(c)} aria-label={`${f.removeColor} ${c}`} className="px-1 text-stone hover:text-danger">×</button>
            </li>
          ))}
        </ul>
      ) : null}
    </fieldset>
  );
}

type Contact = { name: string; role: string; phone: string };

export function ContactsEditor({ value, onChange, f, error }: { value: Contact[]; onChange: (next: Contact[]) => void; f: F; error: (key: string) => string | undefined }) {
  const rows = value.length ? value : [{ name: "", role: "", phone: "" }];
  const patch = (i: number, p: Partial<Contact>) => onChange(rows.map((c, j) => (j === i ? { ...c, ...p } : c)));
  return (
    <fieldset className="card p-5 sm:col-span-2">
      <legend className="px-1 font-serif text-xl">{f.contactsTitle}</legend>
      <p className="mb-4 text-sm text-stone">{f.contactsHint}</p>
      <ol className="space-y-3">
        {rows.map((c, i) => (
          <li key={i} className="rounded-sm border border-line bg-paper/60 p-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block">
                <span className="field-label">{f.contactName} {i + 1}</span>
                <input className="field" maxLength={80} value={c.name} onChange={(e) => patch(i, { name: e.target.value })} />
              </label>
              <label className="block">
                <span className="field-label">{f.contactRole}</span>
                <input className="field" maxLength={80} placeholder={f.contactRolePh} value={c.role} onChange={(e) => patch(i, { role: e.target.value })} />
              </label>
              <label className="block">
                <span className="field-label">{f.contactPhone}</span>
                <input className="field" type="tel" dir="ltr" autoComplete="off" maxLength={30} value={c.phone} onChange={(e) => patch(i, { phone: e.target.value })} aria-invalid={error(`details.contacts.${i}.phone`) ? true : undefined} />
                {error(`details.contacts.${i}.phone`) ? <span className="field-error" role="alert">{error(`details.contacts.${i}.phone`)}</span> : null}
              </label>
            </div>
            {rows.length > 1 || c.name || c.phone ? (
              <button type="button" className="btn btn-ghost btn-sm mt-2 text-danger" onClick={() => onChange(rows.filter((_, j) => j !== i))}>
                ✕ {f.removeContact}
              </button>
            ) : null}
          </li>
        ))}
      </ol>
      {rows.length < 6 ? (
        <button type="button" className="btn btn-secondary btn-sm mt-3" onClick={() => onChange([...rows, { name: "", role: "", phone: "" }])}>
          {f.addContact}
        </button>
      ) : null}
    </fieldset>
  );
}

type Photo = { path: string; name: string };

/** Photos envoyées directement depuis le formulaire (stockage privé, visible par l'équipe). */
export function PhotoUploader({ invitationId, value, onChange, f }: { invitationId: string; value: Photo[]; onChange: (next: Photo[]) => void; f: F }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [previews, setPreviews] = useState<Record<string, string>>({});

  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setMessage("");
    let list = [...value];
    const chosen = Array.from(files);
    if (list.length + chosen.length > 10) setMessage(f.photosTooMany);
    setBusy(true);
    for (const file of chosen.slice(0, Math.max(0, 10 - list.length))) {
      try {
        const ticket = await requestPhotoUpload(invitationId, { name: file.name, type: file.type, size: file.size });
        if (!ticket.ok) {
          setMessage(f.photosError);
          continue;
        }
        const { error } = await browserClient().storage.from("uploads").uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: ticket.mime });
        if (error) {
          setMessage(f.photosError);
          continue;
        }
        list = [...list, { path: ticket.path, name: file.name.slice(0, 120) }];
        setPreviews((p) => ({ ...p, [ticket.path]: URL.createObjectURL(file) }));
        onChange(list);
      } catch {
        setMessage(f.photosError);
      }
    }
    setBusy(false);
  };

  return (
    <div className="sm:col-span-2">
      <p className="field-label">{f.photosTitle}</p>
      <p className="field-hint !mt-0 mb-3">{f.photosUploadHint}</p>
      {value.length ? (
        <ul className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {value.map((p) => (
            <li key={p.path} className="relative overflow-hidden rounded-sm border border-line bg-paper">
              {previews[p.path] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previews[p.path]} alt={p.name} className="aspect-square w-full object-cover" />
              ) : (
                <span className="flex aspect-square items-center justify-center break-all p-2 text-center text-[0.7rem] text-stone">{p.name}</span>
              )}
              <button
                type="button"
                className="absolute end-1 top-1 rounded-full bg-white/90 px-2 py-0.5 text-xs text-danger shadow"
                onClick={() => {
                  onChange(value.filter((x) => x.path !== p.path));
                  void removePhoto(invitationId, p.path);
                }}
              >
                {f.photosRemove}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {value.length < 10 ? (
        <label className={`btn btn-secondary btn-sm cursor-pointer ${busy ? "pointer-events-none opacity-60" : ""}`}>
          {busy ? f.photosUploading : f.photosAdd}
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" disabled={busy} onChange={(e) => { void add(e.target.files); e.target.value = ""; }} />
        </label>
      ) : null}
      {message ? <p role="alert" className="field-error">{message}</p> : null}
    </div>
  );
}
