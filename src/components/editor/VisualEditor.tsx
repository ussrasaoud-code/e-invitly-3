"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { InvitationView } from "@/components/invitation/InvitationView";
import { LayerEditorContext, type LayerEditor } from "@/components/invitation/Layers";
import { MediaPicker } from "@/components/media/MediaPicker";
import { MediaUrlField } from "@/components/media/MediaUrlField";
import {
  ENTER_ANIMATIONS,
  ENTER_ANIMATION_LABELS,
  LOOP_ANIMATIONS,
  LOOP_ANIMATION_LABELS,
  REPEATABLE_SECTIONS,
  SECTION_LABELS,
  SECTION_TYPES,
  SCROLL_MOTIONS,
  SCROLL_MOTION_LABELS,
  SHAPE_LABELS,
  SHAPE_TYPES,
  STEM_LABELS,
  STEM_STYLES,
  cloneSection,
  layerSchema,
  newLayer,
  newSection,
  type ElementStyle,
  type FontKey,
  type InvitationContent,
  type InvitationContentInput,
  type InvitationLayer,
  type InvitationSection,
  type RendererKey,
} from "@/lib/invitation/schema";
import type { SaveResult } from "@/lib/save-result";
import { elementsFor, flattenElements, type ElementDef } from "@/lib/invitation/elements";
import { FONTS, FONT_GROUPS } from "@/lib/fonts";
import { ShapeSvg } from "@/components/invitation/Shape";
import { shapePresets } from "@/lib/invitation/shape-presets";
import { ColorInput, UsedColorsContext, collectColors, useRecentColors } from "./ColorInput";
import { HistoryDrawer, type HistoryApi } from "./HistoryDrawer";
import { useEditorState } from "./useEditorState";

const CLIPBOARD_KEY = "ei-layer-clipboard";
const DEFAULT_ELEMENT_STYLE: ElementStyle = {
  hidden: false, dx: 0, dy: 0, scale: 1, rotation: 0, opacity: 1, color: "", font: "", text: "", ungrouped: false,
  zoom: 1, weight: "", style: "", align: "", enter: { type: "none", delay: 0, duration: 1200 }, loop: "none",
};

type AlignMode = "left" | "center" | "right" | "top" | "middle" | "bottom" | "distribute-h" | "distribute-v";

/* Icônes d'alignement (traits = repère, rectangles = calques) */
const ALIGN_ICONS: Record<AlignMode, ReactNode> = {
  left: <><path d="M3 2v16" /><rect x="5" y="4" width="10" height="4" /><rect x="5" y="11" width="6" height="4" /></>,
  center: <><path d="M10 2v16" /><rect x="4" y="4" width="12" height="4" /><rect x="6.5" y="11" width="7" height="4" /></>,
  right: <><path d="M17 2v16" /><rect x="5" y="4" width="10" height="4" /><rect x="9" y="11" width="6" height="4" /></>,
  top: <><path d="M2 3h16" /><rect x="4" y="5" width="4" height="10" /><rect x="11" y="5" width="4" height="6" /></>,
  middle: <><path d="M2 10h16" /><rect x="4" y="4" width="4" height="12" /><rect x="11" y="6.5" width="4" height="7" /></>,
  bottom: <><path d="M2 17h16" /><rect x="4" y="5" width="4" height="10" /><rect x="11" y="9" width="4" height="6" /></>,
  "distribute-h": <><path d="M2 3v14M18 3v14" /><rect x="4.5" y="6" width="3" height="8" /><rect x="12.5" y="6" width="3" height="8" /></>,
  "distribute-v": <><path d="M3 2h14M3 18h14" /><rect x="6" y="4.5" width="8" height="3" /><rect x="6" y="12.5" width="8" height="3" /></>,
};
const ALIGN_LABELS: Record<AlignMode, string> = {
  left: "Aligner à gauche",
  center: "Centrer horizontalement",
  right: "Aligner à droite",
  top: "Aligner en haut",
  middle: "Centrer verticalement",
  bottom: "Aligner en bas",
  "distribute-h": "Répartir horizontalement",
  "distribute-v": "Répartir verticalement",
};

function AlignBar({ onAlign, distribute = false }: { onAlign: (mode: AlignMode) => void; distribute?: boolean }) {
  const modes: AlignMode[] = ["left", "center", "right", "top", "middle", "bottom", ...(distribute ? (["distribute-h", "distribute-v"] as AlignMode[]) : [])];
  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label="Alignement">
      {modes.map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onAlign(m)}
          title={ALIGN_LABELS[m]}
          aria-label={ALIGN_LABELS[m]}
          className={`flex h-9 w-9 items-center justify-center rounded-sm border border-line bg-white text-charcoal hover:border-forest hover:text-forest ${m === "top" || m === "distribute-h" ? "ml-2" : ""}`}
        >
          <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
            {ALIGN_ICONS[m]}
          </svg>
        </button>
      ))}
    </div>
  );
}

function MultiAlign({ count, onAlign }: { count: number; onAlign: (mode: AlignMode, relativeTo: "selection" | "section") => void }) {
  const [rel, setRel] = useState<"selection" | "section">("selection");
  return (
    <div className="space-y-2 border-t border-line pt-3">
      <p className="text-[0.7rem] uppercase tracking-wider text-stone">Alignement</p>
      <div className="flex gap-1 text-xs" role="radiogroup" aria-label="Aligner par rapport à">
        {(["selection", "section"] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={rel === v}
            onClick={() => setRel(v)}
            className={`rounded-full border px-3 py-1 ${rel === v ? "border-forest bg-forest text-ivory" : "border-line bg-white"}`}
          >
            {v === "selection" ? "Entre eux" : "Sur la section"}
          </button>
        ))}
      </div>
      <AlignBar onAlign={(m) => onAlign(m, rel)} distribute={count >= 3} />
      <p className="text-[0.7rem] text-stone">« Répartir » espace les calques de façon régulière (3 calques ou plus).</p>
    </div>
  );
}
const WIDTHS = [360, 390, 430] as const;
const inputCls = "field min-h-9 py-1 text-sm";

