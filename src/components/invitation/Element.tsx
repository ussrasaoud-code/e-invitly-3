"use client";

import { useContext, type CSSProperties, type ElementType, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import type { ElementStyle } from "@/lib/invitation/schema";
import { LayerEditorContext, SectionContext, type LayerEditor } from "./editor-context";

/**
 * Élément intégré au modèle (titre, prénoms, ornement…). En ligne : applique
 * les réglages enregistrés (masqué, décalé, recoloré…). Dans l'éditeur visuel :
 * se sélectionne d'un clic et se déplace à la souris.
 */
export function El({ id, children, className = "", style, as: Tag = "div" }: { id: string; children: ReactNode; className?: string; style?: CSSProperties; as?: ElementType }) {
  const section = useContext(SectionContext);
  const editor = useContext(LayerEditorContext);
  const st = section?.elements?.[id];
  // Élément retiré : absent de l'invitation comme de l'éditeur (il se remet depuis la liste de gauche)
  if (st?.hidden) return null;
  const selected = !!editor && editor.selected?.sectionId === section?.id && editor.selected?.elementId === id;

  const css: CSSProperties = { ...style };
  if (st) {
    const t: string[] = [];
    if (st.dx || st.dy) t.push(`translate(${st.dx}cqw, ${st.dy}cqw)`);
    if (st.rotation) t.push(`rotate(${st.rotation}deg)`);
    if (st.scale !== 1) t.push(`scale(${st.scale})`);
    if (t.length) css.transform = [style?.transform, ...t].filter(Boolean).join(" ");
    if (st.opacity !== 1) css.opacity = st.opacity;
    if (st.color) {
      Object.assign(css, { "--inv-ink": st.color, "--inv-accent": st.color, "--inv-muted": st.color, "--inv-soft": st.color });
    }
  }

  return (
    <Tag
      data-el={id}
      className={`inv-el ${className} ${selected ? "inv-el-selected" : ""} ${st?.hidden ? "inv-el-hidden" : ""}`}
      style={css}
      onPointerDown={editor && section ? (e: ReactPointerEvent<HTMLElement>) => startElementMove(e, section.id, id, st, editor) : undefined}
    >
      {children}
    </Tag>
  );
}

function startElementMove(e: ReactPointerEvent<HTMLElement>, sectionId: string, id: string, st: ElementStyle | undefined, editor: LayerEditor) {
  e.stopPropagation();
  (document.activeElement as HTMLElement | null)?.blur?.();
  editor.selectElement(sectionId, id);
  if (e.button !== 0) return;
  e.preventDefault();
  const frame = (e.currentTarget as HTMLElement).closest(".inv-frame")?.getBoundingClientRect();
  if (!frame) return;
  const sx = e.clientX;
  const sy = e.clientY;
  const dx0 = st?.dx ?? 0;
  const dy0 = st?.dy ?? 0;
  let moved = false;
  const move = (ev: PointerEvent) => {
    const ddx = ((ev.clientX - sx) / frame.width) * 100;
    const ddy = ((ev.clientY - sy) / frame.width) * 100;
    if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 3) return;
    moved = true;
    editor.changeElement(sectionId, id, {
      dx: Math.round(Math.min(100, Math.max(-100, dx0 + ddx)) * 10) / 10,
      dy: Math.round(Math.min(300, Math.max(-300, dy0 + ddy)) * 10) / 10,
    });
  };
  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", up);
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", up);
}
