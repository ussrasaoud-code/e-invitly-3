"use client";

/* eslint-disable @next/next/no-img-element */
import { createContext, useContext, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import type { InvitationLayer, InvitationSection } from "@/lib/invitation/schema";
import { AnimationContext, SectionAnimationContext } from "./Sections";

/**
 * Calques décoratifs posés sur une section : images de la bibliothèque
 * (fleurs, colombes…) et textes libres. Positions en % de la section,
 * tailles en % de la largeur de l'invitation : le rendu est identique sur
 * tous les téléphones.
 */

export type LayerEditor = {
  selected: { sectionId: string; layerId: string | null } | null;
  select: (sectionId: string, layerId: string | null) => void;
  change: (sectionId: string, layerId: string, patch: Partial<InvitationLayer>) => void;
};

/** Présent uniquement dans l'éditeur visuel */
export const LayerEditorContext = createContext<LayerEditor | null>(null);

const FONT_VAR: Record<InvitationLayer["font"], string> = {
  display: "var(--inv-display)",
  script: "var(--inv-script)",
  body: "var(--inv-body)",
};

const round = (n: number) => Math.round(n * 10) / 10;

export function SectionFrame({ section, children }: { section: InvitationSection; children: ReactNode }) {
  const editor = useContext(LayerEditorContext);
  const animate = useContext(AnimationContext);
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const layers = section.layers.filter((l) => !l.hidden || editor);

  useEffect(() => {
    const el = ref.current;
    if (!el || !layers.length) return;
    if (!animate || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [animate, layers.length]);

  const isSelectedSection = editor?.selected?.sectionId === section.id;
  const render = (placement: InvitationLayer["placement"]) =>
    layers
      .filter((l) => l.placement === placement)
      .map((l) => <LayerView key={l.id} layer={l} sectionId={section.id} frame={ref} play={inView} animate={animate} />);

  return (
    <div
      ref={ref}
      className={`inv-frame relative isolate ${editor ? "inv-frame-edit" : ""} ${isSelectedSection ? "inv-frame-selected" : ""}`}
      data-section={section.type}
      data-section-id={section.id}
      onPointerDown={editor ? (e) => {
        if (e.target === e.currentTarget || !(e.target as HTMLElement).closest("[data-layer]")) editor.select(section.id, null);
      } : undefined}
    >
      {render("behind")}
      <SectionAnimationContext.Provider value={section.animation}>{children}</SectionAnimationContext.Provider>
      {render("front")}
    </div>
  );
}

function LayerView({ layer: l, sectionId, frame, play, animate }: {
  layer: InvitationLayer;
  sectionId: string;
  frame: React.RefObject<HTMLDivElement | null>;
  play: boolean;
  animate: boolean;
}) {
  const editor = useContext(LayerEditorContext);
  const selected = editor?.selected?.layerId === l.id;
  const entering = animate && l.enter.type !== "none";

  const pos: CSSProperties = {
    left: `${l.x}%`,
    top: `${l.y}%`,
    width: `${l.width}%`,
    transform: `translate(-50%, -50%) rotate(${l.rotation}deg) scaleX(${l.flip ? -1 : 1})`,
    zIndex: l.placement === "behind" ? -1 : 2,
  };
  const enterStyle: CSSProperties = !entering
    ? {}
    : play
      ? { animation: `inv-in-${l.enter.type} ${l.enter.duration}ms cubic-bezier(.22,.61,.36,1) ${l.enter.delay}ms both` }
      : { opacity: 0 };
  const loopStyle: CSSProperties =
    animate && l.loop !== "none" ? { animation: `inv-loop-${l.loop} ${l.loop === "sway" ? 6 : l.loop === "float" ? 7 : 5}s ease-in-out ${l.enter.delay + l.enter.duration}ms infinite alternate` } : {};

  let body: ReactNode;
  if (l.kind === "text") {
    body = (
      <p
        className="m-0 whitespace-pre-line text-center leading-[1.1]"
        style={{ fontFamily: FONT_VAR[l.font], fontSize: `${l.fontSize}cqw`, color: l.color || "var(--inv-accent)", transform: l.flip ? "scaleX(-1)" : undefined }}
      >
        {l.text}
      </p>
    );
  } else if (!l.src) {
    body = editor ? <div className="flex aspect-square items-center justify-center border-2 border-dashed border-current text-[10px] opacity-60">image</div> : null;
  } else if (l.color) {
    // Silhouette teintée : la forme de l'image sert de masque
    body = (
      <span className="relative block">
        <img src={l.src} alt="" draggable={false} className="block h-auto w-full" style={{ visibility: "hidden" }} />
        <span
          className="absolute inset-0"
          style={{ backgroundColor: l.color, WebkitMaskImage: `url("${l.src}")`, maskImage: `url("${l.src}")`, WebkitMaskSize: "100% 100%", maskSize: "100% 100%", WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat" }}
        />
      </span>
    );
  } else {
    body = <img src={l.src} alt="" draggable={false} className="block h-auto w-full" />;
  }
  if (!body) return null;

  return (
    <div
      data-layer={l.id}
      className={`inv-layer absolute ${editor ? (l.locked ? "cursor-default" : "cursor-move") : "pointer-events-none"} ${selected ? "inv-layer-selected" : ""}`}
      style={pos}
      aria-hidden={l.kind === "image" ? true : undefined}
      onPointerDown={editor ? (e) => startMove(e, l, sectionId, frame, editor) : undefined}
    >
      <div style={{ ...enterStyle, opacity: enterStyle.opacity ?? undefined }}>
        <div style={{ ...loopStyle, opacity: editor && l.hidden ? 0.25 : l.opacity }}>{body}</div>
      </div>
      {editor && selected && !l.locked ? (
        <>
          <span className="inv-handle inv-handle-resize" onPointerDown={(e) => startResize(e, l, sectionId, frame, editor)} aria-hidden="true" />
          <span className="inv-handle inv-handle-rotate" onPointerDown={(e) => startRotate(e, l, sectionId, editor)} aria-hidden="true" />
        </>
      ) : null}
    </div>
  );
}

/* ── Manipulation à la souris ou au doigt (éditeur seulement) ──────── */
function drag(e: ReactPointerEvent, onMove: (ev: PointerEvent) => void) {
  e.preventDefault();
  e.stopPropagation();
  const target = e.currentTarget as HTMLElement;
  target.setPointerCapture?.(e.pointerId);
  const move = (ev: PointerEvent) => onMove(ev);
  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", up);
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", up);
}

function startMove(e: ReactPointerEvent, l: InvitationLayer, sectionId: string, frame: React.RefObject<HTMLDivElement | null>, editor: LayerEditor) {
  // Quitte le champ en cours de saisie pour que les raccourcis (Ctrl+C, flèches…) agissent sur le calque
  (document.activeElement as HTMLElement | null)?.blur?.();
  editor.select(sectionId, l.id);
  if (l.locked || e.button !== 0) {
    e.stopPropagation();
    return;
  }
  const rect = frame.current?.getBoundingClientRect();
  if (!rect) return;
  const sx = e.clientX;
  const sy = e.clientY;
  drag(e, (ev) => {
    editor.change(sectionId, l.id, {
      x: round(Math.min(160, Math.max(-60, l.x + ((ev.clientX - sx) / rect.width) * 100))),
      y: round(Math.min(160, Math.max(-60, l.y + ((ev.clientY - sy) / rect.height) * 100))),
    });
  });
}

function startResize(e: ReactPointerEvent, l: InvitationLayer, sectionId: string, frame: React.RefObject<HTMLDivElement | null>, editor: LayerEditor) {
  const rect = frame.current?.getBoundingClientRect();
  const box = (e.currentTarget as HTMLElement).parentElement?.getBoundingClientRect();
  if (!rect || !box) return;
  const cx = box.left + box.width / 2;
  const cy = box.top + box.height / 2;
  const startDist = Math.hypot(e.clientX - cx, e.clientY - cy) || 1;
  drag(e, (ev) => {
    const ratio = Math.hypot(ev.clientX - cx, ev.clientY - cy) / startDist;
    const patch: Partial<InvitationLayer> = { width: round(Math.min(220, Math.max(2, l.width * ratio))) };
    if (l.kind === "text") patch.fontSize = round(Math.min(30, Math.max(2, l.fontSize * ratio)));
    editor.change(sectionId, l.id, patch);
  });
}

function startRotate(e: ReactPointerEvent, l: InvitationLayer, sectionId: string, editor: LayerEditor) {
  const box = (e.currentTarget as HTMLElement).parentElement?.getBoundingClientRect();
  if (!box) return;
  const cx = box.left + box.width / 2;
  const cy = box.top + box.height / 2;
  drag(e, (ev) => {
    let deg = (Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180) / Math.PI + 90;
    if (deg > 180) deg -= 360;
    if (ev.shiftKey) deg = Math.round(deg / 15) * 15;
    editor.change(sectionId, l.id, { rotation: Math.round(deg) });
  });
}
