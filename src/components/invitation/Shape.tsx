import { LEAF } from "@/components/ornaments";
import type { InvitationLayer } from "@/lib/invitation/schema";

type ShapeProps = Pick<InvitationLayer, "shape" | "ratio" | "radius" | "fill" | "fillOpacity" | "stroke" | "strokeWidth" | "dash">;

/**
 * Cadre ornemental (étiquette ancienne) dans la boîte x0,y0 → x1,y1 :
 * angles creusés (rayon c), bosses au milieu des côtés (hauteur b), angles en escalier.
 */
function framePath(kind: "cartouche" | "etiquette" | "plaque" | "festonne", x0: number, y0: number, x1: number, y1: number, c: number, b: number): string {
  const w = x1 - x0;
  const h = y1 - y0;
  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2;
  const f = (n: number) => Math.round(n * 100) / 100;
  if (kind === "festonne") {
    // Bords en petites vagues régulières
    const n = Math.max(6, Math.round(w / 7));
    const sx = w / n;
    const m = Math.max(2, Math.round(h / sx));
    const sy = h / m;
    const r = Math.min(sx, sy) / 2;
    let d = `M${f(x0)} ${f(y0)}`;
    for (let i = 0; i < n; i++) d += ` A${f(sx / 2)} ${f(r)} 0 0 1 ${f(x0 + (i + 1) * sx)} ${f(y0)}`;
    for (let i = 0; i < m; i++) d += ` A${f(r)} ${f(sy / 2)} 0 0 1 ${f(x1)} ${f(y0 + (i + 1) * sy)}`;
    for (let i = 0; i < n; i++) d += ` A${f(sx / 2)} ${f(r)} 0 0 1 ${f(x1 - (i + 1) * sx)} ${f(y1)}`;
    for (let i = 0; i < m; i++) d += ` A${f(r)} ${f(sy / 2)} 0 0 1 ${f(x0)} ${f(y1 - (i + 1) * sy)}`;
    return d + " Z";
  }
  if (kind === "plaque") {
    // Angles en escalier (deux marches)
    const s1 = c * 0.55;
    return [
      `M${f(x0 + c)} ${f(y0)}`, `H${f(x1 - c)}`, `V${f(y0 + s1)}`, `H${f(x1 - s1)}`, `V${f(y0 + c)}`, `H${f(x1)}`,
      `V${f(y1 - c)}`, `H${f(x1 - s1)}`, `V${f(y1 - s1)}`, `H${f(x1 - c)}`, `V${f(y1)}`,
      `H${f(x0 + c)}`, `V${f(y1 - s1)}`, `H${f(x0 + s1)}`, `V${f(y1 - c)}`, `H${f(x0)}`,
      `V${f(y0 + c)}`, `H${f(x0 + s1)}`, `V${f(y0 + s1)}`, `H${f(x0 + c)}`, "Z",
    ].join(" ");
  }
  const bulge = kind === "cartouche";
  const bw = Math.min(w * 0.16, 22);
  const bh = Math.min(h * 0.22, 12);
  let d = `M${f(x0 + c)} ${f(y0)}`;
  if (bulge) d += ` H${f(mx - bw)} C${f(mx - bw * 0.45)} ${f(y0)} ${f(mx - bw * 0.4)} ${f(y0 - b)} ${f(mx)} ${f(y0 - b)} C${f(mx + bw * 0.4)} ${f(y0 - b)} ${f(mx + bw * 0.45)} ${f(y0)} ${f(mx + bw)} ${f(y0)}`;
  d += ` H${f(x1 - c)} A${f(c)} ${f(c)} 0 0 0 ${f(x1)} ${f(y0 + c)}`;
  if (bulge) d += ` V${f(my - bh)} C${f(x1)} ${f(my - bh * 0.45)} ${f(x1 + b)} ${f(my - bh * 0.4)} ${f(x1 + b)} ${f(my)} C${f(x1 + b)} ${f(my + bh * 0.4)} ${f(x1)} ${f(my + bh * 0.45)} ${f(x1)} ${f(my + bh)}`;
  d += ` V${f(y1 - c)} A${f(c)} ${f(c)} 0 0 0 ${f(x1 - c)} ${f(y1)}`;
  if (bulge) d += ` H${f(mx + bw)} C${f(mx + bw * 0.45)} ${f(y1)} ${f(mx + bw * 0.4)} ${f(y1 + b)} ${f(mx)} ${f(y1 + b)} C${f(mx - bw * 0.4)} ${f(y1 + b)} ${f(mx - bw * 0.45)} ${f(y1)} ${f(mx - bw)} ${f(y1)}`;
  d += ` H${f(x0 + c)} A${f(c)} ${f(c)} 0 0 0 ${f(x0)} ${f(y1 - c)}`;
  if (bulge) d += ` V${f(my + bh)} C${f(x0)} ${f(my + bh * 0.45)} ${f(x0 - b)} ${f(my + bh * 0.4)} ${f(x0 - b)} ${f(my)} C${f(x0 - b)} ${f(my - bh * 0.4)} ${f(x0)} ${f(my - bh * 0.45)} ${f(x0)} ${f(my - bh)}`;
  d += ` V${f(y0 + c)} A${f(c)} ${f(c)} 0 0 0 ${f(x0 + c)} ${f(y0)} Z`;
  return d;
}

