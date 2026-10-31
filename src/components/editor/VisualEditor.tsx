"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { InvitationView } from "@/components/invitation/InvitationView";
import { LayerEditorContext, type LayerEditor } from "@/components/invitation/Layers";
import { MediaPicker } from "@/components/media/MediaPicker";
import {
  ENTER_ANIMATIONS,
  ENTER_ANIMATION_LABELS,
  LOOP_ANIMATIONS,
  LOOP_ANIMATION_LABELS,
  REPEATABLE_SECTIONS,
  SECTION_LABELS,
  SECTION_TYPES,
  cloneSection,
  layerSchema,
  newLayer,
  newSection,
  type InvitationContent,
  type InvitationContentInput,
  type InvitationLayer,
  type InvitationSection,
  type RendererKey,
} from "@/lib/invitation/schema";
import type { SaveResult } from "@/lib/save-result";
import { HistoryDrawer, type HistoryApi } from "./HistoryDrawer";
import { useEditorState } from "./useEditorState";

const CLIPBOARD_KEY = "ei-layer-clipboard";
const WIDTHS = [360, 390, 430] as const;
const inputCls = "field min-h-9 py-1 text-sm";

type Selection = { sectionId: string; layerId: string | null } | null;

function Btn({ label, onClick, children, disabled, active }: { label: string; onClick: () => void; children: ReactNode; disabled?: boolean; active?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      disabled={disabled}
      aria-pressed={active}
      className={`flex h-7 min-w-7 items-center justify-center rounded-sm px-1 text-xs hover:bg-sage-soft disabled:opacity-30 ${active ? "text-forest" : "text-stone"}`}
    >
      {children}
    </button>
  );
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[0.7rem] uppercase tracking-wider text-stone">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[0.7rem] text-stone">{hint}</span> : null}
    </label>
  );
}

function NumberSlider({ label, value, min, max, step = 1, unit = "", onChange }: { label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (v: number) => void }) {
  return (
    <Field label={label}>
      <span className="flex items-center gap-2">
        <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="min-w-0 flex-1 accent-forest" aria-label={label} />
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v)) onChange(Math.min(max, Math.max(min, v)));
          }}
          className="field min-h-8 w-[4.5rem] px-2 py-0.5 text-sm"
          aria-label={`${label} (valeur)`}
        />
        {unit ? <span className="w-4 text-xs text-stone">{unit}</span> : null}
      </span>
    </Field>
  );
}

const sectionName = (s: InvitationSection) => (s.title && !["hero", "closing"].includes(s.type) ? s.title : SECTION_LABELS[s.type]);
const layerName = (l: InvitationLayer) =>
  l.name || (l.kind === "text" ? `« ${l.text.slice(0, 24) || "Texte"} »` : decodeURIComponent(l.src.split("/").pop() ?? "Image").replace(/^[0-9a-f]{8}-/, "").replace(/\.\w+$/, "") || "Image");