type Selection = { sectionId: string; layerId: string | null; elementId?: string | null; layerIds?: string[] } | null;

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
  l.name || (l.kind === "shape" ? SHAPE_LABELS[l.shape] : l.kind === "text" ? `« ${l.text.slice(0, 24) || "Texte"} »` : decodeURIComponent(l.src.split("/").pop() ?? "Image").replace(/^[0-9a-f]{8}-/, "").replace(/\.\w+$/, "") || "Image");

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
  headerExtra,
  history,
  publish,
  backupKey,
}: {
  /** Modèles : crée une version à partir du brouillon enregistré automatiquement */
  publish?: (content: InvitationContentInput) => Promise<SaveResult>;
  /** Identifiant de la copie de secours locale */
  backupKey?: string;
  initial: InvitationContent;
  renderer: RendererKey;
  save: (content: InvitationContentInput) => Promise<SaveResult>;
  autosave?: boolean;
  initialSavedAt: string;
  savedLabel?: string;
  title: string;
  backHref: string;
  backLabel: string;
  /** Contenu ajouté dans la barre du haut (ex. statut catalogue d'un modèle) */
  headerExtra?: ReactNode;
  /** Lien vers le formulaire classique (textes, dates, lieux) */
  formHref: string;
  /** Historique des brouillons (invitations seulement) */
  history?: HistoryApi;
}) {
  const ed = useEditorState({ initial, initialSavedAt, save, autosave, backupKey });
  const router = useRouter();
  const [publishing, setPublishing] = useState(false);
  /** Quitter l'éditeur : on enregistre d'abord ce qui reste */
  const leave = async (href: string) => {
    await ed.flush();
    router.push(href);
  };
  const { content: c, update } = ed;
  const [sel, setSel] = useState<Selection>(null);
  /** Écran d'ouverture (enveloppe ou vidéo) affiché dans le téléphone */
  const [envView, setEnvView] = useState(false);
  const [envReplay, setEnvReplay] = useState(0);
  useEffect(() => {
    if (sel) setEnvView(false);
  }, [sel]);
  const [width, setWidth] = useState<(typeof WIDTHS)[number]>(390);
  const [animate, setAnimate] = useState(false);
  const [replay, setReplay] = useState(0);
  const [picker, setPicker] = useState<null | "add" | "replace">(null);
  const [showHistory, setShowHistory] = useState(false);
  const [shapeMenu, setShapeMenu] = useState(false);
  const [clipboard, setClipboard] = useState<InvitationLayer | null>(null);
  const [notice, setNotice] = useState("");
  const canvasRef = useRef<HTMLDivElement>(null);
  const recentColors = useRecentColors();
  const usedColors = useMemo(() => collectColors(c), [c]);

  const section = sel ? c.sections.find((s) => s.id === sel.sectionId) ?? null : null;
  const layer = section && sel?.layerId ? section.layers.find((l) => l.id === sel.layerId) ?? null : null;
  const elementDefs = section ? elementsFor(section.type, renderer, c, section) : [];
  const element = section && sel?.elementId ? flattenElements(elementDefs).find((d) => d.id === sel.elementId) ?? null : null;
  /** Calques sélectionnés ensemble (Maj+clic ou groupe) */
  const multi = section && sel?.layerIds && sel.layerIds.length > 1 ? section.layers.filter((l) => sel.layerIds!.includes(l.id)) : [];

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
    const ids = multi.length ? multi.filter((l) => !l.locked).map((l) => l.id) : [layer.id];
    patchLayers(section.id, (ls) => ls.filter((l) => !ids.includes(l.id)));
    setSel({ sectionId: section.id, layerId: null });
  };
  const groupSelected = () => {
    if (!section || multi.length < 2) return;
    const gid = `g-${Math.random().toString(36).slice(2, 8)}`;
    const ids = multi.map((l) => l.id);
    patchLayers(section.id, (ls) => ls.map((l) => (ids.includes(l.id) ? { ...l, group: gid } : l)));
    flash("Calques groupés : ils se déplacent ensemble.");
  };
  const ungroupSelected = () => {
    if (!section) return;
    const ids = (multi.length ? multi : layer ? [layer] : []).map((l) => l.id);
    patchLayers(section.id, (ls) => ls.map((l) => (ids.includes(l.id) ? { ...l, group: "" } : l)));
    if (layer) setSel({ sectionId: section.id, layerId: layer.id });
    flash("Calques dégroupés.");
  };
  /**
   * Alignement des calques : mesure leur boîte réelle dans le téléphone puis
   * recalcule leur centre (x, y en % de la section). « selection » aligne sur
   * l'ensemble sélectionné, « section » sur la section entière.
   */
  const alignLayers = (mode: AlignMode, relativeTo: "selection" | "section") => {
    if (!section) return;
    const frame = canvasRef.current?.querySelector<HTMLElement>(`[data-section-id="${section.id}"]`);
    if (!frame) return;
    const f = frame.getBoundingClientRect();
    if (!f.width || !f.height) return;
    const targets = (multi.length ? multi : layer ? [layer] : []).filter((l) => !l.locked);
    const boxes = targets
      .map((l) => {
        const el = frame.querySelector<HTMLElement>(`[data-layer="${l.id}"]`);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return {
          id: l.id,
          left: ((r.left - f.left) / f.width) * 100,
          right: ((r.right - f.left) / f.width) * 100,
          top: ((r.top - f.top) / f.height) * 100,
          bottom: ((r.bottom - f.top) / f.height) * 100,
          w: (r.width / f.width) * 100,
          h: (r.height / f.height) * 100,
        };
      })
      .filter((b): b is NonNullable<typeof b> => !!b);
    if (!boxes.length) return;
    const all = relativeTo === "section" || boxes.length < 2;
    const minL = all ? 0 : Math.min(...boxes.map((b) => b.left));
    const maxR = all ? 100 : Math.max(...boxes.map((b) => b.right));
    const minT = all ? 0 : Math.min(...boxes.map((b) => b.top));
    const maxB = all ? 100 : Math.max(...boxes.map((b) => b.bottom));
    const r1 = (n: number) => Math.round(Math.min(160, Math.max(-60, n)) * 10) / 10;
    const patches: Record<string, Partial<InvitationLayer>> = {};
    if (mode === "distribute-h" || mode === "distribute-v") {
      if (boxes.length < 3) return flash("Sélectionnez au moins 3 calques pour les répartir.");
      const horiz = mode === "distribute-h";
      const sorted = [...boxes].sort((a, b) => (horiz ? a.left - b.left : a.top - b.top));
      const start = horiz ? sorted[0].left : sorted[0].top;
      const end = horiz ? Math.max(...sorted.map((b) => b.right)) : Math.max(...sorted.map((b) => b.bottom));
      const total = sorted.reduce((t, b) => t + (horiz ? b.w : b.h), 0);
      const gap = (end - start - total) / (sorted.length - 1);
      let cursor = start;
      for (const b of sorted) {
        const size = horiz ? b.w : b.h;
        patches[b.id] = horiz ? { x: r1(cursor + size / 2) } : { y: r1(cursor + size / 2) };
        cursor += size + gap;
      }
    } else {
      for (const b of boxes) {
        if (mode === "left") patches[b.id] = { x: r1(minL + b.w / 2) };
        if (mode === "center") patches[b.id] = { x: r1((minL + maxR) / 2) };
        if (mode === "right") patches[b.id] = { x: r1(maxR - b.w / 2) };
        if (mode === "top") patches[b.id] = { y: r1(minT + b.h / 2) };
        if (mode === "middle") patches[b.id] = { y: r1((minT + maxB) / 2) };
        if (mode === "bottom") patches[b.id] = { y: r1(maxB - b.h / 2) };
      }
    }
    patchLayers(section.id, (ls) => ls.map((l) => (patches[l.id] ? { ...l, ...patches[l.id] } : l)));
  };
  /* ── Éléments du modèle : lecture de leur style réel dans le téléphone ── */
  const elementNode = (sectionId: string, elementId: string) =>
    canvasRef.current?.querySelector<HTMLElement>(`[data-section-id="${sectionId}"] [data-el="${CSS.escape(elementId)}"]`) ?? null;
  const textHolder = (el: HTMLElement): HTMLElement => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.textContent?.trim()) return n.parentElement ?? el;
    return el;
  };
  const readComputed = (el: HTMLElement): ElementComputed => {
    const cs = getComputedStyle(textHolder(el));
    const family = cs.fontFamily.split(",")[0].replace(/["']/g, "").trim().toLowerCase();
    const font = (Object.keys(FONTS) as FontKey[]).find((k) => FONTS[k].stack.split(",")[0].replace(/["']/g, "").trim().toLowerCase() === family) ?? null;
    const a = cs.textAlign;
    return { font, bold: Number(cs.fontWeight) >= 600, italic: cs.fontStyle === "italic", align: a === "left" || a === "start" ? "left" : a === "right" || a === "end" ? "right" : "center" };
  };
  const [elComputed, setElComputed] = useState<ElementComputed | null>(null);
  useEffect(() => {
    if (!section || !element) return setElComputed(null);
    const t = window.setTimeout(() => {
      const el = elementNode(section.id, element.id);
      setElComputed(el ? readComputed(el) : null);
    }, 30);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section?.id, element?.id, c]);

  /** Copie un élément du modèle en texte libre (mêmes police, taille, couleur et place). */
  const duplicateElement = (convert: boolean) => {
    if (!section || !element) return;
    const el = elementNode(section.id, element.id);
    const frame = canvasRef.current?.querySelector<HTMLElement>(`[data-section-id="${section.id}"]`);
    if (!el || !frame) return;
    const f = frame.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const holder = textHolder(el);
    const cs = getComputedStyle(holder);
    const info = readComputed(el);
    const st = section.elements[element.id];
    const rgb = cs.color.match(/\d+/g)?.slice(0, 3).map(Number) ?? [0, 0, 0];
    const hex = `#${rgb.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
    const text = (el.innerText || "").replace(/\n{2,}/g, "\n").trim().slice(0, 240);
    if (!text) return flash("Cet élément ne contient pas de texte à copier.");
    const px = parseFloat(cs.fontSize) * (st?.zoom ?? 1);
    const layer = newLayer("text", {
      text,
      name: element.label,
      font: st?.font || info.font || "body",
      fontSize: Math.round(Math.min(30, Math.max(2, (px / f.width) * 100)) * 10) / 10,
      color: hex,
      bold: info.bold,
      italic: info.italic,
      align: info.align,
      x: Math.round((((r.left + r.width / 2 - f.left) / f.width) * 100 + (convert ? 0 : 4)) * 10) / 10,
      y: Math.round((((r.top + r.height / 2 - f.top) / f.height) * 100 + (convert ? 0 : 4)) * 10) / 10,
      width: Math.round(Math.min(220, Math.max(10, (r.width / f.width) * 100 + 4)) * 10) / 10,
      placement: "front",
      enter: { type: "none", delay: 0, duration: 1400 },
    });
    setSections((ss) =>
      ss.map((x) => {
        if (x.id !== section.id) return x;
        const elements = convert
          ? { ...x.elements, [element.id]: { ...(x.elements[element.id] ?? DEFAULT_ELEMENT_STYLE), hidden: true } }
          : x.elements;
        return { ...x, elements: elements as InvitationSection["elements"], layers: [...x.layers, layer] };
      }),
    );
    setSel({ sectionId: section.id, layerId: layer.id });
    flash(convert ? "Élément transformé en texte libre : tous les réglages sont disponibles." : "Copie créée en texte libre.");
  };

  const patchMany = (patch: Partial<InvitationLayer>) => {
    if (!section) return;
    const ids = multi.map((l) => l.id);
    patchLayers(section.id, (ls) => ls.map((l) => (ids.includes(l.id) ? { ...l, ...patch } : l)));
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

  const patchElement = useCallback(
    (sectionId: string, elementId: string, patch: Partial<ElementStyle>) =>
      setSections((ss) =>
        ss.map((s) => {
          if (s.id !== sectionId) return s;
          const current = s.elements[elementId] ?? DEFAULT_ELEMENT_STYLE;
          return { ...s, elements: { ...s.elements, [elementId]: { ...current, ...patch } } };
        }),
      ),
    [setSections],
  );
  const resetElement = (sectionId: string, elementId: string) =>
    setSections((ss) =>
      ss.map((s) => {
        if (s.id !== sectionId) return s;
        const rest = { ...s.elements };
        delete rest[elementId];
        return { ...s, elements: rest };
      }),
    );
  const selectElement = (sectionId: string, elementId: string) => {
    setSel({ sectionId, layerId: null, elementId });
    window.setTimeout(() => canvasRef.current?.querySelector(`[data-section-id="${sectionId}"] [data-el="${elementId}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }), 30);
  };

  const editorApi = useMemo<LayerEditor>(
    () => ({
      selected: sel,
      select: (sectionId, layerId) => setSel({ sectionId, layerId }),
      selectLayers: (sectionId, ids, primary) => setSel({ sectionId, layerId: primary, layerIds: ids }),
      change: patchLayer,
      changeLayers: (sectionId, patches) => patchLayers(sectionId, (ls) => ls.map((l) => (patches[l.id] ? { ...l, ...patches[l.id] } : l))),
      changeSection: patchSection,
      selectElement: (sectionId, elementId) => setSel({ sectionId, layerId: null, elementId }),
      changeElement: patchElement,
    }),
    [sel, patchLayer, patchLayers, patchSection, patchElement],
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
      } else if ((e.key === "Delete" || e.key === "Backspace") && element && section && element.hideable !== false) {
        e.preventDefault();
        patchElement(section.id, element.id, { hidden: true });
      } else if (e.key === "Escape") {
        setSel(null);
      } else if (element && section && e.key.startsWith("Arrow")) {
        e.preventDefault();
        const st = section.elements[element.id];
        const step = e.shiftKey ? 5 : 0.5;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        patchElement(section.id, element.id, { dx: Math.round(((st?.dx ?? 0) + dx) * 10) / 10, dy: Math.round(((st?.dy ?? 0) + dy) * 10) / 10 });
      } else if (layer && !layer.locked && section && e.key.startsWith("Arrow")) {
        e.preventDefault();
        const step = e.shiftKey ? 5 : 0.5;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        const ids = multi.length ? multi.filter((l) => !l.locked).map((l) => l.id) : [layer.id];
        patchLayers(section.id, (ls) => ls.map((l) => (ids.includes(l.id) ? { ...l, x: Math.round((l.x + dx) * 10) / 10, y: Math.round((l.y + dy) * 10) / 10 } : l)));
      } else if (mod && k === "a" && section && section.layers.length) {
        e.preventDefault();
        const ids = section.layers.filter((l) => !l.hidden).map((l) => l.id);
        if (ids.length) setSel({ sectionId: section.id, layerId: ids[0], layerIds: ids });
      } else if (mod && k === "g" && section) {
        e.preventDefault();
        if (e.shiftKey) ungroupSelected();
        else groupSelected();
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
    <UsedColorsContext.Provider value={{ used: usedColors, recent: recentColors.recent, remember: recentColors.remember }}>
    <ThemeFontsContext.Provider value={c.theme.fonts}>
    <div
      className="fixed inset-0 z-50 flex flex-col bg-[#efece5] text-charcoal"
      onClickCapture={(e) => {
        // Lien interne (retour, formulaire…) : on enregistre avant de quitter l'éditeur
        const a = (e.target as HTMLElement).closest("a");
        const href = a?.getAttribute("href");
        if (!a || !href || !href.startsWith("/") || a.target === "_blank" || e.metaKey || e.ctrlKey) return;
        if (ed.save.kind !== "dirty" && ed.save.kind !== "saving") return;
        e.preventDefault();
        e.stopPropagation();
        void leave(href);
      }}
    >
      <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-4 bg-ivory p-8 text-center lg:hidden">
        <p className="font-serif text-2xl">L&apos;éditeur visuel s&apos;utilise sur ordinateur</p>
        <p className="max-w-sm text-sm text-stone">Il a besoin d&apos;un écran d&apos;au moins 1024 pixels de large pour afficher les sections, le téléphone et les réglages côte à côte.</p>
        <Link href={backHref} className="btn btn-secondary btn-sm" onClick={(e) => { e.preventDefault(); void leave(backHref); }}>← {backLabel}</Link>
      </div>
      {/* Barre du haut */}
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-ivory px-4 py-2">
        <Link href={backHref} className="text-sm text-stone hover:text-forest" onClick={(e) => { e.preventDefault(); void leave(backHref); }}>← {backLabel}</Link>
        <h1 className="font-serif text-xl">{title}</h1>
        <p role="status" aria-live="polite" className={`text-xs ${ed.save.kind === "error" ? "text-danger" : "text-stone"}`}>
          <span aria-hidden="true" className={`mr-1.5 inline-block h-2 w-2 rounded-full ${ed.save.kind === "saved" ? "bg-success" : ed.save.kind === "error" ? "bg-danger" : "bg-warning"}`} />
          {statusText}
        </p>
        {headerExtra}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {!autosave ? (
            <button type="button" className="btn btn-primary btn-sm" onClick={ed.runSave} disabled={ed.save.kind !== "dirty" && ed.save.kind !== "error"}>
              Enregistrer une nouvelle version
            </button>
          ) : null}
          {publish ? (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={publishing}
              title="Le brouillon est enregistré automatiquement ; une version est ce que reçoivent les nouvelles invitations"
              onClick={async () => {
                setPublishing(true);
                const snapshot = c;
                const res = await publish(snapshot).catch(() => ({ ok: false as const, message: "Connexion perdue." }));
                setPublishing(false);
                if (res.ok) ed.markSaved(snapshot, res.savedAt);
                flash(res.ok ? "Nouvelle version du modèle enregistrée." : `Version non enregistrée : ${res.message}`);
              }}
            >
              {publishing ? "Enregistrement…" : "Enregistrer une nouvelle version"}
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
      {ed.recovered ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 border-b border-warning/40 bg-[#fbf3e2] px-4 py-2 text-sm">
          <span>
            Des modifications non enregistrées ont été retrouvées sur cet ordinateur (
            {new Date(ed.recovered.at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}).
          </span>
          <button type="button" className="btn btn-primary btn-sm" onClick={ed.restoreBackup}>Les récupérer</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={ed.dismissBackup}>Ignorer</button>
        </div>
      ) : null}
      {ed.save.kind === "error" ? (
        <div role="alert" className="border-b border-danger/30 bg-danger-soft px-4 py-2 text-sm text-danger">
          {ed.save.message}
          {ed.save.issues?.length ? <ul className="mt-1 list-disc pl-5 text-xs">{ed.save.issues.map((i) => <li key={i}>{i}</li>)}</ul> : null}
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-[250px_minmax(0,1fr)_300px]">
        {/* ── Colonne gauche : sections et calques ── */}
        <aside className="min-h-0 overflow-y-auto border-r border-line bg-ivory p-3" aria-label="Sections et calques">
          <button
            type="button"
            onClick={() => {
              setSel(null);
              setEnvView(true);
              setEnvReplay((r) => r + 1);
            }}
            className={`mb-3 flex w-full items-center gap-2 rounded-sm px-1.5 py-1.5 text-left text-sm ${envView ? "bg-sage-soft" : "hover:bg-paper"}`}
          >
            <span aria-hidden="true" className="text-stone">✉</span>
            Ouverture de l&apos;invitation
            <span className="ml-auto text-[0.65rem] text-stone">{c.envelope.mode === "video" ? "vidéo" : c.envelope.mode === "animation" ? "enveloppe" : "aucune"}</span>
          </button>
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
                            <li key={l.id} className={`flex items-center gap-1 rounded-sm px-1 py-0.5 ${sel?.layerId === l.id || sel?.layerIds?.includes(l.id) ? "bg-white shadow-sm" : "hover:bg-paper"}`}>
                              <button
                                type="button"
                                className={`min-w-0 flex-1 truncate text-left text-xs ${l.hidden ? "opacity-40" : ""}`}
                                title="Maj+clic pour sélectionner plusieurs calques"
                                onClick={(e) => {
                                  const cur = sel?.sectionId === s.id ? sel.layerIds ?? (sel.layerId ? [sel.layerId] : []) : [];
                                  const groupIds = l.group ? s.layers.filter((x) => x.group === l.group).map((x) => x.id) : [l.id];
                                  if (e.shiftKey) {
                                    const next = cur.includes(l.id) ? cur.filter((id) => !groupIds.includes(id)) : [...new Set([...cur, ...groupIds])];
                                    setSel(next.length ? { sectionId: s.id, layerId: next[0], layerIds: next } : { sectionId: s.id, layerId: null });
                                  } else if (groupIds.length > 1) setSel({ sectionId: s.id, layerId: l.id, layerIds: groupIds });
                                  else setSel({ sectionId: s.id, layerId: l.id });
                                }}
                              >
                                {l.group ? <span aria-hidden="true" className="mr-1 text-forest" title="Calque groupé">⛓</span> : null}
                                <span aria-hidden="true" className="mr-1 text-stone">{l.kind === "text" ? "T" : "▣"}</span>
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
                        <button type="button" className="btn btn-secondary btn-sm !px-2 !text-[0.65rem]" onClick={() => setShapeMenu(true)}>+ Forme</button>
                        {clipboard ? <button type="button" className="btn btn-ghost btn-sm !px-2 !text-[0.65rem]" onClick={pasteLayer}>Coller</button> : null}
                        {s.layers.length > 1 ? (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm !px-2 !text-[0.65rem]"
                            title="Ctrl+A"
                            onClick={() => {
                              const ids = s.layers.filter((l) => !l.hidden).map((l) => l.id);
                              if (ids.length) setSel({ sectionId: s.id, layerId: ids[0], layerIds: ids });
                            }}
                          >
                            Tout sélectionner
                          </button>
                        ) : null}
                      </div>
                      {elementsFor(s.type, renderer, c, s).length ? (
                        <>
                          <p className="mt-3 text-[0.65rem] uppercase tracking-wider text-stone">Éléments du modèle</p>
                          <ElementTree
                            defs={elementsFor(s.type, renderer, c, s)}
                            section={s}
                            selectedId={sel?.sectionId === s.id ? sel?.elementId ?? null : null}
                            onSelect={(id) => selectElement(s.id, id)}
                            onToggle={(id, hidden) => patchElement(s.id, id, { hidden })}
                          />
                        </>
                      ) : null}
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
            {envView ? (
              <div className="relative overflow-y-auto" style={{ height: Math.round(width * 2.05) }}>
                {c.envelope.mode === "none" ? (
                  <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center text-sm text-stone">
                    <p className="font-serif text-xl text-charcoal">Pas d&apos;écran d&apos;ouverture</p>
                    <p>L&apos;invitation s&apos;affiche directement. Choisissez « Enveloppe animée » ou « Vidéo » dans le panneau de droite.</p>
                  </div>
                ) : (
                  <InvitationView key={`env-${envReplay}-${c.envelope.mode}-${c.envelope.videoUrl}`} content={c} renderer={renderer} mode="preview" framed animations />
                )}
              </div>
            ) : (
              <LayerEditorContext.Provider value={editorApi}>
                <InvitationView key={`${replay}-${animate}`} content={c} renderer={renderer} mode="preview" framed skipEnvelope animations={animate} />
              </LayerEditorContext.Provider>
            )}
          </div>
          <p className="mx-auto mt-3 max-w-md text-center text-xs text-stone">
            Cliquez sur un élément, un calque ou une section pour le modifier. Glissez pour déplacer, poignée ronde du coin pour agrandir, poignée du haut pour pivoter (Maj : par pas de 15°).
          </p>
        </main>

        {/* ── Colonne droite : propriétés ── */}
        <aside className="min-h-0 overflow-y-auto border-l border-line bg-ivory p-4" aria-label="Propriétés">
          {envView ? (
            <EnvelopePanel
              content={c}
              onEnvelope={(patch) => update((x) => ({ ...x, envelope: { ...x.envelope, ...patch } }))}
              onMusic={(patch) => update((x) => ({ ...x, music: { ...x.music, ...patch } }))}
              onColors={(patch) => update((x) => ({ ...x, theme: { ...x.theme, colors: { ...x.theme.colors, ...patch } } }))}
              onReplay={() => setEnvReplay((r) => r + 1)}
            />
          ) : multi.length > 1 && section ? (
            <MultiLayerPanel
              layers={multi}
              onGroup={groupSelected}
              onUngroup={ungroupSelected}
              onPatch={patchMany}
              onDelete={deleteLayer}
              onAlign={alignLayers}
            />
          ) : element && section ? (
            <ElementPanel
              key={`${section.id}-${element.id}`}
              def={element}
              section={section}
              content={c}
              formHref={formHref}
              style={section.elements[element.id]}
              onStyle={(patch) => patchElement(section.id, element.id, patch)}
              onReset={() => resetElement(section.id, element.id)}
              onContent={(fn) => update(fn)}
              computed={elComputed}
              onDuplicate={duplicateElement}
              onReplay={() => {
                setAnimate(true);
                setReplay((r) => r + 1);
              }}
            />
          ) : layer && section ? (
            <LayerPanel
              key={layer.id}
              layer={layer}
              onChange={(patch) => patchLayer(section.id, layer.id, patch)}
              onReplace={() => setPicker("replace")}
              onDelete={deleteLayer}
              onDuplicate={duplicateLayer}
              onCopy={copyLayer}
              onMove={moveLayer}
              onAlign={(mode) => alignLayers(mode, "section")}
              onReplay={() => {
                setAnimate(true);
                setReplay((r) => r + 1);
              }}
            />
          ) : section ? (
            <SectionPanel
              section={section}
              themeColors={c.theme.colors}
              onApplyBackgroundToAll={() => {
                const bg = section.background;
                setSections((ss) => ss.map((x) => ({ ...x, background: { ...bg } })));
                flash("Fond appliqué à toutes les sections.");
              }}
              formHref={formHref}
              canDelete={c.sections.length > 1}
              onChange={(patch) => patchSection(section.id, patch)}
              onDuplicate={() => duplicateSection(section)}
              onDelete={() => deleteSection(section)}
              onAddImage={() => setPicker("add")}
              onAddText={() => addLayer(newLayer("text", { y: 30 }))}
              onAddShape={() => setShapeMenu(true)}
            />
          ) : (
            <div className="space-y-4 text-sm">
              <h2 className="font-serif text-2xl">Éditeur visuel</h2>
              <p className="text-stone">Cliquez sur n&apos;importe quel élément du téléphone (titre, prénoms, ornement, illustration) pour le modifier, le déplacer, le recolorer ou le retirer. La liste de gauche montre aussi, pour chaque section, ses calques et les éléments du modèle, même retirés.</p>
              <p className="text-stone">Sélectionnez une section pour y ajouter des fleurs, des colombes, des textures ou un texte libre.</p>
              <p className="text-stone">
                Les prénoms, la date, le programme et les lieux se modifient dans le <Link href={formHref} className="text-forest underline">formulaire</Link> : la mise en page s&apos;adapte seule.
              </p>
              <div>
                <p className="text-[0.7rem] uppercase tracking-wider text-stone">Raccourcis</p>
                <ul className="mt-1 space-y-0.5 text-xs text-stone">
                  <li>Flèches : déplacer (Maj : plus vite)</li>
                  <li>Ctrl+C / Ctrl+V : copier / coller un calque</li>
                  <li>Ctrl+D : dupliquer · Suppr : supprimer</li>
                  <li>Maj+clic : sélection multiple · Ctrl+A : tous les calques de la section</li>
                  <li>Ctrl+G / Ctrl+Maj+G : grouper / dégrouper</li>
                  <li>Ctrl+Z / Ctrl+Maj+Z : annuler / rétablir</li>
                  <li>Échap : désélectionner</li>
                </ul>
              </div>
              <Field label="Fond de l'invitation (couleur du thème)">
                <ColorInput
                  
                  value={c.theme.colors.background}
                  onChange={(e) => update((x) => ({ ...x, theme: { ...x.theme, colors: { ...x.theme.colors, background: e.target.value } } }))}
                  className="h-10 w-12 cursor-pointer rounded-sm border border-line"
                  aria-label="Fond de l'invitation"
                />
              </Field>
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

      {shapeMenu ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-charcoal/40 p-4" onClick={(e) => e.target === e.currentTarget && setShapeMenu(false)}>
          <section role="dialog" aria-modal="true" aria-label="Ajouter une forme" className="max-h-[86vh] w-[min(760px,96vw)] overflow-y-auto rounded-sm bg-ivory p-5 shadow-2xl">
            <header className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-serif text-2xl">Ajouter une forme</h2>
                <p className="text-xs text-stone">Formats prêts à l&apos;emploi aux couleurs de l&apos;invitation : tout se règle ensuite (taille, couleurs, contour, opacité).</p>
              </div>
              <button type="button" onClick={() => setShapeMenu(false)} aria-label="Fermer" className="px-2 text-xl text-stone hover:text-charcoal">×</button>
            </header>
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {shapePresets(c.theme.colors).map((p) => {
                const preview = newLayer("shape", p.patch);
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => {
                        addLayer(newLayer("shape", { y: 50, placement: "behind", ...p.patch, name: p.label }));
                        setShapeMenu(false);
                      }}
                      className="group flex w-full flex-col items-center gap-2 rounded-sm border border-line bg-white p-3 hover:border-forest"
                      style={{ "--inv-accent": c.theme.colors.accent } as React.CSSProperties}
                    >
                      <span className="flex h-20 w-full items-center justify-center">
                        <span style={{ width: `${Math.min(100, Math.max(18, preview.ratio > 1 ? 60 / preview.ratio : 70))}%` }}>
                          <ShapeSvg {...preview} />
                        </span>
                      </span>
                      <span className="text-xs group-hover:text-forest">{p.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      ) : null}
      <MediaPicker
        kinds={["image", "svg"]}
        open={picker !== null}
        title={picker === "replace" ? "Remplacer l'image" : "Ajouter une illustration"}
        onClose={() => setPicker(null)}
        onSelect={(m) => {
          if (picker === "replace" && section && layer) patchLayer(section.id, layer.id, { src: m.url, name: m.name.slice(0, 60) });
          else addLayer(newLayer("image", { src: m.url, name: m.name.slice(0, 60) }));
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
    </ThemeFontsContext.Provider>
    </UsedColorsContext.Provider>
  );
}

/* ── Panneau d'un calque ──────────────────────────────────────────── */
function LayerPanel({ layer: l, onChange, onReplace, onDelete, onDuplicate, onCopy, onMove, onReplay, onAlign }: {
  onAlign: (mode: AlignMode) => void;
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
        <h2 className="font-serif text-2xl">{l.kind === "text" ? "Texte libre" : l.kind === "shape" ? "Forme" : "Illustration"}</h2>
        <span className="text-xs text-stone">{l.locked ? "verrouillé" : ""}</span>
      </div>
      {l.kind === "shape" ? (
        <ShapeControls layer={l} onChange={onChange} />
      ) : l.kind === "image" ? (
        <div className="flex items-center gap-3">
          {l.src ? <img src={l.src} alt="" className="checker h-16 w-16 rounded-sm border border-line object-contain" /> : null}
          <button type="button" className="btn btn-secondary btn-sm" onClick={onReplace}>Changer l&apos;image</button>
        </div>
      ) : (
        <>
          <Field label="Texte">
            <textarea aria-label="Texte" className="field min-h-16 text-sm" maxLength={240} value={l.text} onChange={(e) => onChange({ text: e.target.value })} />
          </Field>
          <Field label="Police">
            <FontSelect value={l.font} onChange={(v) => onChange({ font: v as InvitationLayer["font"] })} themeOptions />
          </Field>
          <TextStyleBar bold={l.bold} italic={l.italic} align={l.align} onBold={() => onChange({ bold: !l.bold })} onItalic={() => onChange({ italic: !l.italic })} onAlign={(a) => onChange({ align: a })} />
          <div className="grid grid-cols-2 gap-2">
            <Field label="Couleur">
              <span className="flex items-center gap-2">
                <ColorInput value={l.color || "#7a6a52"} onChange={(e) => onChange({ color: e.target.value })} className="h-9 w-10 cursor-pointer rounded-sm border border-line" aria-label="Couleur du texte" />
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

      <div className="border-t border-line pt-3">
        <p className="mb-1.5 text-[0.7rem] uppercase tracking-wider text-stone">Aligner dans la section</p>
        <AlignBar onAlign={onAlign} />
      </div>
      <fieldset className="min-w-0 space-y-3 border-t border-line pt-3">
        <legend className="sr-only">Position et taille</legend>
        <div className="space-y-3">
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
              {l.color ? <ColorInput value={l.color} onChange={(e) => onChange({ color: e.target.value })} className="h-8 w-10 cursor-pointer rounded-sm border border-line" aria-label="Couleur de la teinte" /> : <span className="text-xs text-stone">couleurs d&apos;origine</span>}
            </span>
          </Field>
        ) : null}
      </fieldset>

      <fieldset className="min-w-0 space-y-3 border-t border-line pt-3">
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
        <Field label="Au défilement de l'écran">
          <select aria-label="Au défilement de l'écran" className={inputCls} value={l.scroll.type} onChange={(e) => onChange({ scroll: { ...l.scroll, type: e.target.value as InvitationLayer["scroll"]["type"], ...(e.target.value === "parallax" && l.scroll.dy === 60 ? { dy: -25 } : {}), ...(e.target.value === "rotate" && !l.scroll.amount ? { amount: 90 } : {}), ...(e.target.value === "zoom" && !l.scroll.amount ? { amount: 40 } : {}) } })}>
            {SCROLL_MOTIONS.map((m) => <option key={m} value={m}>{SCROLL_MOTION_LABELS[m]}</option>)}
          </select>
        </Field>
        {l.scroll.type === "move" ? (
          <>
            <NumberSlider label="Descente pendant le défilement" value={l.scroll.dy} min={-300} max={300} unit="%" onChange={(v) => onChange({ scroll: { ...l.scroll, dy: v } })} />
            <NumberSlider label="Glissement horizontal" value={l.scroll.dx} min={-100} max={100} unit="%" onChange={(v) => onChange({ scroll: { ...l.scroll, dx: v } })} />
            <p className="text-[0.7rem] text-stone">L&apos;élément part de sa position quand le haut de la section arrive au milieu de l&apos;écran, et termine son trajet quand le bas de la section y arrive (% de la hauteur de la section).</p>
          </>
        ) : null}
        {l.scroll.type === "parallax" ? (
          <NumberSlider label="Intensité (négatif = plus lent que la page)" value={l.scroll.dy} min={-100} max={100} unit="%" onChange={(v) => onChange({ scroll: { ...l.scroll, dy: v } })} />
        ) : null}
        {l.scroll.type === "rotate" ? (
          <NumberSlider label="Rotation pendant le défilement" value={l.scroll.amount} min={-720} max={720} step={5} unit="°" onChange={(v) => onChange({ scroll: { ...l.scroll, amount: v } })} />
        ) : null}
        {l.scroll.type === "zoom" ? (
          <NumberSlider label="Taille de départ" value={l.scroll.amount || 40} min={0} max={100} unit="%" onChange={(v) => onChange({ scroll: { ...l.scroll, amount: v } })} />
        ) : null}
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

function SectionPanel({ section: s, themeColors, onApplyBackgroundToAll, formHref, canDelete, onChange, onDuplicate, onDelete, onAddImage, onAddText, onAddShape }: {
  onAddShape: () => void;
  section: InvitationSection;
  themeColors: InvitationContent["theme"]["colors"];
  onApplyBackgroundToAll: () => void;
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
      {!["text", "decor", "program2"].includes(s.type) ? (
        <p className="text-xs text-stone">
          Le contenu de cette section (dates, lieux, textes) se modifie dans le <Link href={formHref} className="text-forest underline">formulaire</Link>.
          {s.type === "rsvp" || s.type === "countdown" ? " Sa logique est verrouillée." : ""}
        </p>
      ) : null}
      {s.type === "program2" ? <ProgramV2Editor section={s} onChange={onChange} /> : null}
      {s.type === "venues" ? <VenuesOptionsEditor section={s} themeColors={themeColors} onChange={onChange} /> : null}
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
      <fieldset className="min-w-0 space-y-3 border-t border-line pt-3">
        <legend className="mb-1 font-serif text-lg">Hauteur</legend>
        <p className="text-xs text-stone">Tirez les poignées en haut et en bas de la section dans le téléphone, ou réglez ici.</p>
        <NumberSlider label="Espace en haut" value={s.spaceTop} min={-30} max={300} unit="%" onChange={(v) => onChange({ spaceTop: v })} />
        <NumberSlider label="Espace en bas" value={s.spaceBottom} min={-30} max={300} unit="%" onChange={(v) => onChange({ spaceBottom: v })} />
      </fieldset>
      <fieldset className="min-w-0 space-y-3 border-t border-line pt-3">
        <legend className="mb-1 font-serif text-lg">Fond de la section</legend>
        <div className="flex items-center gap-3">
          <ColorInput
            
            value={s.background.color || themeColors.background}
            onChange={(e) => onChange({ background: { ...s.background, color: e.target.value } })}
            className="h-10 w-12 cursor-pointer rounded-sm border border-line"
            aria-label="Couleur du fond de la section"
          />
          <div className="text-xs text-stone">
            {s.background.color ? (
              <>
                {s.background.color.toUpperCase()} ·{" "}
                <button type="button" className="underline" onClick={() => onChange({ background: { ...s.background, color: "" } })}>couleur du thème</button>
              </>
            ) : (
              "Couleur du thème"
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5" aria-label="Couleurs du thème">
          {(["background", "surface", "accentSoft", "accent", "ink"] as const).map((k) => (
            <button
              key={k}
              type="button"
              title={themeColors[k]}
              aria-label={`Fond ${themeColors[k]}`}
              onClick={() => onChange({ background: { ...s.background, color: themeColors[k] } })}
              className="h-7 w-7 rounded-full border border-line"
              style={{ backgroundColor: themeColors[k] }}
            />
          ))}
        </div>
        <Field label="Image ou texture de fond (facultatif)">
          <MediaUrlField kinds={["image", "svg"]} className={inputCls} label="Image de fond" value={s.background.image} onChange={(v) => onChange({ background: { ...s.background, image: v } })} />
        </Field>
        {s.background.image ? (
          <>
            <Field label="Disposition">
              <select aria-label="Disposition de l'image de fond" className={inputCls} value={s.background.fit} onChange={(e) => onChange({ background: { ...s.background, fit: e.target.value as InvitationSection["background"]["fit"] } })}>
                <option value="cover">Remplir toute la section</option>
                <option value="contain">Image entière, centrée</option>
                <option value="repeat">Motif répété (texture)</option>
              </select>
            </Field>
            <NumberSlider label="Opacité de l'image" value={Math.round(s.background.opacity * 100)} min={0} max={100} unit="%" onChange={(v) => onChange({ background: { ...s.background, opacity: v / 100 } })} />
          </>
        ) : null}
        <button type="button" className="btn btn-ghost btn-sm !whitespace-normal !px-2 text-left" onClick={onApplyBackgroundToAll}>Appliquer ce fond à toutes les sections</button>
      </fieldset>
      <div className="flex flex-wrap gap-2 border-t border-line pt-3">
        <button type="button" className="btn btn-secondary btn-sm" onClick={onAddImage}>+ Illustration</button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onAddText}>+ Texte libre</button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onAddShape}>+ Forme</button>
      </div>
      <div className="flex flex-wrap gap-2 border-t border-line pt-3">
        {!NOT_DUPLICABLE.includes(s.type) ? <button type="button" className="btn btn-ghost btn-sm !px-2" onClick={onDuplicate}>Dupliquer la section</button> : null}
        <button type="button" className="btn btn-danger btn-sm !px-2" onClick={onDelete} disabled={!canDelete}>Supprimer la section</button>
      </div>
    </div>
  );
}

/* ── Liste des éléments du modèle (avec groupes) ──────────────────── */
function ElementTree({ defs, section, selectedId, onSelect, onToggle, depth = 0 }: {
  defs: ElementDef[];
  section: InvitationSection;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggle: (id: string, hidden: boolean) => void;
  depth?: number;
}) {
  return (
    <ul className={`mt-1 space-y-0.5 ${depth ? "ml-3 border-l border-line pl-1.5" : ""}`}>
      {defs.map((d) => {
        const st = section.elements[d.id];
        const hidden = !!st?.hidden;
        const open = !!d.children?.length && !!st?.ungrouped && !hidden;
        return (
          <li key={d.id}>
            <div className={`flex items-center gap-1 rounded-sm px-1 py-0.5 ${selectedId === d.id ? "bg-white shadow-sm" : "hover:bg-paper"}`}>
              <button type="button" className={`min-w-0 flex-1 truncate text-left text-xs ${hidden ? "line-through opacity-40" : ""}`} onClick={() => onSelect(d.id)}>
                <span aria-hidden="true" className="mr-1 text-stone">{d.children?.length ? (open ? "▾" : "▸") : d.kind === "ornament" ? "✿" : d.kind === "text" ? "T" : "▤"}</span>
                {d.label}
                {d.children?.length ? <span className="ml-1 text-[0.6rem] text-stone">{open ? "dégroupé" : "groupe"}</span> : null}
                {st && !hidden && !d.children?.length ? <span className="ml-1 text-[0.6rem] text-forest">modifié</span> : null}
              </button>
              {d.hideable !== false ? (
                <Btn label={hidden ? `Remettre : ${d.label}` : `Retirer : ${d.label}`} onClick={() => onToggle(d.id, !hidden)}>{hidden ? "○" : "◉"}</Btn>
              ) : null}
            </div>
            {open ? <ElementTree defs={d.children!} section={section} selectedId={selectedId} onSelect={onSelect} onToggle={onToggle} depth={depth + 1} /> : null}
          </li>
        );
      })}
    </ul>
  );
}

/** Polices du thème de l'invitation (pour afficher leur vrai nom) */
const ThemeFontsContext = createContext<InvitationContent["theme"]["fonts"] | null>(null);

/** Choix de police : polices du thème (avec leur nom) puis toutes les polices par famille */
function FontSelect({ value, onChange, themeOptions = false, label = "Police", originFont }: {
  value: string;
  onChange: (v: string) => void;
  themeOptions?: boolean;
  label?: string;
  /** Élément du modèle : police réellement utilisée quand aucune n'est imposée */
  originFont?: FontKey | null;
}) {
  const theme = useContext(ThemeFontsContext);
  const shown = value in FONTS ? (value as FontKey) : value === "" ? originFont ?? null : theme && (value === "display" || value === "script" || value === "body") ? theme[value] : null;
  const name = (k: FontKey) => FONTS[k].label.split(" — ")[0];
  return (
    <select aria-label={label} className={inputCls} value={value} onChange={(e) => onChange(e.target.value)} style={shown ? { fontFamily: FONTS[shown].stack } : undefined}>
      {themeOptions ? (
        <optgroup label="Polices du thème">
          <option value="script">{theme ? `${name(theme.script)} — manuscrite du thème` : "Manuscrite du thème"}</option>
          <option value="display">{theme ? `${name(theme.display)} — titres du thème` : "Titres du thème"}</option>
          <option value="body">{theme ? `${name(theme.body)} — texte du thème` : "Texte du thème"}</option>
        </optgroup>
      ) : (
        <option value="">{originFont ? `${name(originFont)} (police d'origine)` : "Police d'origine"}</option>
      )}
      {FONT_GROUPS.map((g) => (
        <optgroup key={g.kind} label={g.kind}>
          {g.keys.map((k) => (
            <option key={k} value={k} style={{ fontFamily: FONTS[k].stack }}>{FONTS[k].label}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

/** Gras, italique et alignement du texte */
function TextStyleBar({ bold, italic, align, onBold, onItalic, onAlign }: {
  bold: boolean;
  italic: boolean;
  align: "left" | "center" | "right";
  onBold: () => void;
  onItalic: () => void;
  onAlign: (a: "left" | "center" | "right") => void;
}) {
  const btn = (active: boolean) => `flex h-9 w-9 items-center justify-center rounded-sm border text-sm ${active ? "border-forest bg-forest text-ivory" : "border-line bg-white hover:border-forest"}`;
  const lines: Record<"left" | "center" | "right", string> = { left: "M3 5h14M3 9h9M3 13h14M3 17h9", center: "M3 5h14M5.5 9h9M3 13h14M5.5 17h9", right: "M3 5h14M8 9h9M3 13h14M8 17h9" };
  return (
    <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Style du texte">
      <button type="button" className={btn(bold)} aria-pressed={bold} aria-label="Gras" title="Gras" onClick={onBold}><b>B</b></button>
      <button type="button" className={btn(italic)} aria-pressed={italic} aria-label="Italique" title="Italique" onClick={onItalic}><i className="font-serif">I</i></button>
      <span className="mx-1 h-6 w-px bg-line" aria-hidden="true" />
      {(["left", "center", "right"] as const).map((a) => (
        <button key={a} type="button" className={btn(align === a)} aria-pressed={align === a} aria-label={a === "left" ? "Texte aligné à gauche" : a === "center" ? "Texte centré" : "Texte aligné à droite"} onClick={() => onAlign(a)}>
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d={lines[a]} /></svg>
        </button>
      ))}
    </div>
  );
}

/* ── Plusieurs calques sélectionnés ───────────────────────────────── */
function MultiLayerPanel({ layers, onGroup, onUngroup, onPatch, onDelete, onAlign }: {
  onAlign: (mode: AlignMode, relativeTo: "selection" | "section") => void;
  layers: InvitationLayer[];
  onGroup: () => void;
  onUngroup: () => void;
  onPatch: (patch: Partial<InvitationLayer>) => void;
  onDelete: () => void;
}) {
  const grouped = layers.every((l) => l.group && l.group === layers[0].group);
  const texts = layers.filter((l) => l.kind === "text");
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[0.7rem] uppercase tracking-wider text-stone">{grouped ? "Groupe" : "Sélection multiple"}</p>
        <h2 className="font-serif text-2xl">{layers.length} calques</h2>
      </div>
      <p className="text-xs text-stone">Glissez l&apos;un d&apos;eux pour les déplacer tous ensemble. Maj+clic ajoute ou retire un calque de la sélection.</p>
      <div className="flex flex-wrap gap-2">
        {grouped ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={onUngroup}>Dégrouper</button>
        ) : (
          <button type="button" className="btn btn-primary btn-sm" onClick={onGroup}>Grouper</button>
        )}
        <button type="button" className="btn btn-danger btn-sm" onClick={onDelete}>Supprimer les {layers.length} calques</button>
      </div>
      <MultiAlign count={layers.length} onAlign={onAlign} />
      {texts.length ? (
        <fieldset className="min-w-0 space-y-3 border-t border-line pt-3">
          <legend className="mb-1 text-[0.7rem] uppercase tracking-wider text-stone">Les {texts.length} texte(s)</legend>
          <Field label="Police">
            <FontSelect value={texts.every((t) => t.font === texts[0].font) ? texts[0].font : "script"} onChange={(v) => onPatch({ font: v as InvitationLayer["font"] })} themeOptions label="Police des textes sélectionnés" />
          </Field>
          <TextStyleBar
            bold={texts.every((t) => t.bold)}
            italic={texts.every((t) => t.italic)}
            align={texts.every((t) => t.align === texts[0].align) ? texts[0].align : "center"}
            onBold={() => onPatch({ bold: !texts.every((t) => t.bold) })}
            onItalic={() => onPatch({ italic: !texts.every((t) => t.italic) })}
            onAlign={(a) => onPatch({ align: a })}
          />
          <label className="flex items-center gap-2 text-xs">
            <ColorInput value={texts[0].color || "#7a6a52"} onChange={(e) => onPatch({ color: e.target.value })} className="h-8 w-10 cursor-pointer rounded-sm border border-line" aria-label="Couleur des textes sélectionnés" />
            Couleur
          </label>
        </fieldset>
      ) : null}
      <NumberSlider label="Opacité" value={Math.round((layers[0].opacity ?? 1) * 100)} min={0} max={100} unit="%" onChange={(v) => onPatch({ opacity: v / 100 })} />
    </div>
  );
}

/* ── Panneau d'un élément intégré au modèle ───────────────────────── */
export type ElementComputed = { font: FontKey | null; bold: boolean; italic: boolean; align: "left" | "center" | "right" };

function ElementPanel({ def, section, content: c, formHref, style, onStyle, onReset, onContent, computed, onDuplicate, onReplay }: {
  computed: ElementComputed | null;
  onDuplicate: (convert: boolean) => void;
  onReplay: () => void;
  def: ElementDef & { parent?: ElementDef };
  section: InvitationSection;
  content: InvitationContent;
  formHref: string;
  style: ElementStyle | undefined;
  onStyle: (patch: Partial<ElementStyle>) => void;
  onReset: () => void;
  onContent: (fn: (c: InvitationContent) => InvitationContent) => void;
}) {
  const st: ElementStyle = { ...DEFAULT_ELEMENT_STYLE, ...style };
  const isText = def.kind !== "ornament";
  const bold = st.weight ? st.weight === "bold" : !!computed?.bold;
  const italic = st.style ? st.style === "italic" : !!computed?.italic;
  const align = st.align || computed?.align || "center";
  const patchSection = (patch: Partial<InvitationSection>) =>
    onContent((x) => ({ ...x, sections: x.sections.map((s) => (s.id === section.id ? { ...s, ...patch } : s)) }));
  const isGroup = !!def.children?.length;

  const input = (label: string, value: string, set: (v: string) => void, max: number, area = false) => (
    <Field label={label}>
      {area ? (
        <textarea aria-label={label} className="field min-h-24 text-sm" maxLength={max} value={value} onChange={(e) => set(e.target.value)} />
      ) : (
        <input aria-label={label} className={inputCls} maxLength={max} value={value} onChange={(e) => set(e.target.value)} />
      )}
    </Field>
  );

  let editor: ReactNode = null;
  const ed = def.edit;
  if (typeof ed === "object") {
    if ("partner" in ed) editor = input("Texte", c.couple[ed.partner], (v) => onContent((x) => ({ ...x, couple: { ...x.couple, [ed.partner]: v } })), 60);
    else if ("venue" in ed) editor = input("Texte", c.mainVenue[ed.venue], (v) => onContent((x) => ({ ...x, mainVenue: { ...x.mainVenue, [ed.venue]: v } })), 120);
    else if ("contact" in ed) {
      const ct = c.contacts[ed.contact];
      if (ct) editor = input("Texte", ct[ed.field], (v) => onContent((x) => ({ ...x, contacts: x.contacts.map((k, i) => (i === ed.contact ? { ...k, [ed.field]: v } : k)) })), ed.field === "phone" ? 30 : 80);
    } else if ("item" in ed) {
      const it = section.items[ed.item];
      const setIt = (v: string) => patchSection({ items: section.items.map((x, i) => (i === ed.item ? { ...x, [ed.field]: v } : x)) });
      if (it) editor = input("Texte", it[ed.field], setIt, ed.field === "detail" ? 200 : ed.field === "time" ? 12 : 80, ed.field === "detail");
    } else if ("event" in ed) {
      const ev = c.events.find((e) => e.id === ed.event);
      const setEv = (v: string) => onContent((x) => ({ ...x, events: x.events.map((e) => (e.id === ed.event ? { ...e, [ed.field]: v } : e)) }));
      if (ev) {
        editor =
          ed.field === "startTime" ? (
            <Field label="Heure">
              <input aria-label="Heure" type="time" className={inputCls} value={ev.startTime} onChange={(e) => setEv(e.target.value)} />
            </Field>
          ) : (
            input("Texte", ev[ed.field], setEv, ed.field === "description" ? 400 : ed.field === "address" ? 240 : 120, ed.field === "description")
          );
      }
    }
  } else {
    switch (ed) {
      case "section-kicker":
        editor = input("Texte", section.kicker, (v) => patchSection({ kicker: v }), 120);
        break;
      case "kicker":
        editor = input("Texte", c.kicker, (v) => onContent((x) => ({ ...x, kicker: v })), 120);
        break;
      case "intro":
        editor = input("Texte", c.intro, (v) => onContent((x) => ({ ...x, intro: v })), 600, true);
        break;
      case "names":
        editor = (
          <div className="grid grid-cols-2 gap-2">
            {input("Premier prénom", c.couple.partnerOne, (v) => onContent((x) => ({ ...x, couple: { ...x.couple, partnerOne: v } })), 60)}
            {input("Second prénom", c.couple.partnerTwo, (v) => onContent((x) => ({ ...x, couple: { ...x.couple, partnerTwo: v } })), 60)}
          </div>
        );
        break;
      case "venue":
        editor = (
          <div className="grid grid-cols-2 gap-2">
            {input("Lieu", c.mainVenue.name, (v) => onContent((x) => ({ ...x, mainVenue: { ...x.mainVenue, name: v } })), 120)}
            {input("Ville", c.mainVenue.city, (v) => onContent((x) => ({ ...x, mainVenue: { ...x.mainVenue, city: v } })), 120)}
          </div>
        );
        break;
      case "section-title":
        editor = (
          <Field label="Texte" hint="Vide = titre par défaut, traduit selon la langue.">
            <input aria-label="Texte" className={inputCls} maxLength={80} value={section.title} onChange={(e) => patchSection({ title: e.target.value })} />
          </Field>
        );
        break;
      case "section-body":
        editor = input("Texte", section.body, (v) => patchSection({ body: v }), 2000, true);
        break;
      case "closing-title":
        editor = input("Texte", c.closing.title, (v) => onContent((x) => ({ ...x, closing: { ...x.closing, title: v } })), 120);
        break;
      case "closing-text":
        editor = input("Texte", c.closing.text, (v) => onContent((x) => ({ ...x, closing: { ...x.closing, text: v } })), 600, true);
        break;
      case "dresscode-text":
        editor = input("Texte", c.dressCode.text, (v) => onContent((x) => ({ ...x, dressCode: { ...x.dressCode, text: v } })), 600, true);
        break;
      case "rsvp-intro":
        editor = (
          <Field label="Texte" hint="Vide = « Merci de répondre avant le… ».">
            <textarea aria-label="Texte" className="field min-h-20 text-sm" maxLength={400} value={c.rsvp.intro} onChange={(e) => onContent((x) => ({ ...x, rsvp: { ...x.rsvp, intro: e.target.value } }))} />
          </Field>
        );
        break;
    }
  }
  if (def.literal !== undefined) {
    editor = (
      <Field label="Texte" hint={`Vide = « ${def.literal} »`}>
        <input aria-label="Texte" className={inputCls} maxLength={80} value={st.text} placeholder={def.literal} onChange={(e) => onStyle({ text: e.target.value })} />
      </Field>
    );
  }
  // Un groupe dégroupé ne bouge plus d'un bloc : seules ses parties se manipulent
  const groupOpen = isGroup && st.ungrouped;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[0.7rem] uppercase tracking-wider text-stone">
          {SECTION_LABELS[section.type]} · {def.parent ? `partie de « ${def.parent.label} »` : isGroup ? "groupe d'éléments" : "élément du modèle"}
        </p>
        <h2 className="font-serif text-2xl">{def.label}</h2>
      </div>
      {st.hidden ? <p className="rounded-sm bg-paper px-3 py-2 text-sm">Cet élément est retiré : il n&apos;apparaît pas sur l&apos;invitation.</p> : null}
      {isGroup ? (
        <div className="rounded-sm border border-line bg-white p-3 text-sm">
          {groupOpen ? (
            <>
              <p className="text-xs text-stone">Groupe dégroupé : cliquez sur chaque partie dans le téléphone (ou dans la liste) pour la modifier, la déplacer ou la retirer.</p>
              <button type="button" className="btn btn-secondary btn-sm mt-2" onClick={() => onStyle({ ungrouped: false })}>Regrouper</button>
            </>
          ) : (
            <>
              <p className="text-xs text-stone">Ce groupe contient {def.children!.length} parties ({def.children!.map((x) => x.label.toLowerCase()).join(", ")}). Dégroupez-le pour les modifier une à une.</p>
              <button type="button" className="btn btn-primary btn-sm mt-2" onClick={() => onStyle({ ungrouped: true })}>Dégrouper</button>
            </>
          )}
        </div>
      ) : null}
      {editor}
      {!editor && !isGroup && def.kind !== "ornament" ? (
        <p className="text-xs text-stone">
          Son contenu se modifie dans le <Link href={formHref} className="text-forest underline">formulaire</Link>
          {def.hideable === false ? " ; sa logique est verrouillée." : "."}
        </p>
      ) : null}
      {isText ? (
        <>
          <Field label={isGroup ? "Police de tout le groupe" : "Police"}>
            <FontSelect value={st.font} onChange={(v) => onStyle({ font: v as ElementStyle["font"] })} label={isGroup ? "Police de tout le groupe" : "Police"} originFont={computed?.font ?? null} />
          </Field>
          <TextStyleBar
            bold={bold}
            italic={italic}
            align={align}
            onBold={() => onStyle({ weight: bold ? "normal" : "bold" })}
            onItalic={() => onStyle({ style: italic ? "normal" : "italic" })}
            onAlign={(a) => onStyle({ align: a })}
          />
          <NumberSlider label="Taille du texte" value={Math.round(st.zoom * 100)} min={30} max={400} unit="%" onChange={(v) => onStyle({ zoom: v / 100 })} />
        </>
      ) : null}
      <fieldset className="min-w-0 space-y-3 border-t border-line pt-3">
        <legend className="sr-only">Apparence</legend>
        <div className="space-y-3">
          <NumberSlider label="Décalage horizontal" value={st.dx} min={-100} max={100} step={0.5} unit="%" onChange={(v) => onStyle({ dx: v })} />
          <NumberSlider label="Décalage vertical" value={st.dy} min={-300} max={300} step={0.5} unit="%" onChange={(v) => onStyle({ dy: v })} />
        </div>
        <NumberSlider label={isText ? "Échelle (sans décaler le reste)" : "Taille"} value={Math.round(st.scale * 100)} min={30} max={300} unit="%" onChange={(v) => onStyle({ scale: v / 100 })} />
        <NumberSlider label="Rotation" value={st.rotation} min={-180} max={180} unit="°" onChange={(v) => onStyle({ rotation: v })} />
        <NumberSlider label="Opacité" value={Math.round(st.opacity * 100)} min={0} max={100} unit="%" onChange={(v) => onStyle({ opacity: v / 100 })} />
        <Field label="Couleur">
          <span className="flex items-center gap-2">
            <input type="checkbox" checked={!!st.color} onChange={(e) => onStyle({ color: e.target.checked ? c.theme.colors.accent : "" })} className="h-4 w-4 accent-forest" aria-label="Imposer une couleur" />
            {st.color ? <ColorInput value={st.color} onChange={(e) => onStyle({ color: e.target.value })} className="h-8 w-10 cursor-pointer rounded-sm border border-line" aria-label="Couleur de l'élément" /> : <span className="text-xs text-stone">couleurs du thème</span>}
          </span>
        </Field>
      </fieldset>
      <fieldset className="min-w-0 space-y-3 border-t border-line pt-3">
        <legend className="mb-1 font-serif text-lg">Animation</legend>
        <Field label="Apparition">
          <select aria-label="Apparition" className={inputCls} value={st.enter.type} onChange={(e) => onStyle({ enter: { ...st.enter, type: e.target.value as ElementStyle["enter"]["type"] } })}>
            {ENTER_ANIMATIONS.map((a) => <option key={a} value={a}>{a === "none" ? "Comme la section" : ENTER_ANIMATION_LABELS[a]}</option>)}
          </select>
        </Field>
        {st.enter.type !== "none" ? (
          <>
            <NumberSlider label="Délai" value={st.enter.delay / 1000} min={0} max={6} step={0.1} unit="s" onChange={(v) => onStyle({ enter: { ...st.enter, delay: Math.round(v * 1000) } })} />
            <NumberSlider label="Durée" value={st.enter.duration / 1000} min={0.2} max={6} step={0.1} unit="s" onChange={(v) => onStyle({ enter: { ...st.enter, duration: Math.round(v * 1000) } })} />
          </>
        ) : null}
        <Field label="Mouvement continu">
          <select aria-label="Mouvement continu" className={inputCls} value={st.loop} onChange={(e) => onStyle({ loop: e.target.value as ElementStyle["loop"] })}>
            {LOOP_ANIMATIONS.map((a) => <option key={a} value={a}>{LOOP_ANIMATION_LABELS[a]}</option>)}
          </select>
        </Field>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onReplay}>▶ Voir l&apos;animation</button>
      </fieldset>
      {isText ? (
        <div className="space-y-2 border-t border-line pt-3">
          <p className="text-xs text-stone">Besoin d&apos;une copie libre de ce texte (à placer n&apos;importe où, à grouper, à aligner) ?</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => onDuplicate(false)}>Dupliquer</button>
            {def.hideable !== false ? (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => onDuplicate(true)}>Transformer en texte libre</button>
            ) : null}
          </div>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2 border-t border-line pt-3">
        {def.hideable !== false ? (
          st.hidden ? (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => onStyle({ hidden: false })}>Remettre l&apos;élément</button>
          ) : (
            <button type="button" className="btn btn-danger btn-sm" onClick={() => onStyle({ hidden: true })}>{isGroup ? "Retirer tout le groupe" : "Retirer l'élément"}</button>
          )
        ) : null}
        {style ? <button type="button" className="btn btn-ghost btn-sm !px-2" onClick={onReset}>Réglages d&apos;origine</button> : null}
      </div>
    </div>
  );
}

/* ── Panneau de l'écran d'ouverture ───────────────────────────────── */
function EnvelopePanel({ content: c, onEnvelope, onMusic, onColors, onReplay }: {
  content: InvitationContent;
  onEnvelope: (patch: Partial<InvitationContent["envelope"]>) => void;
  onMusic: (patch: Partial<InvitationContent["music"]>) => void;
  onColors: (patch: Partial<InvitationContent["theme"]["colors"]>) => void;
  onReplay: () => void;
}) {
  const env = c.envelope;
  const color = (key: keyof InvitationContent["theme"]["colors"], label: string) => (
    <label className="flex items-center gap-2 text-xs">
      <ColorInput value={c.theme.colors[key]} onChange={(e) => onColors({ [key]: e.target.value })} className="h-8 w-10 cursor-pointer rounded-sm border border-line" aria-label={label} />
      {label}
    </label>
  );
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[0.7rem] uppercase tracking-wider text-stone">Premier écran vu par les invités</p>
        <h2 className="font-serif text-2xl">Ouverture de l&apos;invitation</h2>
      </div>
      <Field label="Type d'ouverture">
        <select aria-label="Type d'ouverture" className={inputCls} value={env.mode} onChange={(e) => onEnvelope({ mode: e.target.value as InvitationContent["envelope"]["mode"] })}>
          <option value="animation">Enveloppe animée (toucher le cachet)</option>
          <option value="video">Vidéo d&apos;ouverture</option>
          <option value="none">Aucune (invitation directe)</option>
        </select>
      </Field>
      {env.mode === "animation" ? (
        <>
          <Field label="Initiales du cachet" hint="Jusqu'à 6 caractères, ex. C&E.">
            <input aria-label="Initiales du cachet" className={inputCls} maxLength={6} value={env.sealText} onChange={(e) => onEnvelope({ sealText: e.target.value })} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={env.autoStart} onChange={(e) => onEnvelope({ autoStart: e.target.checked })} className="h-4 w-4 accent-forest" />
            S&apos;ouvrir toute seule après 1 seconde
          </label>
          <fieldset className="min-w-0 space-y-2 border-t border-line pt-3">
            <legend className="mb-1 text-[0.7rem] uppercase tracking-wider text-stone">Couleurs (communes à toute l&apos;invitation)</legend>
            {color("surface", "Papier de l'enveloppe")}
            {color("background", "Fond et carte")}
            {color("accentSoft", "Liserés")}
            {color("accent", "Cachet de cire")}
          </fieldset>
        </>
      ) : null}
      {env.mode === "video" ? (
        <>
          <Field label="Vidéo (MP4)" hint="À la fin de la vidéo, l'invitation s'ouvre seule. Format conseillé : vertical 1080×1920, moins de 15 Mo.">
            <MediaUrlField kinds={["video"]} className={inputCls} label="Vidéo d'ouverture" value={env.videoUrl} onChange={(v) => onEnvelope({ videoUrl: v })} />
          </Field>
          <Field label="Image d'attente (facultatif)" hint="Affichée pendant le chargement de la vidéo.">
            <MediaUrlField kinds={["image"]} className={inputCls} label="Image d'attente" value={env.posterUrl} onChange={(v) => onEnvelope({ posterUrl: v })} />
          </Field>
          {!env.videoUrl ? <p className="text-xs text-danger">Choisissez une vidéo : sans elle, l&apos;enveloppe animée est affichée à la place.</p> : null}
        </>
      ) : null}
      <fieldset className="min-w-0 space-y-3 border-t border-line pt-3">
        <legend className="mb-1 text-[0.7rem] uppercase tracking-wider text-stone">Musique</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={c.music.enabled} onChange={(e) => onMusic({ enabled: e.target.checked })} className="h-4 w-4 accent-forest" />
          Lancer une musique à l&apos;ouverture
        </label>
        {c.music.enabled ? (
          <MediaUrlField kinds={["audio"]} className={inputCls} label="Fichier audio" value={c.music.url} onChange={(v) => onMusic({ url: v })} />
        ) : null}
      </fieldset>
      {env.mode !== "none" ? (
        <button type="button" className="btn btn-secondary btn-sm" onClick={onReplay}>▶ Rejouer l&apos;ouverture</button>
      ) : null}
      <p className="text-xs text-stone">Dans le téléphone, touchez le cachet (ou laissez la vidéo se terminer) pour voir l&apos;enchaînement avec l&apos;invitation.</p>
    </div>
  );
}

/* ── Réglages d'une forme ─────────────────────────────────────────── */
function ShapeControls({ layer: l, onChange }: { layer: InvitationLayer; onChange: (patch: Partial<InvitationLayer>) => void }) {
  return (
    <div className="space-y-3">
      <Field label="Forme">
        <select aria-label="Type de forme" className={inputCls} value={l.shape} onChange={(e) => onChange({ shape: e.target.value as InvitationLayer["shape"] })}>
          {SHAPE_TYPES.map((t) => <option key={t} value={t}>{SHAPE_LABELS[t]}</option>)}
        </select>
      </Field>
      <NumberSlider label="Hauteur (par rapport à la largeur)" value={Math.round(l.ratio * 100)} min={1} max={400} unit="%" onChange={(v) => onChange({ ratio: v / 100 })} />
      {l.shape === "rounded" ? <NumberSlider label="Arrondi des angles" value={l.radius} min={0} max={50} unit="%" onChange={(v) => onChange({ radius: v })} /> : null}
      <fieldset className="min-w-0 space-y-2 border-t border-line pt-3">
        <legend className="mb-1 text-[0.7rem] uppercase tracking-wider text-stone">Contour</legend>
        <NumberSlider label="Épaisseur du trait" value={l.strokeWidth} min={0} max={12} step={0.5} unit="px" onChange={(v) => onChange({ strokeWidth: v })} />
        {l.strokeWidth > 0 ? (
          <>
            <span className="flex items-center gap-2 text-xs">
              <ColorInput value={l.stroke || "#586c60"} onChange={(e) => onChange({ stroke: e.target.value })} className="h-8 w-10 cursor-pointer rounded-sm border border-line" aria-label="Couleur du contour" />
              {l.stroke ? <button type="button" className="underline" onClick={() => onChange({ stroke: "" })}>couleur du thème</button> : "couleur du thème"}
            </span>
            <select aria-label="Style du trait" className={inputCls} value={l.dash} onChange={(e) => onChange({ dash: e.target.value as InvitationLayer["dash"] })}>
              <option value="solid">Trait plein</option>
              <option value="dashed">Tirets</option>
              <option value="dotted">Pointillés</option>
            </select>
          </>
        ) : null}
      </fieldset>
      {l.shape !== "line" ? (
        <fieldset className="min-w-0 space-y-2 border-t border-line pt-3">
          <legend className="mb-1 text-[0.7rem] uppercase tracking-wider text-stone">Remplissage</legend>
          <span className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={!!l.fill} onChange={(e) => onChange({ fill: e.target.checked ? "#e3e8df" : "" })} className="h-4 w-4 accent-forest" aria-label="Remplir la forme" />
            {l.fill ? <ColorInput value={l.fill} onChange={(e) => onChange({ fill: e.target.value })} className="h-8 w-10 cursor-pointer rounded-sm border border-line" aria-label="Couleur de remplissage" /> : "transparent"}
          </span>
          {l.fill ? <NumberSlider label="Opacité du remplissage" value={Math.round(l.fillOpacity * 100)} min={0} max={100} unit="%" onChange={(v) => onChange({ fillOpacity: v / 100 })} /> : null}
        </fieldset>
      ) : null}
    </div>
  );
}

/* ── Programme v2 : surtitre, moments, fleur ─────────────────────── */
function ProgramV2Editor({ section: s, onChange }: { section: InvitationSection; onChange: (patch: Partial<InvitationSection>) => void }) {
  const setItem = (i: number, patch: Partial<InvitationSection["items"][number]>) => onChange({ items: s.items.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= s.items.length) return;
    const items = [...s.items];
    [items[i], items[j]] = [items[j], items[i]];
    onChange({ items });
  };
  return (
    <div className="space-y-3">
      <Field label="Surtitre">
        <input aria-label="Surtitre" className={inputCls} maxLength={120} value={s.kicker} onChange={(e) => onChange({ kicker: e.target.value })} />
      </Field>
      <fieldset className="min-w-0">
        <legend className="mb-1 block text-[0.7rem] uppercase tracking-wider text-stone">Style de la tige</legend>
        <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Style de la tige">
          {STEM_STYLES.map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={s.stem === k}
              aria-label={`Tige ${STEM_LABELS[k]}`}
              title={STEM_LABELS[k]}
              onClick={() => onChange({ stem: k })}
              className={`flex flex-col items-center gap-1 rounded-sm border bg-white px-1 pb-1 pt-2 ${s.stem === k ? "border-forest ring-2 ring-forest/30" : "border-line hover:border-forest"}`}
            >
              <span
                aria-hidden="true"
                className="block h-16 w-6"
                style={{
                  backgroundColor: "#586c60",
                  WebkitMaskImage: `url(/decor/tiges/${k}.svg)`,
                  maskImage: `url(/decor/tiges/${k}.svg)`,
                  WebkitMaskRepeat: "repeat-y",
                  maskRepeat: "repeat-y",
                  WebkitMaskSize: "100% auto",
                  maskSize: "100% auto",
                }}
              />
              <span className="text-[0.6rem] leading-tight">{STEM_LABELS[k]}</span>
            </button>
          ))}
        </div>
        <p className="mt-1 text-[0.7rem] text-stone">Sa couleur suit celle du thème ; changez-la en cliquant sur la tige dans le téléphone (« Couleur »).</p>
      </fieldset>
      <Field label="Fleur qui descend le long de la tige" hint="Elle suit le défilement de l'écran. Choisissez une autre illustration dans la bibliothèque si vous le souhaitez.">
        <MediaUrlField kinds={["image", "svg"]} className={inputCls} label="Fleur qui suit le défilement" value={s.marker} onChange={(v) => onChange({ marker: v })} />
      </Field>
      <fieldset className="min-w-0 space-y-2 border-t border-line pt-3">
        <legend className="mb-1 font-serif text-lg">Moments</legend>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-forest"
            checked={s.itemsFrom !== "custom"}
            onChange={(e) => onChange({ itemsFrom: e.target.checked ? "events" : "custom" })}
          />
          <span>
            Reprendre automatiquement le programme de l&apos;invitation
            <span className="block text-xs text-stone">
              Heures, intitulés et lieux viennent du formulaire (onglet « Informations », rempli depuis la demande du client). Décochez pour saisir des moments propres à cette section.
            </span>
          </span>
        </label>
      </fieldset>
      <fieldset className="min-w-0 space-y-2" hidden={s.itemsFrom !== "custom"}>
        <legend className="sr-only">Moments propres à la section ({s.items.length})</legend>
        {s.items.map((it, i) => (
          <div key={it.id} className="space-y-1.5 rounded-sm border border-line bg-white p-2">
            <div className="flex gap-1.5">
              <input aria-label={`Heure du moment ${i + 1}`} className={`${inputCls} w-20`} maxLength={12} value={it.time} onChange={(e) => setItem(i, { time: e.target.value })} placeholder="14h30" />
              <input aria-label={`Intitulé du moment ${i + 1}`} className={`${inputCls} min-w-0 flex-1`} maxLength={80} value={it.title} onChange={(e) => setItem(i, { title: e.target.value })} placeholder="Cérémonie" />
            </div>
            <textarea aria-label={`Détail du moment ${i + 1}`} className="field min-h-12 py-1 text-xs" maxLength={200} value={it.detail} onChange={(e) => setItem(i, { detail: e.target.value })} placeholder="Lieu, précision…" />
            <div className="flex justify-end gap-1">
              <Btn label="Monter le moment" onClick={() => move(i, -1)} disabled={i === 0}>↑</Btn>
              <Btn label="Descendre le moment" onClick={() => move(i, 1)} disabled={i === s.items.length - 1}>↓</Btn>
              <Btn label="Supprimer le moment" onClick={() => onChange({ items: s.items.filter((_, j) => j !== i) })}>✕</Btn>
            </div>
          </div>
        ))}
        {s.items.length < 20 ? (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => onChange({ items: [...s.items, { id: `m-${Math.random().toString(36).slice(2, 8)}`, time: "", title: "", detail: "" }] })}
          >
            + Ajouter un moment
          </button>
        ) : null}
      </fieldset>
    </div>
  );
}

function VenuesOptionsEditor({ section: s, themeColors, onChange }: { section: InvitationSection; themeColors: InvitationContent["theme"]["colors"]; onChange: (patch: Partial<InvitationSection>) => void }) {
  const o = s.venueOptions;
  const set = (patch: Partial<InvitationSection["venueOptions"]>) => onChange({ venueOptions: { ...o, ...patch } });
  const colors: Array<{ key: "buttonBg" | "buttonInk" | "detail"; label: string; fallback: string }> = [
    { key: "buttonBg", label: "Fond des boutons", fallback: themeColors.accent },
    { key: "buttonInk", label: "Texte et icônes des boutons", fallback: themeColors.background },
    { key: "detail", label: "Intitulés, horloge et séparateurs", fallback: themeColors.accent },
  ];
  return (
    <fieldset className="min-w-0 space-y-3 border-t border-line pt-3">
      <legend className="mb-1 font-serif text-lg">Boutons et couleurs</legend>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-0.5 h-4 w-4 accent-forest" checked={o.calendar} onChange={(e) => set({ calendar: e.target.checked })} />
        <span>
          Afficher le bouton « Calendrier »
          <span className="block text-xs text-stone">Ajoute le moment à l&apos;agenda de l&apos;invité (date de l&apos;invitation + heure du moment). Masqué automatiquement s&apos;il manque la date ou l&apos;heure.</span>
        </span>
      </label>
      {colors.map((c) => (
        <div key={c.key} className="flex items-center gap-3">
          <ColorInput value={o[c.key] || c.fallback} onChange={(e) => set({ [c.key]: e.target.value })} className="h-9 w-11 cursor-pointer rounded-sm border border-line" aria-label={c.label} />
          <div className="text-xs">
            <span className="block text-sm">{c.label}</span>
            {o[c.key] ? (
              <span className="text-stone">
                {o[c.key].toUpperCase()} · <button type="button" className="underline" onClick={() => set({ [c.key]: "" })}>couleur du thème</button>
              </span>
            ) : (
              <span className="text-stone">Couleur du thème</span>
            )}
          </div>
        </div>
      ))}
    </fieldset>
  );
}
