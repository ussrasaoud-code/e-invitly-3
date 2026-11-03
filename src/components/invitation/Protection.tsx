"use client";

import { useEffect, useState, type ReactNode } from "react";
import { DOVE_PNG, DOVE_SIZE } from "./watermark-dove";

/**
 * Filigrane répété en diagonale, par-dessus toute l'invitation (y compris l'enveloppe).
 * Il ne gêne ni le défilement ni les clics (pointer-events: none).
 */
export function Watermark({ text }: { text: string }) {
  const label = (text || "APERÇU · E-INVITLY").slice(0, 40);
  const esc = label.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
  // Tuile 320×280 : le texte en diagonale et, en quinconce, la colombe de la marque
  const dw = 64;
  const dh = Math.round((DOVE_SIZE.h / DOVE_SIZE.w) * dw);
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' width='320' height='280'><text x='110' y='90' text-anchor='middle' dominant-baseline='middle' transform='rotate(-30 110 90)' font-family='Georgia, serif' font-size='17' letter-spacing='3' fill='rgba(60,50,40,0.17)'>${esc}</text><image x='${250 - dw / 2}' y='${215 - dh / 2}' width='${dw}' height='${dh}' href='${DOVE_PNG}' xlink:href='${DOVE_PNG}'/></svg>`;
  return (
    <div
      aria-hidden="true"
      data-watermark
      className="pointer-events-none fixed inset-0 z-[80] print:hidden"
      style={{ backgroundImage: `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`, backgroundRepeat: "repeat" }}
    />
  );
}

/**
 * Gêne la copie (sans pouvoir l'empêcher totalement : aucun site ne peut bloquer
 * la capture d'écran d'un téléphone) : clic droit, sélection, glisser des images,
 * raccourcis d'enregistrement et d'impression, flou quand la page perd le focus.
 */
export function CopyGuard({ children, message }: { children: ReactNode; message: string }) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const block = (e: Event) => e.preventDefault();
    const keys = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && ["s", "p", "u"].includes(k)) e.preventDefault();
      if (k === "printscreen") {
        setHidden(true);
        navigator.clipboard?.writeText?.("").catch(() => {});
        window.setTimeout(() => setHidden(false), 1500);
      }
    };
    const blur = () => setHidden(true);
    const focus = () => setHidden(false);
    const vis = () => setHidden(document.visibilityState === "hidden");
    document.addEventListener("contextmenu", block);
    document.addEventListener("dragstart", block);
    document.addEventListener("copy", block);
    document.addEventListener("keydown", keys);
    document.addEventListener("keyup", keys);
    document.addEventListener("visibilitychange", vis);
    window.addEventListener("blur", blur);
    window.addEventListener("focus", focus);
    return () => {
      document.removeEventListener("contextmenu", block);
      document.removeEventListener("dragstart", block);
      document.removeEventListener("copy", block);
      document.removeEventListener("keydown", keys);
      document.removeEventListener("keyup", keys);
      document.removeEventListener("visibilitychange", vis);
      window.removeEventListener("blur", blur);
      window.removeEventListener("focus", focus);
    };
  }, []);
  return (
    <div className="inv-guard">
      <style>{`.inv-guard, .inv-guard * { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
.inv-guard input, .inv-guard textarea, .inv-guard select { -webkit-user-select: text; user-select: text; }
@media print { .inv-guard { display: none !important; } body::after { content: "${message.replace(/"/g, "'")}"; display: block; padding: 4rem; font: 16px Georgia, serif; text-align: center; } }`}</style>
      <div style={{ filter: hidden ? "blur(18px)" : undefined, transition: "filter .15s" }}>{children}</div>
    </div>
  );
}