export function VisualEditor({
  initial,
  renderer,
  save,
  autosave = true,
  initialSavedAt,
  savedLabel = "Brouillon enregistré",
  title,
  backHref,
  backLabel,
  formHref,
  history,
}: {
  initial: InvitationContent;
  renderer: RendererKey;
  save: (content: InvitationContentInput) => Promise<SaveResult>;
  autosave?: boolean;
  initialSavedAt: string;
  savedLabel?: string;
  title: string;
  backHref: string;
  backLabel: string;
  /** Lien vers le formulaire classique (textes, dates, lieux) */
  formHref: string;
  /** Historique des brouillons (invitations seulement) */
  history?: HistoryApi;
}) {
  const ed = useEditorState({ initial, initialSavedAt, save, autosave });
  const { content: c, update } = ed;
  const [sel, setSel] = useState<Selection>(null);
  const [width, setWidth] = useState<(typeof WIDTHS)[number]>(390);
  const [animate, setAnimate] = useState(false);
  const [replay, setReplay] = useState(0);
  const [picker, setPicker] = useState<null | "add" | "replace">(null);
  const [showHistory, setShowHistory] = useState(false);
  const [clipboard, setClipboard] = useState<InvitationLayer | null>(null);
  const [notice, setNotice] = useState("");
  const canvasRef = useRef<HTMLDivElement>(null);

  const section = sel ? c.sections.find((s) => s.id === sel.sectionId) ?? null : null;
  const layer = section && sel?.layerId ? section.layers.find((l) => l.id === sel.layerId) ?? null : null;

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CLIPBOARD_KEY);
      const parsed = raw ? layerSchema.safeParse(JSON.parse(raw)) : null;
      if (parsed?.success) setClipboard(parsed.data);
    } catch {
      /* stockage indisponible : presse-papiers limité à cette page */
    }
  }, []);

  const flash = (msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(""), 2200);
  };

  /* ── Opérations ─────────────────────────────────────────────────── */
  const setSections = useCallback((fn: (s: InvitationSection[]) => InvitationSection[]) => update((x) => ({ ...x, sections: fn(x.sections) })), [update]);
  const patchSection = useCallback((id: string, patch: Partial<InvitationSection>) => setSections((ss) => ss.map((s) => (s.id === id ? { ...s, ...patch } : s))), [setSections]);
  const patchLayers = useCallback(
    (sectionId: string, fn: (ls: InvitationLayer[]) => InvitationLayer[]) => setSections((ss) => ss.map((s) => (s.id === sectionId ? { ...s, layers: fn(s.layers) } : s))),
    [setSections],
  );
  const patchLayer = useCallback(
    (sectionId: string, layerId: string, patch: Partial<InvitationLayer>) => patchLayers(sectionId, (ls) => ls.map((l) => (l.id === layerId ? { ...l, ...patch } : l))),
    [patchLayers],
  );

  const addLayer = (l: InvitationLayer) => {
    const target = section ?? c.sections.find((s) => s.visible) ?? c.sections[0];
    patchLayers(target.id, (ls) => [...ls, l]);
    setSel({ sectionId: target.id, layerId: l.id });
  };
  const deleteLayer = () => {
    if (!section || !layer) return;
    patchLayers(section.id, (ls) => ls.filter((l) => l.id !== layer.id));
    setSel({ sectionId: section.id, layerId: null });
  };
  const duplicateLayer = () => {
    if (!section || !layer) return;
    const copy = newLayer(layer.kind, { ...structuredClone(layer), x: Math.min(160, layer.x + 4), y: Math.min(160, layer.y + 4) });
    copy.id = newLayer(layer.kind).id;
    patchLayers(section.id, (ls) => [...ls, copy]);
    setSel({ sectionId: section.id, layerId: copy.id });
  };
  const copyLayer = () => {
    if (!layer) return;
    setClipboard(layer);
    try {
      window.localStorage.setItem(CLIPBOARD_KEY, JSON.stringify(layer));
    } catch {
      /* ignoré */
    }
    flash("Calque copié : collez-le dans n'importe quelle section ou invitation (Ctrl+V).");
  };
  const pasteLayer = () => {
    if (!clipboard) return;
    addLayer({ ...structuredClone(clipboard), id: newLayer(clipboard.kind).id, locked: false });
  };
  const moveLayer = (dir: 1 | -1) => {
    if (!section || !layer) return;
    patchLayers(section.id, (ls) => {
      const i = ls.findIndex((l) => l.id === layer.id);
      const j = i + dir;
      if (j < 0 || j >= ls.length) return ls;
      const copy = [...ls];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  };

  const moveSection = (id: string, dir: 1 | -1) =>
    setSections((ss) => {
      const i = ss.findIndex((s) => s.id === id);
      const j = i + dir;
      if (j < 0 || j >= ss.length) return ss;
      const copy = [...ss];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  const duplicateSection = (s: InvitationSection) => {
    const copy = cloneSection(s);
    setSections((ss) => {
      const i = ss.findIndex((x) => x.id === s.id);
      return [...ss.slice(0, i + 1), copy, ...ss.slice(i + 1)];
    });
    setSel({ sectionId: copy.id, layerId: null });
  };
  const deleteSection = (s: InvitationSection) => {
    if (c.sections.length <= 1) return;
    const extra = s.layers.length ? ` et ses ${s.layers.length} calque(s)` : "";
    if (!window.confirm(`Supprimer la section « ${sectionName(s)} »${extra} ? (Annuler reste possible.)`)) return;
    setSections((ss) => ss.filter((x) => x.id !== s.id));
    setSel(null);
  };
  const addSection = (type: InvitationSection["type"]) => {
    const s = newSection(type);
    const at = section ? c.sections.findIndex((x) => x.id === section.id) + 1 : c.sections.length;
    setSections((ss) => [...ss.slice(0, at), s, ...ss.slice(at)]);
    setSel({ sectionId: s.id, layerId: null });
    window.setTimeout(() => scrollTo(s.id), 50);
  };
  const scrollTo = (sectionId: string) => {
    canvasRef.current?.querySelector(`[data-section-id="${sectionId}"]`)?.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  const editorApi = useMemo<LayerEditor>(
    () => ({ selected: sel, select: (sectionId, layerId) => setSel({ sectionId, layerId }), change: patchLayer }),
    [sel, patchLayer],
  );

  /* ── Raccourcis clavier ─────────────────────────────────────────── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) || t.isContentEditable) return;
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      if (mod && k === "z") {
        e.preventDefault();
        if (e.shiftKey) ed.redo();
        else ed.undo();
      } else if (mod && k === "y") {
        e.preventDefault();
        ed.redo();
      } else if (mod && k === "c" && layer) {
        e.preventDefault();
        copyLayer();
      } else if (mod && k === "v" && clipboard) {
        e.preventDefault();
        pasteLayer();
      } else if (mod && k === "d" && layer) {
        e.preventDefault();
        duplicateLayer();
      } else if ((e.key === "Delete" || e.key === "Backspace") && layer && !layer.locked) {
        e.preventDefault();
        deleteLayer();
      } else if (e.key === "Escape") {
        setSel(null);
      } else if (layer && !layer.locked && section && e.key.startsWith("Arrow")) {
        e.preventDefault();
        const step = e.shiftKey ? 5 : 0.5;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        patchLayer(section.id, layer.id, { x: Math.round((layer.x + dx) * 10) / 10, y: Math.round((layer.y + dy) * 10) / 10 });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const statusText =
    ed.save.kind === "saving"
      ? "Enregistrement…"
      : ed.save.kind === "dirty"
        ? autosave ? "Modifications en cours…" : "Modifications non enregistrées"
        : ed.save.kind === "error"
          ? "Non enregistré"
          : `${savedLabel}${ed.save.at ? ` à ${new Date(ed.save.at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}` : ""}`;

  const addable = SECTION_TYPES.filter((t) => REPEATABLE_SECTIONS.includes(t) || !c.sections.some((s) => s.type === t));

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#efece5] text-charcoal">
      <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-4 bg-ivory p-8 text-center lg:hidden">
        <p className="font-serif text-2xl">L&apos;éditeur visuel s&apos;utilise sur ordinateur</p>
        <p className="max-w-sm text-sm text-stone">Il a besoin d&apos;un écran d&apos;au moins 1024 pixels de large pour afficher les sections, le téléphone et les réglages côte à côte.</p>
        <Link href={backHref} className="btn btn-secondary btn-sm">← {backLabel}</Link>
      </div>
      {/* Barre du haut */}
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-ivory px-4 py-2">
        <Link href={backHref} className="text-sm text-stone hover:text-forest">← {backLabel}</Link>
        <h1 className="font-serif text-xl">{title}</h1>
        <p role="status" aria-live="polite" className={`text-xs ${ed.save.kind === "error" ? "text-danger" : "text-stone"}`}>
          <span aria-hidden="true" className={`mr-1.5 inline-block h-2 w-2 rounded-full ${ed.save.kind === "saved" ? "bg-success" : ed.save.kind === "error" ? "bg-danger" : "bg-warning"}`} />
          {statusText}
        </p>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {!autosave ? (
            <button type="button" className="btn btn-primary btn-sm" onClick={ed.runSave} disabled={ed.save.kind !== "dirty" && ed.save.kind !== "error"}>
              Enregistrer une nouvelle version
            </button>
          ) : null}
          <button type="button" className="btn btn-secondary btn-sm" onClick={ed.undo} disabled={!ed.canUndo} title="Ctrl+Z">Annuler</button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={ed.redo} disabled={!ed.canRedo} title="Ctrl+Maj+Z">Rétablir</button>
          <button
            type="button"
            className={`btn btn-sm ${animate ? "btn-primary" : "btn-secondary"}`}
            aria-pressed={animate}
            onClick={() => {
              setAnimate((a) => !a);
              setReplay((r) => r + 1);
            }}
          >
            {animate ? "Arrêter l'aperçu animé" : "Aperçu animé"}
          </button>
          <label className="sr-only" htmlFor="ve-width">Largeur du téléphone</label>
          <select id="ve-width" value={width} onChange={(e) => setWidth(Number(e.target.value) as (typeof WIDTHS)[number])} className="field min-h-8 w-auto py-0.5 text-xs">
            {WIDTHS.map((w) => <option key={w} value={w}>{w === 360 ? "Petit téléphone" : w === 390 ? "Téléphone" : "Grand téléphone"} · {w}px</option>)}
          </select>
          {history ? (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowHistory(true)}>Historique</button>
          ) : null}
        </div>
      </header>
      {ed.save.kind === "error" ? (
        <div role="alert" className="border-b border-danger/30 bg-danger-soft px-4 py-2 text-sm text-danger">
          {ed.save.message}
          {ed.save.issues?.length ? <ul className="mt-1 list-disc pl-5 text-xs">{ed.save.issues.map((i) => <li key={i}>{i}</li>)}</ul> : null}
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-[250px_minmax(0,1fr)_300px]">
        {/* ── Colonne gauche : sections et calques ── */}
        <aside className="min-h-0 overflow-y-auto border-r border-line bg-ivory p-3" aria-label="Sections et calques">
          <p className="px-1 text-[0.7rem] uppercase tracking-wider text-stone">Sections</p>
          <ul className="mt-2 space-y-0.5">
            {c.sections.map((s, i) => {
              const active = sel?.sectionId === s.id;
              return (
                <li key={s.id}>
                  <div
                    className={`group flex items-center gap-1 rounded-sm px-1.5 py-1 ${active ? "bg-sage-soft" : "hover:bg-paper"} ${s.visible ? "" : "opacity-50"}`}
                  >
                    <button
                      type="button"
                      className="min-w-0 flex-1 truncate text-left text-sm"
                      onClick={() => {
                        setSel({ sectionId: s.id, layerId: null });
                        scrollTo(s.id);
                      }}
                    >
                      {sectionName(s)}
                      {s.layers.length ? <span className="ml-1 text-[0.65rem] text-stone">· {s.layers.length}</span> : null}
                    </button>
                    <Btn label={s.visible ? `Masquer ${sectionName(s)}` : `Afficher ${sectionName(s)}`} onClick={() => patchSection(s.id, { visible: !s.visible })}>{s.visible ? "◉" : "○"}</Btn>
                    <Btn label="Monter la section" onClick={() => moveSection(s.id, -1)} disabled={i === 0}>↑</Btn>
                    <Btn label="Descendre la section" onClick={() => moveSection(s.id, 1)} disabled={i === c.sections.length - 1}>↓</Btn>
                  </div>
                  {active ? (
                    <div className="mb-2 ml-3 border-l border-line pl-2">
                      <p className="mt-1 text-[0.65rem] uppercase tracking-wider text-stone">Calques (le premier est au-dessus)</p>
                      {s.layers.length ? (
                        <ul className="mt-1 space-y-0.5">
                          {[...s.layers].reverse().map((l) => (
                            <li key={l.id} className={`flex items-center gap-1 rounded-sm px-1 py-0.5 ${sel?.layerId === l.id ? "bg-white shadow-sm" : "hover:bg-paper"}`}>
                              <button type="button" className={`min-w-0 flex-1 truncate text-left text-xs ${l.hidden ? "opacity-40" : ""}`} onClick={() => setSel({ sectionId: s.id, layerId: l.id })}>
                                <span className="mr-1 text-stone">{l.kind === "text" ? "T" : "▣"}</span>
                                {layerName(l)}
                                <span className="ml-1 text-[0.6rem] text-stone">{l.placement === "front" ? "devant" : "derrière"}</span>
                              </button>
                              <Btn label={l.hidden ? "Afficher le calque" : "Masquer le calque"} onClick={() => patchLayer(s.id, l.id, { hidden: !l.hidden })}>{l.hidden ? "○" : "◉"}</Btn>
                              <Btn label={l.locked ? "Déverrouiller le calque" : "Verrouiller le calque"} active={l.locked} onClick={() => patchLayer(s.id, l.id, { locked: !l.locked })}>{l.locked ? "🔒" : "🔓"}</Btn>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1 text-xs text-stone">Aucun calque.</p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-1">
                        <button type="button" className="btn btn-secondary btn-sm !px-2 !text-[0.65rem]" onClick={() => setPicker("add")}>+ Image</button>
                        <button type="button" className="btn btn-secondary btn-sm !px-2 !text-[0.65rem]" onClick={() => addLayer(newLayer("text", { y: 30 }))}>+ Texte</button>
                        {clipboard ? <button type="button" className="btn btn-ghost btn-sm !px-2 !text-[0.65rem]" onClick={pasteLayer}>Coller</button> : null}
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <label className="mt-4 block px-1">
            <span className="text-[0.7rem] uppercase tracking-wider text-stone">Ajouter une section</span>
            <select
              aria-label="Ajouter une section"
              className={`${inputCls} mt-1`}
              value=""
              onChange={(e) => {
                if (e.target.value) addSection(e.target.value as InvitationSection["type"]);
              }}
            >
              <option value="">Choisir…</option>
              {addable.map((t) => <option key={t} value={t}>{SECTION_LABELS[t]}</option>)}
            </select>
          </label>
        </aside>

        {/* ── Centre : l'invitation dans un téléphone ── */}
        <main
          className="min-h-0 overflow-y-auto px-6 py-6"
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) setSel(null);
          }}
        >
          <div
            ref={canvasRef}
            className="relative mx-auto overflow-hidden rounded-[28px] border-[6px] border-charcoal bg-white shadow-xl"
            style={{ width: width + 12 }}
            aria-label="Aperçu modifiable de l'invitation"
          >
            <LayerEditorContext.Provider value={editorApi}>
              <InvitationView key={`${replay}-${animate}`} content={c} renderer={renderer} mode="preview" framed skipEnvelope animations={animate} />
            </LayerEditorContext.Provider>
          </div>
          <p className="mx-auto mt-3 max-w-md text-center text-xs text-stone">
            Cliquez sur une section ou un calque pour le modifier. Glissez pour déplacer, poignée ronde du coin pour agrandir, poignée du haut pour pivoter (Maj : par pas de 15°).
          </p>
        </main>

        {/* ── Colonne droite : propriétés ── */}
        <aside className="min-h-0 overflow-y-auto border-l border-line bg-ivory p-4" aria-label="Propriétés">
          {layer && section ? (
            <LayerPanel
              key={layer.id}
              layer={layer}
              onChange={(patch) => patchLayer(section.id, layer.id, patch)}
              onReplace={() => setPicker("replace")}
              onDelete={deleteLayer}
              onDuplicate={duplicateLayer}
              onCopy={copyLayer}
              onMove={moveLayer}
              onReplay={() => {
                setAnimate(true);
                setReplay((r) => r + 1);
              }}
            />
          ) : section ? (
            <SectionPanel
              section={section}
              formHref={formHref}
              canDelete={c.sections.length > 1}
              onChange={(patch) => patchSection(section.id, patch)}
              onDuplicate={() => duplicateSection(section)}
              onDelete={() => deleteSection(section)}
              onAddImage={() => setPicker("add")}
              onAddText={() => addLayer(newLayer("text", { y: 30 }))}
            />
          ) : (
            <div className="space-y-4 text-sm">
              <h2 className="font-serif text-2xl">Éditeur visuel</h2>
              <p className="text-stone">Sélectionnez une section dans le téléphone ou dans la liste de gauche pour y ajouter des fleurs, des colombes, des textures ou un texte libre.</p>
              <p className="text-stone">
                Les prénoms, la date, le programme et les lieux se modifient dans le <Link href={formHref} className="text-forest underline">formulaire</Link> : la mise en page s&apos;adapte seule.
              </p>
              <div>
                <p className="text-[0.7rem] uppercase tracking-wider text-stone">Raccourcis</p>
                <ul className="mt-1 space-y-0.5 text-xs text-stone">
                  <li>Flèches : déplacer (Maj : plus vite)</li>
                  <li>Ctrl+C / Ctrl+V : copier / coller un calque</li>
                  <li>Ctrl+D : dupliquer · Suppr : supprimer</li>
                  <li>Ctrl+Z / Ctrl+Maj+Z : annuler / rétablir</li>
                  <li>Échap : désélectionner</li>
                </ul>
              </div>
              <Field label="Animations de l'invitation">
                <select
                  aria-label="Animations de l'invitation"
                  className={inputCls}
                  value={c.theme.animation}
                  onChange={(e) => update((x) => ({ ...x, theme: { ...x.theme, animation: e.target.value as InvitationContent["theme"]["animation"] } }))}
                >
                  <option value="soft">Activées</option>
                  <option value="none">Désactivées (toutes)</option>
                </select>
              </Field>
            </div>
          )}
        </aside>
      </div>

      {notice ? (
        <p role="status" className="fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-sm bg-charcoal px-4 py-2 text-sm text-ivory shadow-lg">{notice}</p>
      ) : null}

      <MediaPicker
        kinds={["image", "svg"]}
        open={picker !== null}
        title={picker === "replace" ? "Remplacer l'image" : "Ajouter une illustration"}
        onClose={() => setPicker(null)}
        onSelect={(m) => {
          if (picker === "replace" && section && layer) patchLayer(section.id, layer.id, { src: m.url, name: m.name });
          else addLayer(newLayer("image", { src: m.url, name: m.name }));
        }}
      />
      {history && showHistory ? (
        <HistoryDrawer
          api={history}
          onClose={() => setShowHistory(false)}
          dirty={ed.save.kind === "dirty" || ed.save.kind === "saving"}
          onRestored={(content, savedAt) => {
            ed.reset(content, savedAt);
            setSel(null);
            flash("Brouillon restauré. L'état précédent reste dans l'historique.");
          }}
        />
      ) : null}
    </div>
  );
}

/* ── Panneau d'un calque ──────────────────────────────────────────── */
function LayerPanel({ layer: l, onChange, onReplace, onDelete, onDuplicate, onCopy, onMove, onReplay }: {
  layer: InvitationLayer;
  onChange: (patch: Partial<InvitationLayer>) => void;
  onReplace: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onCopy: () => void;
  onMove: (dir: 1 | -1) => void;
  onReplay: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-serif text-2xl">{l.kind === "text" ? "Texte libre" : "Illustration"}</h2>
        <span className="text-xs text-stone">{l.locked ? "verrouillé" : ""}</span>
      </div>
      {l.kind === "image" ? (
        <div className="flex items-center gap-3">
          {l.src ? <img src={l.src} alt="" className="checker h-16 w-16 rounded-sm border border-line object-contain" /> : null}
          <button type="button" className="btn btn-secondary btn-sm" onClick={onReplace}>Changer l&apos;image</button>
        </div>
      ) : (
        <>
          <Field label="Texte">
            <textarea aria-label="Texte" className="field min-h-16 text-sm" maxLength={240} value={l.text} onChange={(e) => onChange({ text: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Police">
              <select aria-label="Police" className={inputCls} value={l.font} onChange={(e) => onChange({ font: e.target.value as InvitationLayer["font"] })}>
                <option value="script">Manuscrite</option>
                <option value="display">Titres</option>
                <option value="body">Texte</option>
              </select>
            </Field>
            <Field label="Couleur">
              <span className="flex items-center gap-2">
                <input type="color" value={l.color || "#7a6a52"} onChange={(e) => onChange({ color: e.target.value })} className="h-9 w-10 cursor-pointer rounded-sm border border-line" aria-label="Couleur du texte" />
                {l.color ? <button type="button" className="text-xs text-stone underline" onClick={() => onChange({ color: "" })}>Thème</button> : <span className="text-xs text-stone">thème</span>}
              </span>
            </Field>
          </div>
          <NumberSlider label="Taille du texte" value={l.fontSize} min={2} max={30} step={0.5} onChange={(v) => onChange({ fontSize: v })} />
        </>
      )}
      <Field label="Nom du calque">
        <input aria-label="Nom du calque" className={inputCls} maxLength={60} value={l.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="ex. Pivoine en haut à gauche" />
      </Field>

      <fieldset className="space-y-3 border-t border-line pt-3">
        <legend className="sr-only">Position et taille</legend>
        <div className="grid grid-cols-2 gap-2">
          <NumberSlider label="Horizontal" value={l.x} min={-60} max={160} step={0.5} unit="%" onChange={(v) => onChange({ x: v })} />
          <NumberSlider label="Vertical" value={l.y} min={-60} max={160} step={0.5} unit="%" onChange={(v) => onChange({ y: v })} />
        </div>
        <NumberSlider label="Largeur" value={l.width} min={2} max={220} step={0.5} unit="%" onChange={(v) => onChange({ width: v })} />
        <NumberSlider label="Rotation" value={l.rotation} min={-180} max={180} unit="°" onChange={(v) => onChange({ rotation: v })} />
        <NumberSlider label="Opacité" value={Math.round(l.opacity * 100)} min={0} max={100} unit="%" onChange={(v) => onChange({ opacity: v / 100 })} />
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-ghost btn-sm !px-2" onClick={() => onChange({ x: 50 })}>Centrer</button>
          <button type="button" className={`btn btn-sm !px-2 ${l.flip ? "btn-primary" : "btn-ghost"}`} aria-pressed={l.flip} onClick={() => onChange({ flip: !l.flip })}>Miroir</button>
          <button type="button" className="btn btn-ghost btn-sm !px-2" onClick={() => onChange({ rotation: 0 })}>Redresser</button>
        </div>
        <Field label="Place par rapport au texte de la section">
          <select aria-label="Place par rapport au texte de la section" className={inputCls} value={l.placement} onChange={(e) => onChange({ placement: e.target.value as InvitationLayer["placement"] })}>
            <option value="behind">Derrière le texte</option>
            <option value="front">Devant le texte</option>
          </select>
        </Field>
        <div className="flex gap-2">
          <button type="button" className="btn btn-ghost btn-sm !px-2" onClick={() => onMove(1)}>Vers l&apos;avant</button>
          <button type="button" className="btn btn-ghost btn-sm !px-2" onClick={() => onMove(-1)}>Vers l&apos;arrière</button>
        </div>
        {l.kind === "image" ? (
          <Field label="Teinte" hint="Recolore la silhouette (idéal pour les SVG et PNG détourés d'une seule couleur).">
            <span className="flex items-center gap-2">
              <input type="checkbox" checked={!!l.color} onChange={(e) => onChange({ color: e.target.checked ? "#a8956b" : "" })} className="h-4 w-4 accent-forest" aria-label="Recolorer l'image" />
              {l.color ? <input type="color" value={l.color} onChange={(e) => onChange({ color: e.target.value })} className="h-8 w-10 cursor-pointer rounded-sm border border-line" aria-label="Couleur de la teinte" /> : <span className="text-xs text-stone">couleurs d&apos;origine</span>}
            </span>
          </Field>
        ) : null}
      </fieldset>

      <fieldset className="space-y-3 border-t border-line pt-3">
        <legend className="mb-1 font-serif text-lg">Animation</legend>
        <Field label="Apparition">
          <select aria-label="Apparition" className={inputCls} value={l.enter.type} onChange={(e) => onChange({ enter: { ...l.enter, type: e.target.value as InvitationLayer["enter"]["type"] } })}>
            {ENTER_ANIMATIONS.map((a) => <option key={a} value={a}>{ENTER_ANIMATION_LABELS[a]}</option>)}
          </select>
        </Field>
        {l.enter.type !== "none" ? (
          <>
            <NumberSlider label="Délai" value={l.enter.delay / 1000} min={0} max={6} step={0.1} unit="s" onChange={(v) => onChange({ enter: { ...l.enter, delay: Math.round(v * 1000) } })} />
            <NumberSlider label="Durée" value={l.enter.duration / 1000} min={0.2} max={6} step={0.1} unit="s" onChange={(v) => onChange({ enter: { ...l.enter, duration: Math.round(v * 1000) } })} />
          </>
        ) : null}
        <Field label="Mouvement continu">
          <select aria-label="Mouvement continu" className={inputCls} value={l.loop} onChange={(e) => onChange({ loop: e.target.value as InvitationLayer["loop"] })}>
            {LOOP_ANIMATIONS.map((a) => <option key={a} value={a}>{LOOP_ANIMATION_LABELS[a]}</option>)}
          </select>
        </Field>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onReplay}>▶ Voir l&apos;animation</button>
      </fieldset>

      <div className="flex flex-wrap gap-2 border-t border-line pt-3">
        <button type="button" className="btn btn-ghost btn-sm !px-2" onClick={() => onChange({ locked: !l.locked })}>{l.locked ? "Déverrouiller" : "Verrouiller"}</button>
        <button type="button" className="btn btn-ghost btn-sm !px-2" onClick={() => onChange({ hidden: !l.hidden })}>{l.hidden ? "Afficher" : "Masquer"}</button>
        <button type="button" className="btn btn-ghost btn-sm !px-2" onClick={onCopy}>Copier</button>
        <button type="button" className="btn btn-ghost btn-sm !px-2" onClick={onDuplicate}>Dupliquer</button>
        <button type="button" className="btn btn-danger btn-sm !px-2" onClick={onDelete}>Supprimer le calque</button>
      </div>
    </div>
  );
}

/* ── Panneau d'une section ────────────────────────────────────────── */
const NOT_DUPLICABLE: InvitationSection["type"][] = ["hero", "rsvp", "countdown"];

function SectionPanel({ section: s, formHref, canDelete, onChange, onDuplicate, onDelete, onAddImage, onAddText }: {
  section: InvitationSection;
  formHref: string;
  canDelete: boolean;
  onChange: (patch: Partial<InvitationSection>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onAddImage: () => void;
  onAddText: () => void;
}) {
  const titled = !["hero", "closing", "decor"].includes(s.type);
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[0.7rem] uppercase tracking-wider text-stone">Section</p>
        <h2 className="font-serif text-2xl">{SECTION_LABELS[s.type]}</h2>
      </div>
      {titled ? (
        <Field label="Titre affiché" hint={s.type === "text" ? undefined : "Laissez vide pour le titre par défaut (traduit selon la langue)."}>
          <input aria-label="Titre affiché" className={inputCls} maxLength={80} value={s.title} onChange={(e) => onChange({ title: e.target.value })} />
        </Field>
      ) : null}
      {s.type === "text" ? (
        <Field label="Texte">
          <textarea aria-label="Texte" className="field min-h-32 text-sm" maxLength={2000} value={s.body} onChange={(e) => onChange({ body: e.target.value })} />
        </Field>
      ) : null}
      {s.type === "decor" ? (
        <NumberSlider label="Hauteur" value={s.height} min={10} max={250} unit="%" onChange={(v) => onChange({ height: v })} />
      ) : null}
      {!["text", "decor"].includes(s.type) ? (
        <p className="text-xs text-stone">
          Le contenu de cette section (dates, lieux, textes) se modifie dans le <Link href={formHref} className="text-forest underline">formulaire</Link>.
          {s.type === "rsvp" || s.type === "countdown" ? " Sa logique est verrouillée." : ""}
        </p>
      ) : null}
      <Field label="Apparition du contenu">
        <select aria-label="Apparition du contenu" className={inputCls} value={s.animation} onChange={(e) => onChange({ animation: e.target.value as InvitationSection["animation"] })}>
          <option value="inherit">Par défaut (montée douce)</option>
          {ENTER_ANIMATIONS.filter((a) => a !== "draw").map((a) => <option key={a} value={a}>{ENTER_ANIMATION_LABELS[a]}</option>)}
        </select>
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={s.visible} onChange={(e) => onChange({ visible: e.target.checked })} className="h-4 w-4 accent-forest" />
        Section visible
      </label>
      <div className="flex flex-wrap gap-2 border-t border-line pt-3">
        <button type="button" className="btn btn-secondary btn-sm" onClick={onAddImage}>+ Illustration</button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onAddText}>+ Texte libre</button>
      </div>
      <div className="flex flex-wrap gap-2 border-t border-line pt-3">
        {!NOT_DUPLICABLE.includes(s.type) ? <button type="button" className="btn btn-ghost btn-sm !px-2" onClick={onDuplicate}>Dupliquer la section</button> : null}
        <button type="button" className="btn btn-danger btn-sm !px-2" onClick={onDelete} disabled={!canDelete}>Supprimer la section</button>
      </div>
    </div>
  );
}
