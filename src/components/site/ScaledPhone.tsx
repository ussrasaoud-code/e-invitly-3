"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Affiche l'invitation à la largeur d'un vrai téléphone (390 px, comme l'éditeur
 * visuel), réduite pour tenir dans le petit cadre : le rendu est identique à
 * l'éditeur et au téléphone des invités, quelle que soit la taille du cadre.
 */
export function ScaledPhone({ width = 390, children }: { width?: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    const parent = ref.current?.parentElement;
    if (!parent) return;
    const measure = () => setBox({ w: parent.clientWidth, h: parent.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(parent);
    return () => ro.disconnect();
  }, []);
  const zoom = box ? box.w / width : 1;
  return (
    <div ref={ref} style={box ? { width, height: box.h / zoom, zoom } : { width: "100%", height: "100%" }}>
      {children}
    </div>
  );
}