/**
 * Forme vectorielle (cadre, cercle, arche…). Le contour garde la même épaisseur
 * quelle que soit la taille de la forme (vector-effect: non-scaling-stroke).
 */
export function ShapeSvg({ shape, ratio, radius, fill, fillOpacity, stroke, strokeWidth, dash, className = "" }: ShapeProps & { className?: string }) {
  const H = Math.round(100 * ratio * 100) / 100;
  const sw = strokeWidth;
  const common = {
    fill: fill || "none",
    fillOpacity,
    stroke: sw > 0 ? stroke || "var(--inv-accent)" : "none",
    strokeWidth: sw,
    strokeDasharray: dash === "dashed" ? `${sw * 4} ${sw * 3}` : dash === "dotted" ? `0 ${sw * 2.4}` : undefined,
    strokeLinecap: dash === "dotted" ? ("round" as const) : ("butt" as const),
    vectorEffect: "non-scaling-stroke" as const,
  };
  let body: React.ReactNode;
  switch (shape) {
    case "rect":
      body = <rect x="0" y="0" width="100" height={H} {...common} />;
      break;
    case "rounded": {
      const r = (Math.min(100, H) * radius) / 100;
      body = <rect x="0" y="0" width="100" height={H} rx={r} ry={r} {...common} />;
      break;
    }
    case "circle":
      body = <ellipse cx="50" cy={H / 2} rx="50" ry={H / 2} {...common} />;
      break;
    case "arch": {
      const top = Math.min(50, H);
      body = <path d={`M0 ${H} L0 ${top} A50 ${top} 0 0 1 100 ${top} L100 ${H} Z`} {...common} />;
      break;
    }
    case "double": {
      const g = Math.min(4, H / 6);
      body = (
        <>
          <rect x="0" y="0" width="100" height={H} {...common} />
          <rect x={g} y={g} width={100 - 2 * g} height={H - 2 * g} {...common} fill="none" />
        </>
      );
      break;
    }
    case "line":
      body = <line x1="0" y1={H / 2} x2="100" y2={H / 2} {...common} />;
      break;
    case "diamond":
      body = <polygon points={`50,0 100,${H / 2} 50,${H} 0,${H / 2}`} {...common} />;
      break;
    case "heart": {
      const k = H / 100;
      body = (
        <path
          d={`M50 ${92 * k} C ${20 * 1} ${70 * k} 0 ${50 * k} 0 ${30 * k} C 0 ${12 * k} 14 0 28 0 C 40 0 47 ${8 * k} 50 ${16 * k} C 53 ${8 * k} 60 0 72 0 C 86 0 100 ${12 * k} 100 ${30 * k} C 100 ${50 * k} 80 ${70 * k} 50 ${92 * k} Z`}
          {...common}
        />
      );
      break;
    }
    case "cartouche":
    case "etiquette":
    case "plaque":
    case "festonne": {
      // Cadre ornemental + filet intérieur (comme une étiquette ancienne)
      const b = shape === "cartouche" ? Math.min(5, H * 0.12) : 0;
      const c = Math.min(9, H * 0.22);
      const g = Math.min(3.2, H * 0.08);
      const outer = framePath(shape, b, b, 100 - b, H - b, c, b);
      const inner = shape === "festonne" ? null : framePath(shape, b + g, b + g, 100 - b - g, H - b - g, Math.max(1, c - g * 0.4), b * 0.7);
      body = (
        <>
          <path d={outer} {...common} />
          {inner ? <path d={inner} {...common} fill="none" strokeWidth={Math.max(0.5, sw * 0.7)} /> : null}
        </>
      );
      break;
    }
    case "leafdivider":
    case "diamonddivider": {
      // Deux traits et un motif central, dessinés dans un cadre 240 × 24 centré
      const line = { stroke: common.stroke, strokeWidth: sw, vectorEffect: common.vectorEffect, strokeDasharray: common.strokeDasharray, strokeLinecap: common.strokeLinecap };
      const motif = { fill: fill || "none", fillOpacity, stroke: common.stroke, strokeWidth: sw, vectorEffect: common.vectorEffect };
      body = (
        <svg x="0" y="0" width="100" height={H} viewBox="0 0 240 24" preserveAspectRatio="xMidYMid meet" overflow="visible">
          <path d="M8 12 H 100" {...line} fill="none" />
          <path d="M140 12 H 232" {...line} fill="none" />
          {shape === "leafdivider" ? (
            <>
              <path d={LEAF} transform="translate(120 12) rotate(-150) scale(0.55)" {...motif} />
              <path d={LEAF} transform="translate(120 12) rotate(-30) scale(0.55)" {...motif} />
              <circle cx="120" cy="12" r="1.6" fill={stroke || "var(--inv-accent)"} />
            </>
          ) : (
            <>
              <polygon points="120,5 127,12 120,19 113,12" {...motif} />
              <circle cx="106" cy="12" r="1.3" fill={stroke || "var(--inv-accent)"} />
              <circle cx="134" cy="12" r="1.3" fill={stroke || "var(--inv-accent)"} />
            </>
          )}
        </svg>
      );
      break;
    }
  }
  return (
    <svg viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" className={`block w-full overflow-visible ${className}`} style={{ aspectRatio: `100 / ${H}` }} aria-hidden="true">
      {body}
    </svg>
  );
}
