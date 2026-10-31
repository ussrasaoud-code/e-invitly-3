"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { InvitationView } from "@/components/invitation/InvitationView";
import { PhoneFrame } from "@/components/site/PhoneFrame";
import {
  EVENT_TYPES,
  EVENT_TYPE_LABELS,
  FONT_KEYS,
  FUNCTIONAL_SECTIONS,
  SECTION_LABELS,
  SECTION_TYPES,
  type InvitationContent,
  type InvitationEvent,
  type RendererKey,
} from "@/lib/invitation/schema";
import type { SaveResult } from "@/lib/save-result";
import type { InvitationContentInput } from "@/lib/invitation/schema";

/**
 * Éditeur par sections et propriétés (v1).
 * - Champs dynamiques : valeurs typées, jamais de HTML libre.
 * - Sections fonctionnelles (RSVP, compte à rebours) : seuls libellé et visibilité.
 * - Sauvegarde automatique du BROUILLON ; la version publique ne change pas.
 * - Annuler / rétablir sur la session en cours.
 */

const TIMEZONES = [
  "Europe/Paris", "Europe/Brussels", "Europe/Zurich", "Europe/Luxembourg", "Europe/Monaco", "Europe/London",
  "Europe/Madrid", "Europe/Rome", "Europe/Berlin", "Europe/Lisbon", "Africa/Casablanca", "Africa/Algiers",
  "Africa/Tunis", "Asia/Dubai", "America/Montreal", "America/New_York", "America/Los_Angeles",
];
const FONT_LABELS: Record<(typeof FONT_KEYS)[number], string> = {
  aboreto: "Aboreto (capitales gravées)",
  dancing: "Dancing Script (manuscrite)",
  jost: "Jost (lisible)",
  cormorant: "Cormorant Garamond (serif élégante)",
  amiri: "Amiri (arabe)",
};
const COLOR_LABELS: Record<keyof InvitationContent["theme"]["colors"], string> = {
  background: "Fond",
  surface: "Fond des encadrés",
  ink: "Texte",
  muted: "Texte secondaire",
  accent: "Accent",
  accentSoft: "Accent doux",
};

type SaveState = { kind: "idle" | "dirty" | "saving" | "saved" | "error"; at?: string; message?: string; issues?: string[] };

const inputCls = "field min-h-10 py-1.5 text-sm";

function L({ label, children, hint, className = "" }: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="field-label !mb-1 !text-xs">{label}</span>
      {children}
      {hint ? <span className="field-hint block !text-xs">{hint}</span> : null}
    </label>
  );
}

function Panel({ title, children, defaultOpen = false, badge }: { title: string; children: ReactNode; defaultOpen?: boolean; badge?: string }) {
  return (
    <details open={defaultOpen} className="group card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span className="font-serif text-lg">{title}</span>
        <span className="flex items-center gap-2 text-xs text-stone">
          {badge}
          <span aria-hidden="true" className="transition-transform group-open:rotate-90">›</span>
        </span>
      </summary>
      <div className="space-y-4 border-t border-line px-4 py-4">{children}</div>
    </details>
  );
}

function IconBtn({ label, onClick, children, disabled }: { label: string; onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled} className="flex h-9 w-9 items-center justify-center rounded-sm border border-line bg-white text-sm hover:border-forest disabled:opacity-40">
      {children}
    </button>
  );
}

function move<T>(arr: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (j < 0 || j >= arr.length) return arr;
  const copy = [...arr];
  [copy[i], copy[j]] = [copy[j], copy[i]];
  return copy;
}

