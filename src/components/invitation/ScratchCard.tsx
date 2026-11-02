"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Carte à gratter : une pellicule (canvas) recouvre le contenu ; on la gratte
 * au doigt ou à la souris. Au-delà de ~50 % grattés, elle s'efface d'elle-même.
 * Clavier / lecteurs d'écran : Entrée ou Espace révèle directement.
 */
export function ScratchCard({
  children,
  cover,
  label,
  revealLabel,
  disabled = false,
  onReveal,
}: {
  children: ReactNode;
  cover: string;
  label: string;
  revealLabel: string;
  disabled?: boolean;
  onReveal?: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [revealed, setRevealed] = useState(false);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const strokes = useRef(0);
  const ratio = useRef(1);

  const paint = useCallback(() => {
    const c = canvas.current;
    const b = box.current;
    if (!c || !b) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    ratio.current = dpr;
    const w = b.clientWidth;
    const h = b.clientHeight;
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = cover;
    ctx.fillRect(0, 0, w, h);
    // Reflet nacré + fines stries, comme une vraie pellicule
    const g = ctx.createRadialGradient(w * 0.35, h * 0.25, 2, w * 0.35, h * 0.25, Math.max(w, h));
    g.addColorStop(0, "rgba(255,255,255,0.55)");
    g.addColorStop(0.45, "rgba(255,255,255,0.12)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 1;
    for (let x = -h; x < w; x += 7) {
      ctx.beginPath();
      ctx.moveTo(x, h);
      ctx.lineTo(x + h * 0.6, 0);
      ctx.stroke();
    }
  }, [cover]);

  useEffect(() => {
    if (revealed) return;
    paint();
    const b = box.current;
    if (!b) return;
    const ro = new ResizeObserver(() => paint());
    ro.observe(b);
    return () => ro.disconnect();
  }, [paint, revealed]);

  const reveal = useCallback(() => {
    setRevealed((r) => {
      if (!r) onReveal?.();
      return true;
    });
  }, [onReveal]);

  const scratchAt = (clientX: number, clientY: number) => {
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const r = c.getBoundingClientRect();
    // Le cadre peut être réduit (zoom CSS) : on ramène aux coordonnées du canvas
    const sx = c.width / ratio.current / r.width;
    const x = (clientX - r.left) * sx;
    const y = (clientY - r.top) * sx;
    const radius = Math.max(14, Math.min(26, (r.width * sx) / 5));
    ctx.globalCompositeOperation = "destination-out";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = radius * 2;
    ctx.beginPath();
    const from = last.current ?? { x, y };
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(x + 0.01, y);
    ctx.stroke();
    last.current = { x, y };
    if (++strokes.current % 6 === 0) checkCleared();
  };

  const checkCleared = () => {
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx || !c.width || !c.height) return;
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    let clear = 0;
    let total = 0;
    for (let i = 3; i < data.length; i += 4 * 16) {
      total++;
      if (data[i] < 40) clear++;
    }
    if (total && clear / total > 0.5) reveal();
  };

  return (
    <div ref={box} className="relative h-full w-full">
      {children}
      <canvas
        ref={canvas}
        role="button"
        tabIndex={disabled || revealed ? -1 : 0}
        aria-label={`${revealLabel} : ${label}`}
        aria-hidden={revealed}
        className={`absolute inset-0 h-full w-full rounded-[inherit] transition-opacity duration-700 ${revealed ? "pointer-events-none opacity-0" : "cursor-grab"}`}
        style={{ touchAction: disabled ? undefined : "none" }}
        onPointerDown={
          disabled
            ? undefined
            : (e) => {
                drawing.current = true;
                last.current = null;
                (e.currentTarget as HTMLCanvasElement).setPointerCapture?.(e.pointerId);
                scratchAt(e.clientX, e.clientY);
              }
        }
        onPointerMove={disabled ? undefined : (e) => drawing.current && scratchAt(e.clientX, e.clientY)}
        onPointerUp={
          disabled
            ? undefined
            : () => {
                drawing.current = false;
                last.current = null;
                checkCleared();
              }
        }
        onPointerCancel={() => {
          drawing.current = false;
          last.current = null;
        }}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            reveal();
          }
        }}
      />
    </div>
  );
}
