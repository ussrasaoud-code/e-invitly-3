"use client";

import { createContext, useContext, type CSSProperties, type ElementType, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { FONTS } from "@/lib/fonts";
import type { ElementStyle } from "@/lib/invitation/schema";
import { LayerEditorContext, SectionContext, type LayerEditor } from "./editor-context";
export { elKey } from "@/lib/invitation/elements";

/** Élément parent le plus proche (pour les groupes : prénoms, listes…) */
const ParentElContext = createContext<{ id: string; ungrouped: boolean } | null>(null);
/** Réglages de l'élément courant (pour <ElText>) */
const ElStyleContext = createContext<ElementStyle | undefined>(undefined);

/**
 * Élément intégré au modèle (titre, prénoms, ornement…). En ligne : applique
 * les réglages enregistrés (masqué, décalé, recoloré, police…). Dans l'éditeur
 * visuel : se sélectionne d'un clic et se déplace à la souris.
 *
 * Les éléments peuvent être imbriqués (groupe → parties). Tant que le groupe
 * n'est pas dégroupé, un clic sur une partie sélectionne le groupe entier ;
 * une fois dégroupé, chaque partie se sélectionne seule.
 */
export function El({ id, children, className = "", style, as: Tag = "div" }: { id: string; children: ReactNode; className?: string; style?: CSSProperties; as?: ElementType }) {
  const section = useContext(SectionContext);
  const editor = useContext(LayerEditorContext);
  const parent = useContext(ParentElContext);
  const st = section?.elements?.[id];
  // Élément retiré : absent de l'invitation comme de l'éditeur (il se remet depuis la liste de gauche)
  if (st?.hidden) return null;

  // Interactif si ce n'est pas un groupe dégroupé et si son parent (éventuel) est dégroupé
  const interactive = !!editor && !!section && !st?.ungrouped && (!parent || parent.ungrouped);
  const selected = interactive && editor!.selected?.sectionId === section?.id && editor!.selected?.elementId === id;

  const css: CSSProperties = { ...style };
  if (st) {
    const t: string[] = [];
    if (st.dx || st.dy) t.push(`translate(${st.dx}cqw, ${st.dy}cqw)`);
    if (st.rotation) t.push(`rotate(${st.rotation}deg)`);
    if (st.scale !== 1) t.push(`scale(${st.scale})`);
    if (t.length) css.transform = [style?.transform, ...t].filter(Boolean).join(" ");
    if (st.opacity !== 1) css.opacity = st.opacity;
    if (st.color) Object.assign(css, { "--inv-ink": st.color, "--inv-accent": st.color, "--inv-muted": st.color, "--inv-soft": st.color });
    if (st.font) {
      const stack = FONTS[st.font].stack;
      Object.assign(css, { "--inv-display": stack, "--inv-script": stack, "--inv-body": stack, fontFamily: stack });
    }
  }

  return (
    <Tag
      data-el={id}
      className={`inv-el ${interactive ? "inv-el-active" : ""} ${className} ${selected ? "inv-el-selected" : ""} ${editor && st?.ungrouped ? "inv-el-ungrouped" : ""}`}
      style={css}
      onPointerDown={interactive ? (e: ReactPointerEvent<HTMLElement>) => startElementMove(e, section!.id, id, st, editor!) : undefined}
    >
      <ParentElContext.Provider value={{ id, ungrouped: !!st?.ungrouped }}>
        <ElStyleContext.Provider value={st}>{children}</ElStyleContext.Provider>
      </ParentElContext.Provider>
    </Tag>
  );
}

/** Libellé fixe remplaçable depuis l'éditeur (ex. « & ») */
export function ElText({ fallback }: { fallback: string }) {
  const st = useContext(ElStyleContext);
  return <>{st?.text || fallback}</>;
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
