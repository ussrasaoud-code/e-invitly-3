"use client";

/* eslint-disable @next/next/no-img-element */
import { useContext, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { FONTS } from "@/lib/fonts";
import type { InvitationLayer, InvitationSection } from "@/lib/invitation/schema";
import { LayerEditorContext, SectionContext, type LayerEditor } from "./editor-context";
import { AnimationContext, SectionAnimationContext } from "./Sections";
import { ShapeSvg } from "./Shape";

/**
 * Calques décoratifs posés sur une section : images de la bibliothèque
 * (fleurs, colombes…) et textes libres. Positions en % de la section,
 * tailles en % de la largeur de l'invitation : le rendu est identique sur
 * tous les téléphones.
 */

export { LayerEditorContext, type LayerEditor } from "./editor-context";

function fontFamily(f: InvitationLayer["font"]): string {
  if (f === "display" || f === "script" || f === "body") return `var(--inv-${f})`;
  return FONTS[f].stack;
}

const round = (n: number) => Math.round(n * 10) / 10;

export function SectionFrame({ section, children }: { section: InvitationSection; children: ReactNode }) {
  const editor = useContext(LayerEditorContext);
  const animate = useContext(AnimationContext);
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const layers = section.layers.filter((l) => !l.hidden);

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

  // Progression du défilement dans la section (0 → 1), exposée en variable CSS --p
  const scrollLinked = animate && (section.type === "program2" || layers.some((l) => l.scroll && l.scroll.type !== "none"));
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!scrollLinked || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      el.style.removeProperty("--p");
      return;
    }
    const scroller = scrollParent(el);
    let raf = 0;
    const update = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const view = scroller ? scroller.getBoundingClientRect() : { top: 0, height: window.innerHeight };
      const middle = view.top + view.height * 0.5;
      const p = Math.min(1, Math.max(0, (middle - r.top) / Math.max(1, r.height)));
      el.style.setProperty("--p", p.toFixed(4));
      el.style.setProperty("--fh", `${r.height}px`);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("scroll", onScroll, { capture: true });
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [scrollLinked]);

  const isSelectedSection = editor?.selected?.sectionId === section.id;
  const render = (placement: InvitationLayer["placement"]) =>
    layers
      .filter((l) => l.placement === placement)
      .map((l) => <LayerView key={l.id} layer={l} section={section} frame={ref} play={inView} animate={animate} />);
  const sectionOnly = isSelectedSection && !editor?.selected?.layerId && !editor?.selected?.elementId;
  const pad = (v: number) => (v > 0 ? `${v}cqw` : undefined);
  const neg = (v: number) => (v < 0 ? `${v}cqw` : undefined);

  return (
    <div
      ref={ref}
      className={`inv-frame relative isolate ${editor ? "inv-frame-edit" : ""} ${isSelectedSection ? "inv-frame-selected" : ""}`}
      data-section={section.type}
      data-section-id={section.id}
      style={{ backgroundColor: section.background.color || undefined, paddingTop: pad(section.spaceTop), paddingBottom: pad(section.spaceBottom) }}
      onPointerDown={editor ? (e) => {
        const t = e.target as HTMLElement;
        if (t.closest(".inv-section-handle")) return;
        if (e.target === e.currentTarget || !t.closest("[data-layer],.inv-el-active")) editor.select(section.id, null);
      } : undefined}
    >
      {section.background.image ? (
        <div
          aria-hidden="true"
          className="inv-bg-image pointer-events-none absolute inset-0"
          style={{
            zIndex: -2,
            backgroundImage: `url("${section.background.image}")`,
            backgroundSize: section.background.fit === "repeat" ? "auto" : section.background.fit,
            backgroundRepeat: section.background.fit === "repeat" ? "repeat" : "no-repeat",
            backgroundPosition: "center",
            opacity: section.background.opacity,
          }}
        />
      ) : null}
      {render("behind")}
      <SectionContext.Provider value={section}>
        <SectionAnimationContext.Provider value={section.animation}>
          {section.spaceTop < 0 || section.spaceBottom < 0 ? (
            <div style={{ marginTop: neg(section.spaceTop), marginBottom: neg(section.spaceBottom) }}>{children}</div>
          ) : (
            children
          )}
        </SectionAnimationContext.Provider>
      </SectionContext.Provider>
      {render("front")}
      {editor && sectionOnly ? (
        <>
          <span
            className="inv-section-handle inv-section-handle-top"
            title="Tirer vers le haut pour agrandir la section"
            onPointerDown={(e) => startSpace(e, section, "spaceTop", ref, editor)}
            aria-hidden="true"
          />
          <span
            className="inv-section-handle inv-section-handle-bottom"
            title="Tirer vers le bas pour agrandir la section"
            onPointerDown={(e) => startSpace(e, section, "spaceBottom", ref, editor)}
            aria-hidden="true"
          />
        </>
      ) : null}
    </div>
  );
}