export function InvitationEditor({
  save: saveAction,
  autosave = true,
  initial,
  renderer,
  initialSavedAt,
  readOnlyNotice,
  savedLabel = "Brouillon enregistré",
  previewNote = "Aperçu du brouillon — non visible par les invités",
}: {
  /** Action serveur liée à l'élément édité (brouillon d'invitation ou nouvelle version de modèle) */
  save: (content: InvitationContentInput) => Promise<SaveResult>;
  /** true : sauvegarde automatique ; false : bouton « Enregistrer » */
  autosave?: boolean;
  initial: InvitationContent;
  renderer: RendererKey;
  initialSavedAt: string;
  readOnlyNotice?: string;
  savedLabel?: string;
  previewNote?: string;
}) {
  const [content, setContent] = useState(initial);
  const [past, setPast] = useState<InvitationContent[]>([]);
  const [future, setFuture] = useState<InvitationContent[]>([]);
  const [save, setSave] = useState<SaveState>({ kind: "saved", at: initialSavedAt });
  const [previewKey, setPreviewKey] = useState(0);
  const [showEnvelope, setShowEnvelope] = useState(false);
  const lastPush = useRef(0);
  /** Dernier contenu enregistré : on ne sauvegarde que si le contenu a réellement changé */
  const savedJson = useRef(JSON.stringify(initial));
  const latest = useRef(content);
  latest.current = content;

  const update = useCallback((fn: (c: InvitationContent) => InvitationContent) => {
    setContent((prev) => {
      const next = fn(prev);
      if (next === prev) return prev;
      // Regroupe les frappes rapprochées en une seule étape d'annulation
      if (Date.now() - lastPush.current > 800) {
        setPast((p) => [...p.slice(-49), prev]);
        lastPush.current = Date.now();
      }
      setFuture([]);
      return next;
    });
  }, []);

  const undo = () => {
    setPast((p) => {
      if (!p.length) return p;
      const prev = p[p.length - 1];
      setFuture((f) => [latest.current, ...f]);
      setContent(prev);
      return p.slice(0, -1);
    });
    lastPush.current = 0;
  };
  const redo = () => {
    setFuture((f) => {
      if (!f.length) return f;
      const [next, ...rest] = f;
      setPast((p) => [...p, latest.current]);
      setContent(next);
      return rest;
    });
    lastPush.current = 0;
  };

  const runSave = useCallback(async () => {
    setSave({ kind: "saving" });
    try {
      const snapshot = latest.current;
      const res = await saveAction(snapshot);
      if (res.ok) savedJson.current = JSON.stringify(snapshot);
      setSave(res.ok ? { kind: "saved", at: res.savedAt } : { kind: "error", message: res.message, issues: res.issues });
    } catch {
      setSave({ kind: "error", message: "Connexion perdue : rien n'a été enregistré. Réessayez." });
    }
  }, [saveAction]);

  // Sauvegarde automatique (1,5 s après la dernière modification)
  useEffect(() => {
    if (JSON.stringify(content) === savedJson.current) return;
    setSave({ kind: "dirty" });
    if (!autosave) return;
    const t = window.setTimeout(runSave, 1500);
    return () => window.clearTimeout(t);
  }, [content, autosave, runSave]);

  // Avertit avant de quitter avec des modifications non enregistrées
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (save.kind === "dirty" || save.kind === "saving") e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [save.kind]);

  // Raccourcis Ctrl/Cmd+Z et Ctrl/Cmd+Maj+Z hors champs de saisie
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const c = content;
  const set = <K extends keyof InvitationContent>(key: K, value: InvitationContent[K]) => update((x) => ({ ...x, [key]: value }));
  const setIn = <K extends "couple" | "mainVenue" | "dressCode" | "practical" | "rsvp" | "closing" | "envelope" | "music">(
    key: K,
    patch: Partial<InvitationContent[K]>,
  ) => update((x) => ({ ...x, [key]: { ...x[key], ...patch } }));
  const setEvent = (i: number, patch: Partial<InvitationEvent>) =>
    update((x) => ({ ...x, events: x.events.map((e, j) => (j === i ? { ...e, ...patch } : e)) }));

  const [date, time] = c.eventAt ? c.eventAt.split("T") : ["", ""];

  const statusText =
    save.kind === "saving"
      ? "Enregistrement…"
      : save.kind === "dirty"
        ? autosave ? "Modifications en cours…" : "Modifications non enregistrées"
        : save.kind === "error"
          ? "Non enregistré"
          : `${savedLabel}${save.at ? ` à ${new Date(save.at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}` : ""}`;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0">
        <div className="sticky top-[57px] z-20 -mx-1 mb-4 flex flex-wrap items-center justify-between gap-3 bg-[#f7f5f0]/95 px-1 py-2 backdrop-blur lg:top-[61px]">
          <p role="status" aria-live="polite" className={`text-sm ${save.kind === "error" ? "text-danger" : "text-stone"}`}>
            <span aria-hidden="true" className={`mr-2 inline-block h-2 w-2 rounded-full ${save.kind === "saved" ? "bg-success" : save.kind === "error" ? "bg-danger" : "bg-warning"}`} />
            {statusText}
          </p>
          <div className="flex gap-2">
            {!autosave ? (
              <button type="button" className="btn btn-primary btn-sm" onClick={runSave} disabled={save.kind !== "dirty" && save.kind !== "error"}>
                Enregistrer une nouvelle version
              </button>
            ) : null}
            <button type="button" className="btn btn-secondary btn-sm" onClick={undo} disabled={!past.length}>
              Annuler
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={redo} disabled={!future.length}>
              Rétablir
            </button>
          </div>
        </div>
        {save.kind === "error" ? (
          <div role="alert" className="mb-4 border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
            {save.message}
            {save.issues?.length ? (
              <ul className="mt-1 list-disc pl-5">
                {save.issues.map((i) => <li key={i}>{i}</li>)}
              </ul>
            ) : null}
          </div>
        ) : null}
        {readOnlyNotice ? <p className="mb-4 text-sm text-warning">{readOnlyNotice}</p> : null}

        <div className="space-y-3">
          <Panel title="Couple et textes" defaultOpen>
            <div className="grid gap-4 sm:grid-cols-2">
              <L label="Premier prénom"><input className={inputCls} value={c.couple.partnerOne} onChange={(e) => setIn("couple", { partnerOne: e.target.value })} /></L>
              <L label="Second prénom"><input className={inputCls} value={c.couple.partnerTwo} onChange={(e) => setIn("couple", { partnerTwo: e.target.value })} /></L>
              <L label="Accroche (au-dessus des prénoms)" className="sm:col-span-2"><input className={inputCls} value={c.kicker} onChange={(e) => set("kicker", e.target.value)} /></L>
              <L label="Texte d'invitation" className="sm:col-span-2"><textarea className={`${inputCls} min-h-20`} value={c.intro} onChange={(e) => set("intro", e.target.value)} /></L>
              <L label="Photo du couple (lien https)" hint="La bibliothèque de médias arrive en phase 3b ; en attendant, collez un lien d'image." className="sm:col-span-2">
                <input className={inputCls} value={c.couple.photoUrl} onChange={(e) => setIn("couple", { photoUrl: e.target.value })} placeholder="https://…" />
              </L>
            </div>
          </Panel>

          <Panel title="Date, lieu et langue" defaultOpen>
            <div className="grid gap-4 sm:grid-cols-2">
              <L label="Date de l'événement"><input type="date" className={inputCls} value={date} onChange={(e) => set("eventAt", e.target.value ? `${e.target.value}T${time || "15:00"}` : "")} /></L>
              <L label="Heure de référence (compte à rebours)"><input type="time" className={inputCls} value={time} disabled={!date} onChange={(e) => set("eventAt", `${date}T${e.target.value || "00:00"}`)} /></L>
              <L label="Fuseau horaire du lieu">
                <select className={inputCls} value={c.timezone} onChange={(e) => set("timezone", e.target.value)}>
                  {(TIMEZONES.includes(c.timezone) ? TIMEZONES : [c.timezone, ...TIMEZONES]).map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                </select>
              </L>
              <L label="Langue de l'invitation">
                <select className={inputCls} value={c.language} onChange={(e) => set("language", e.target.value as InvitationContent["language"])}>
                  <option value="fr">Français</option>
                  <option value="en">Anglais</option>
                  <option value="ar">Arabe (de droite à gauche)</option>
                </select>
              </L>
              <L label="Lieu principal"><input className={inputCls} value={c.mainVenue.name} onChange={(e) => setIn("mainVenue", { name: e.target.value })} /></L>
              <L label="Ville"><input className={inputCls} value={c.mainVenue.city} onChange={(e) => setIn("mainVenue", { city: e.target.value })} /></L>
            </div>
          </Panel>

          <Panel title="Programme et lieux" badge={`${c.events.length} moment${c.events.length > 1 ? "s" : ""}`}>
            {c.events.map((ev, i) => (
              <fieldset key={ev.id} className="rounded-sm border border-line p-3">
                <legend className="px-1 text-sm font-medium">{ev.title || EVENT_TYPE_LABELS[ev.type]}</legend>
                <div className="grid gap-3 sm:grid-cols-3">
                  <L label="Type">
                    <select className={inputCls} value={ev.type} onChange={(e) => setEvent(i, { type: e.target.value as InvitationEvent["type"] })}>
                      {EVENT_TYPES.map((t) => <option key={t} value={t}>{EVENT_TYPE_LABELS[t]}</option>)}
                    </select>
                  </L>
                  <L label="Titre affiché" className="sm:col-span-2"><input className={inputCls} value={ev.title} onChange={(e) => setEvent(i, { title: e.target.value })} /></L>
                  <L label="Arrivée"><input type="time" className={inputCls} value={ev.arrivalTime} onChange={(e) => setEvent(i, { arrivalTime: e.target.value })} /></L>
                  <L label="Début"><input type="time" className={inputCls} value={ev.startTime} onChange={(e) => setEvent(i, { startTime: e.target.value })} /></L>
                  <L label="Lieu"><input className={inputCls} value={ev.venueName} onChange={(e) => setEvent(i, { venueName: e.target.value })} /></L>
                  <L label="Adresse" className="sm:col-span-2"><input className={inputCls} value={ev.address} onChange={(e) => setEvent(i, { address: e.target.value })} /></L>
                  <L label="Lien carte (facultatif)"><input className={inputCls} value={ev.mapsUrl} onChange={(e) => setEvent(i, { mapsUrl: e.target.value })} placeholder="https://maps…" /></L>
                  <L label="Description" className="sm:col-span-3"><input className={inputCls} value={ev.description} onChange={(e) => setEvent(i, { description: e.target.value })} /></L>
                </div>
                <div className="mt-3 flex gap-2">
                  <IconBtn label="Monter" onClick={() => update((x) => ({ ...x, events: move(x.events, i, -1) }))} disabled={i === 0}>↑</IconBtn>
                  <IconBtn label="Descendre" onClick={() => update((x) => ({ ...x, events: move(x.events, i, 1) }))} disabled={i === c.events.length - 1}>↓</IconBtn>
                  <button type="button" className="btn btn-ghost btn-sm text-danger" onClick={() => update((x) => ({ ...x, events: x.events.filter((_, j) => j !== i) }))}>Supprimer</button>
                </div>
              </fieldset>
            ))}
            {c.events.length < 12 ? (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() =>
                  update((x) => ({
                    ...x,
                    events: [...x.events, { id: `e-${Date.now().toString(36)}`, type: "other", title: "", venueName: "", address: "", mapsUrl: "", arrivalTime: "", startTime: "", description: "" }],
                  }))
                }
              >
                + Ajouter un moment
              </button>
            ) : null}
          </Panel>

          <Panel title="Dress code">
            <L label="Texte"><textarea className={`${inputCls} min-h-20`} value={c.dressCode.text} onChange={(e) => setIn("dressCode", { text: e.target.value })} /></L>
            <div>
              <span className="field-label !text-xs">Palette</span>
              <div className="flex flex-wrap items-center gap-2">
                {c.dressCode.palette.map((col, i) => (
                  <span key={i} className="flex items-center gap-1">
                    <input type="color" aria-label={`Couleur ${i + 1}`} value={col} onChange={(e) => setIn("dressCode", { palette: c.dressCode.palette.map((p, j) => (j === i ? e.target.value.toUpperCase() : p)) })} className="h-9 w-11 cursor-pointer border border-line bg-white p-0.5" />
                    <IconBtn label="Retirer la couleur" onClick={() => setIn("dressCode", { palette: c.dressCode.palette.filter((_, j) => j !== i) })}>×</IconBtn>
                  </span>
                ))}
                {c.dressCode.palette.length < 8 ? (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setIn("dressCode", { palette: [...c.dressCode.palette, "#A6B5A2"] })}>+ Couleur</button>
                ) : null}
              </div>
            </div>
          </Panel>

          <Panel title="Informations pratiques">
            <div className="grid gap-4 sm:grid-cols-2">
              <L label="Stationnement"><textarea className={`${inputCls} min-h-16`} value={c.practical.parking} onChange={(e) => setIn("practical", { parking: e.target.value })} /></L>
              <L label="Navettes"><textarea className={`${inputCls} min-h-16`} value={c.practical.shuttles} onChange={(e) => setIn("practical", { shuttles: e.target.value })} /></L>
              <L label="Transports"><textarea className={`${inputCls} min-h-16`} value={c.practical.transport} onChange={(e) => setIn("practical", { transport: e.target.value })} /></L>
              <L label="Hébergements"><textarea className={`${inputCls} min-h-16`} value={c.practical.lodging} onChange={(e) => setIn("practical", { lodging: e.target.value })} /></L>
            </div>
          </Panel>

          <Panel title="Contacts" badge={`${c.contacts.length}`}>
            {c.contacts.map((ct, i) => (
              <div key={i} className="grid items-end gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                <L label="Nom"><input className={inputCls} value={ct.name} onChange={(e) => set("contacts", c.contacts.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} /></L>
                <L label="Rôle"><input className={inputCls} value={ct.role} onChange={(e) => set("contacts", c.contacts.map((x, j) => (j === i ? { ...x, role: e.target.value } : x)))} /></L>
                <L label="Téléphone"><input type="tel" className={inputCls} value={ct.phone} onChange={(e) => set("contacts", c.contacts.map((x, j) => (j === i ? { ...x, phone: e.target.value } : x)))} /></L>
                <IconBtn label="Supprimer le contact" onClick={() => set("contacts", c.contacts.filter((_, j) => j !== i))}>×</IconBtn>
              </div>
            ))}
            {c.contacts.length < 8 ? (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => set("contacts", [...c.contacts, { name: "", role: "", phone: "" }])}>+ Ajouter un contact</button>
            ) : null}
          </Panel>

          <Panel title="RSVP et message final">
            <div className="grid gap-4 sm:grid-cols-2">
              <L label="Date limite (démo et invitations sans réglage RSVP)" hint="Pour une invitation, la date limite qui ferme vraiment les réponses se règle dans l'onglet RSVP et s'affiche à la place de celle-ci."><input type="date" className={inputCls} value={c.rsvp.deadline} onChange={(e) => setIn("rsvp", { deadline: e.target.value })} /></L>
              <L label="Phrase d'introduction du RSVP" hint="Vide = « Merci de répondre avant le … »"><input className={inputCls} value={c.rsvp.intro} onChange={(e) => setIn("rsvp", { intro: e.target.value })} /></L>
              <L label="Titre du message final"><input className={inputCls} value={c.closing.title} onChange={(e) => setIn("closing", { title: e.target.value })} /></L>
              <L label="Message final"><input className={inputCls} value={c.closing.text} onChange={(e) => setIn("closing", { text: e.target.value })} /></L>
            </div>
          </Panel>

          <Panel title="Sections" badge={`${c.sections.filter((s) => s.visible).length}/${c.sections.length} visibles`}>
            <p className="text-xs text-stone">Réordonnez, masquez ou renommez les sections. RSVP et compte à rebours ont une logique verrouillée : seul leur titre change.</p>
            <ol className="space-y-2">
              {c.sections.map((s, i) => (
                <li key={s.id} className={`flex flex-wrap items-center gap-2 rounded-sm border border-line bg-white p-2 ${s.visible ? "" : "opacity-60"}`}>
                  <span className="w-40 text-sm">
                    {SECTION_LABELS[s.type]}
                    {FUNCTIONAL_SECTIONS.includes(s.type) ? <span className="ml-1 text-[0.65rem] uppercase tracking-wider text-stone">· verrouillée</span> : null}
                  </span>
                  <input aria-label={`Titre de la section ${SECTION_LABELS[s.type]}`} className={`${inputCls} min-w-0 flex-1`} placeholder="Titre par défaut" value={s.title} disabled={s.type === "hero" || s.type === "closing"} onChange={(e) => set("sections", c.sections.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
                  <label className="flex items-center gap-1.5 text-xs">
                    <input type="checkbox" checked={s.visible} onChange={(e) => set("sections", c.sections.map((x, j) => (j === i ? { ...x, visible: e.target.checked } : x)))} className="h-4 w-4 accent-forest" />
                    Visible
                  </label>
                  <IconBtn label="Monter" onClick={() => set("sections", move(c.sections, i, -1))} disabled={i === 0}>↑</IconBtn>
                  <IconBtn label="Descendre" onClick={() => set("sections", move(c.sections, i, 1))} disabled={i === c.sections.length - 1}>↓</IconBtn>
                </li>
              ))}
            </ol>
            {SECTION_TYPES.filter((t) => !c.sections.some((s) => s.type === t)).map((t) => (
              <button key={t} type="button" className="btn btn-ghost btn-sm" onClick={() => set("sections", [...c.sections, { id: `s-${t}`, type: t, visible: true, title: "" }])}>
                + {SECTION_LABELS[t]}
              </button>
            ))}
          </Panel>

          <Panel title="Couleurs et typographie">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {(Object.keys(COLOR_LABELS) as Array<keyof typeof COLOR_LABELS>).map((k) => (
                <label key={k} className="flex items-center gap-2 text-sm">
                  <input type="color" value={c.theme.colors[k]} onChange={(e) => update((x) => ({ ...x, theme: { ...x.theme, colors: { ...x.theme.colors, [k]: e.target.value.toUpperCase() } } }))} className="h-9 w-11 cursor-pointer border border-line bg-white p-0.5" />
                  {COLOR_LABELS[k]}
                </label>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {(["display", "script", "body"] as const).map((k) => (
                <L key={k} label={k === "display" ? "Titres" : k === "script" ? "Accents manuscrits" : "Paragraphes"}>
                  <select className={inputCls} value={c.theme.fonts[k]} onChange={(e) => update((x) => ({ ...x, theme: { ...x.theme, fonts: { ...x.theme.fonts, [k]: e.target.value as (typeof FONT_KEYS)[number] } } }))}>
                    {FONT_KEYS.map((f) => <option key={f} value={f}>{FONT_LABELS[f]}</option>)}
                  </select>
                </L>
              ))}
            </div>
            <L label="Animations">
              <select className={inputCls} value={c.theme.animation} onChange={(e) => update((x) => ({ ...x, theme: { ...x.theme, animation: e.target.value as "soft" | "none" } }))}>
                <option value="soft">Apparitions douces au défilement</option>
                <option value="none">Aucune animation</option>
              </select>
            </L>
          </Panel>

          <Panel title="Ouverture et musique">
            <div className="grid gap-4 sm:grid-cols-2">
              <L label="Ouverture">
                <select className={inputCls} value={c.envelope.mode} onChange={(e) => setIn("envelope", { mode: e.target.value as InvitationContent["envelope"]["mode"] })}>
                  <option value="animation">Enveloppe animée</option>
                  <option value="video">Vidéo personnalisée</option>
                  <option value="none">Aucune (affichage direct)</option>
                </select>
              </L>
              <L label="Initiales du cachet"><input className={inputCls} maxLength={6} value={c.envelope.sealText} onChange={(e) => setIn("envelope", { sealText: e.target.value })} /></L>
              {c.envelope.mode === "video" ? (
                <>
                  <L label="Vidéo d'ouverture (lien https, MP4)" hint="À la fin de la vidéo, l'invitation s'ouvre seule."><input className={inputCls} value={c.envelope.videoUrl} onChange={(e) => setIn("envelope", { videoUrl: e.target.value })} /></L>
                  <L label="Image d'attente (facultatif)"><input className={inputCls} value={c.envelope.posterUrl} onChange={(e) => setIn("envelope", { posterUrl: e.target.value })} /></L>
                </>
              ) : null}
              {c.envelope.mode === "animation" ? (
                <label className="flex items-center gap-2 text-sm sm:col-span-2">
                  <input type="checkbox" className="h-4 w-4 accent-forest" checked={c.envelope.autoStart} onChange={(e) => setIn("envelope", { autoStart: e.target.checked })} />
                  Ouvrir automatiquement après 1 seconde
                </label>
              ) : null}
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4 accent-forest" checked={c.music.enabled} onChange={(e) => setIn("music", { enabled: e.target.checked })} />
                Musique d&apos;ambiance
              </label>
              {c.music.enabled ? (
                <L label="Fichier audio (lien https, MP3)" hint="Démarre à l'ouverture de l'enveloppe ; un bouton permet de la couper."><input className={inputCls} value={c.music.url} onChange={(e) => setIn("music", { url: e.target.value })} /></L>
              ) : null}
            </div>
          </Panel>
        </div>
      </div>

      <div className="xl:sticky xl:top-24 xl:self-start">
        <div className="mb-3 flex flex-wrap items-center justify-center gap-3 text-xs">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" className="h-4 w-4 accent-forest" checked={showEnvelope} onChange={(e) => { setShowEnvelope(e.target.checked); setPreviewKey((k) => k + 1); }} />
            Afficher l&apos;ouverture
          </label>
          {showEnvelope ? (
            <button type="button" className="underline underline-offset-4" onClick={() => setPreviewKey((k) => k + 1)}>Rejouer</button>
          ) : null}
        </div>
        <PhoneFrame label="Aperçu du brouillon">
          <InvitationView key={previewKey} content={content} renderer={renderer} mode="preview" framed skipEnvelope={!showEnvelope} />
        </PhoneFrame>
        <p className="mt-3 text-center text-xs text-stone">{previewNote}</p>
      </div>
    </div>
  );
}
