/**
 * Repères magnétiques de l'éditeur : centre de la section et marges de sécurité.
 * Tout se calcule en pixels écran par rapport au cadre de la section.
 */
export type Box = { left: number; right: number; top: number; bottom: number };
export type SnapResult = { dx: number; dy: number; lines: string[] };

/** Réglages lus sur l'éditeur (repères activés, marge en % de la largeur). */
export function guideSettings(frameEl: Element | null | undefined): { on: boolean; margin: number } {
  if (!frameEl) return { on: false, margin: 0 };
  const host = frameEl.closest(".ve-guides") as HTMLElement | null;
  if (!host) return { on: false, margin: 0 };
  const m = parseFloat(getComputedStyle(host).getPropertyValue("--guide-m"));
  return { on: true, margin: Number.isFinite(m) ? m : 8 };
}

/**
 * Ajuste un déplacement (dx, dy en px) pour coller la boîte aux repères proches.
 * `frame` : boîte du cadre ; `box` : boîte de départ de ce qu'on déplace.
 */
export function snapMove(frame: DOMRect, box: Box, dx: number, dy: number, marginPct: number, threshold = 7): SnapResult {
  const m = (marginPct / 100) * frame.width;
  const lines: string[] = [];
  const pick = (cands: { line: string; diff: number }[]) => {
    let best: { line: string; diff: number } | null = null;
    for (const c of cands) if (Math.abs(c.diff) <= threshold && (!best || Math.abs(c.diff) < Math.abs(best.diff))) best = c;
    return best;
  };
  const l = box.left + dx - frame.left;
  const r = box.right + dx - frame.left;
  const t = box.top + dy - frame.top;
  const b = box.bottom + dy - frame.top;
  const sx = pick([
    { line: "cx", diff: frame.width / 2 - (l + r) / 2 },
    { line: "ml", diff: m - l },
    { line: "mr", diff: frame.width - m - r },
  ]);
  const sy = pick([
    { line: "cy", diff: frame.height / 2 - (t + b) / 2 },
    { line: "mt", diff: m - t },
    { line: "mb", diff: frame.height - m - b },
  ]);
  if (sx) {
    dx += sx.diff;
    lines.push(sx.line);
    // Centré : signale aussi les marges si la boîte les touche exactement
  }
  if (sy) {
    dy += sy.diff;
    lines.push(sy.line);
  }
  return { dx, dy, lines };
}

export function unionBox(rects: DOMRect[]): Box | null {
  if (!rects.length) return null;
  return {
    left: Math.min(...rects.map((r) => r.left)),
    right: Math.max(...rects.map((r) => r.right)),
    top: Math.min(...rects.map((r) => r.top)),
    bottom: Math.max(...rects.map((r) => r.bottom)),
  };
}

export function showSnap(frameEl: HTMLElement | null | undefined, lines: string[]) {
  if (!frameEl) return;
  if (lines.length) frameEl.dataset.snap = lines.join(" ");
  else delete frameEl.dataset.snap;
}