/** Poignées haut / bas : agrandir ou réduire l'espace de la section */
function startSpace(e: ReactPointerEvent, section: InvitationSection, key: "spaceTop" | "spaceBottom", frame: React.RefObject<HTMLDivElement | null>, editor: LayerEditor) {
  const rect = frame.current?.getBoundingClientRect();
  if (!rect) return;
  const sy = e.clientY;
  const start = section[key];
  drag(e, (ev) => {
    const d = ((ev.clientY - sy) / rect.width) * 100;
    const v = key === "spaceTop" ? start - d : start + d;
    editor.changeSection(section.id, { [key]: Math.round(Math.min(300, Math.max(-30, v))) });
  });
}

function LayerView({ layer: l, section, frame, play, animate }: {
  layer: InvitationLayer;
  section: InvitationSection;
  frame: React.RefObject<HTMLDivElement | null>;
  play: boolean;
  animate: boolean;
}) {
  const editor = useContext(LayerEditorContext);
  const sectionId = section.id;
  const sel = editor?.selected;
  const inMulti = !!sel && sel.sectionId === sectionId && !!sel.layerIds?.includes(l.id);
  const selected = sel?.layerId === l.id || inMulti;
  const single = sel?.layerId === l.id && (!sel?.layerIds || sel.layerIds.length <= 1);
  const entering = animate && l.enter.type !== "none";

  const pos: CSSProperties = {
    left: `${l.x}%`,
    top: `${l.y}%`,
    width: `${l.width}%`,
    transform: `translate(-50%, -50%) rotate(${l.rotation}deg) scaleX(${l.flip ? -1 : 1})`,
    zIndex: l.placement === "behind" ? -1 : 2,
    ...(animate ? scrollStyle(l.scroll) : {}),
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
        className="m-0 whitespace-pre-line leading-[1.1]"
        style={{
          fontFamily: fontFamily(l.font),
          fontSize: `${l.fontSize}cqw`,
          fontWeight: l.bold ? 700 : 400,
          fontStyle: l.italic ? "italic" : "normal",
          textAlign: l.align,
          color: l.color || "var(--inv-accent)",
          transform: l.flip ? "scaleX(-1)" : undefined,
        }}
      >
        {l.text}
      </p>
    );
  } else if (l.kind === "shape") {
    body = <ShapeSvg {...l} />;
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
      className={`inv-layer absolute ${editor ? (l.locked ? "cursor-default" : "cursor-move") : "pointer-events-none"} ${selected ? "inv-layer-selected" : ""} ${l.placement === "behind" ? "inv-layer-behind" : ""}`}
      style={pos}
      aria-hidden={l.kind !== "text" ? true : undefined}
      onPointerDown={editor ? (e) => startMove(e, l, section, frame, editor) : undefined}
    >
      <div style={{ ...enterStyle, opacity: enterStyle.opacity ?? undefined }}>
        <div style={{ ...loopStyle, opacity: l.opacity }}>{body}</div>
      </div>
      {editor && single && !l.locked ? (
        <>
          <span className="inv-handle inv-handle-resize" onPointerDown={(e) => startResize(e, l, sectionId, frame, editor)} aria-hidden="true" />
          <span className="inv-handle inv-handle-rotate" onPointerDown={(e) => startRotate(e, l, sectionId, editor)} aria-hidden="true" />
          {l.kind === "shape" ? (
            <span className="inv-handle inv-handle-height" title="Hauteur" onPointerDown={(e) => startHeight(e, l, sectionId, editor)} aria-hidden="true" />
          ) : null}
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

function startMove(e: ReactPointerEvent, l: InvitationLayer, section: InvitationSection, frame: React.RefObject<HTMLDivElement | null>, editor: LayerEditor) {
  // Quitte le champ en cours de saisie pour que les raccourcis (Ctrl+C, flèches…) agissent sur le calque
  (document.activeElement as HTMLElement | null)?.blur?.();
  const sectionId = section.id;
  const sel = editor.selected;
  const current = sel?.sectionId === sectionId ? sel.layerIds ?? (sel.layerId ? [sel.layerId] : []) : [];

  // Maj+clic : ajoute ou retire le calque (et son groupe) de la sélection
  const groupIds = l.group ? section.layers.filter((x) => x.group === l.group).map((x) => x.id) : [l.id];
  if (e.shiftKey) {
    e.stopPropagation();
    e.preventDefault();
    const has = current.includes(l.id);
    const next = has ? current.filter((id) => !groupIds.includes(id)) : [...new Set([...current, ...groupIds])];
    if (next.length) editor.selectLayers(sectionId, next, has ? next[0] : l.id);
    else editor.select(sectionId, null);
    return;
  }
  const ids = current.includes(l.id) && current.length > 1 ? current : groupIds;
  if (ids.length > 1) editor.selectLayers(sectionId, ids, l.id);
  else editor.select(sectionId, l.id);
  if (l.locked || e.button !== 0) {
    e.stopPropagation();
    return;
  }
  const rect = frame.current?.getBoundingClientRect();
  if (!rect) return;
  const sx = e.clientX;
  const sy = e.clientY;
  const starts = section.layers.filter((x) => ids.includes(x.id) && !x.locked).map((x) => ({ id: x.id, x: x.x, y: x.y }));
  drag(e, (ev) => {
    const dx = ((ev.clientX - sx) / rect.width) * 100;
    const dy = ((ev.clientY - sy) / rect.height) * 100;
    const patches: Record<string, Partial<InvitationLayer>> = {};
    for (const s of starts) {
      patches[s.id] = { x: round(Math.min(160, Math.max(-60, s.x + dx))), y: round(Math.min(160, Math.max(-60, s.y + dy))) };
    }
    editor.changeLayers(sectionId, patches);
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

/** Poignée du bas d'une forme : change sa hauteur sans changer sa largeur */
function startHeight(e: ReactPointerEvent, l: InvitationLayer, sectionId: string, editor: LayerEditor) {
  const box = (e.currentTarget as HTMLElement).parentElement?.getBoundingClientRect();
  if (!box) return;
  const w = box.width / Math.max(Math.abs(Math.cos((l.rotation * Math.PI) / 180)), 0.2);
  const h0 = w * l.ratio;
  const sy = e.clientY;
  drag(e, (ev) => {
    const h = Math.max(2, h0 + (ev.clientY - sy));
    editor.change(sectionId, l.id, { ratio: Math.round(Math.min(4, Math.max(0.01, h / w)) * 1000) / 1000 });
  });
}

/** Conteneur qui défile (l'éditeur fait défiler un panneau, l'invitation la fenêtre) */
function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY;
    if ((o === "auto" || o === "scroll") && p.scrollHeight > p.clientHeight) return p;
  }
  return null;
}

/**
 * Mouvement au défilement : propriétés individuelles (translate, rotate, scale),
 * qui s'ajoutent à la position du calque. --p vaut 0 quand le haut de la section
 * atteint le milieu de l'écran, 1 quand son bas l'atteint.
 */
function scrollStyle(sc: InvitationLayer["scroll"] | undefined): CSSProperties {
  if (!sc || sc.type === "none") return {};
  const p = "var(--p, 0)";
  switch (sc.type) {
    case "move":
      return { translate: `calc(${p} * ${sc.dx}cqw) calc(${p} * var(--fh, 0px) * ${sc.dy / 100})` };
    case "parallax":
      return { translate: `0 calc((${p} - 0.5) * var(--fh, 0px) * ${sc.dy / 100})` };
    case "rotate":
      return { rotate: `calc(${p} * ${sc.amount}deg)` };
    case "fade":
      return { opacity: `min(1, calc(${p} * 2.2))` as unknown as number };
    case "part": {
      // Rideau : couvre la section à son arrivée, puis glisse vers le côté (dx) en s'agrandissant un peu.
      const span = Math.max(10, sc.amount || 45) / 100;
      const q = `min(1, calc(${p} / ${span}))`;
      return { translate: `calc(${q} * ${sc.dx}cqw) 0`, scale: `calc(1 + ${q} * 0.12)` };
    }
    case "zoom": {
      const from = Math.max(0, sc.amount || 40) / 100;
      return { scale: `calc(${from} + (1 - ${from}) * min(1, ${p} * 1.8))` };
    }
  }
}
