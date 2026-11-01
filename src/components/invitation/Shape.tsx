import { LEAF } from "@/components/ornaments";
import type { InvitationLayer } from "@/lib/invitation/schema";

type ShapeProps = Pick<InvitationLayer, "shape" | "ratio" | "radius" | "fill" | "fillOpacity" | "stroke" | "strokeWidth" | "dash">;

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
