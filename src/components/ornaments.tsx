/**
 * Ornements botaniques vectoriels (SVG maison, recolorables).
 * Ils servent de décors par défaut tant que les illustrations
 * personnelles n'ont pas été importées dans la bibliothèque de médias.
 */
import type { CSSProperties } from "react";

const LEAF = "M0 0 C 7 -9, 21 -11, 30 0 C 21 11, 7 9, 0 0 Z";

type OrnamentProps = {
  className?: string;
  style?: CSSProperties;
  stroke?: string;
  fill?: string;
};

/** Brin de feuillage vertical. */
export function Sprig({ className, style, stroke = "currentColor", fill = "currentColor" }: OrnamentProps) {
  const leaves = [
    { y: 168, side: -1, s: 0.9 },
    { y: 150, side: 1, s: 1 },
    { y: 128, side: -1, s: 1.05 },
    { y: 108, side: 1, s: 1 },
    { y: 88, side: -1, s: 0.95 },
    { y: 70, side: 1, s: 0.85 },
    { y: 52, side: -1, s: 0.75 },
    { y: 36, side: 1, s: 0.62 },
    { y: 22, side: -1, s: 0.5 },
  ];
  const stemX = (y: number) => 60 + Math.sin(y / 38) * 4;
  return (
    <svg viewBox="0 0 120 200" className={className} style={style} aria-hidden="true" focusable="false">
      <path
        d="M60 198 C 57 160, 66 120, 61 80 S 58 30, 62 10"
        fill="none"
        stroke={stroke}
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      {leaves.map((l) => (
        <path
          key={l.y}
          d={LEAF}
          transform={`translate(${stemX(l.y)} ${l.y}) rotate(${l.side === 1 ? -38 : 218}) scale(${l.s})`}
          fill={fill}
          fillOpacity="0.28"
          stroke={stroke}
          strokeWidth="0.8"
        />
      ))}
    </svg>
  );
}

/** Composition d'angle : deux brins croisés et une petite fleur. */
export function CornerSpray({ className, style, stroke = "currentColor", fill = "currentColor" }: OrnamentProps) {
  return (
    <svg viewBox="0 0 220 220" className={className} style={style} aria-hidden="true" focusable="false">
      <g transform="translate(18 214) rotate(58) scale(1.05)">
        <SprigPaths stroke={stroke} fill={fill} />
      </g>
      <g transform="translate(6 196) rotate(22) scale(0.82)">
        <SprigPaths stroke={stroke} fill={fill} />
      </g>
      <Blossom cx={62} cy={150} r={13} stroke={stroke} fill={fill} />
      <Blossom cx={92} cy={172} r={8} stroke={stroke} fill={fill} />
    </svg>
  );
}

function SprigPaths({ stroke, fill }: { stroke: string; fill: string }) {
  const leaves = [150, 128, 108, 88, 70, 52, 36];
  return (
    <>
      <path d="M0 0 C -3 -50, 6 -110, 2 -170" fill="none" stroke={stroke} strokeWidth="1.1" strokeLinecap="round" />
      {leaves.map((y, i) => (
        <path
          key={y}
          d={LEAF}
          transform={`translate(${2 + Math.sin(i) * 2} ${-y + 10}) rotate(${i % 2 ? -40 : 220}) scale(${1 - i * 0.06})`}
          fill={fill}
          fillOpacity="0.26"
          stroke={stroke}
          strokeWidth="0.8"
        />
      ))}
    </>
  );
}

export function Blossom({ cx, cy, r, stroke = "currentColor", fill = "currentColor" }: { cx: number; cy: number; r: number; stroke?: string; fill?: string }) {
  return (
    <g transform={`translate(${cx} ${cy})`}>
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse
          key={a}
          cx="0"
          cy={-r * 0.62}
          rx={r * 0.42}
          ry={r * 0.62}
          transform={`rotate(${a})`}
          fill={fill}
          fillOpacity="0.18"
          stroke={stroke}
          strokeWidth="0.8"
        />
      ))}
      <circle r={r * 0.18} fill={stroke} fillOpacity="0.6" />
    </g>
  );
}

/** Fine guirlande horizontale servant de séparateur. */
export function Divider({ className, stroke = "currentColor" }: { className?: string; stroke?: string }) {
  return (
    <svg viewBox="0 0 240 24" className={className} aria-hidden="true" focusable="false">
      <path d="M8 12 H 100" stroke={stroke} strokeWidth="0.8" />
      <path d="M140 12 H 232" stroke={stroke} strokeWidth="0.8" />
      <path d={LEAF} transform="translate(120 12) rotate(-150) scale(0.55)" fill="none" stroke={stroke} strokeWidth="1" />
      <path d={LEAF} transform="translate(120 12) rotate(-30) scale(0.55)" fill="none" stroke={stroke} strokeWidth="1" />
      <circle cx="120" cy="12" r="1.6" fill={stroke} />
    </svg>
  );
}

/** Arche (style Province). */
export function Arch({ className, stroke = "currentColor", fill = "none" }: OrnamentProps) {
  return (
    <svg viewBox="0 0 200 260" className={className} aria-hidden="true" focusable="false" preserveAspectRatio="none">
      <path d="M10 258 V 100 A 90 90 0 0 1 190 100 V 258" fill={fill} stroke={stroke} strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
      <path d="M20 258 V 102 A 80 80 0 0 1 180 102 V 258" fill="none" stroke={stroke} strokeWidth="0.6" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Cachet de cire avec initiales. */
export function WaxSeal({ text, color = "#8C3B33", className }: { text: string; color?: string; className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} role="img" aria-label={`Cachet de cire ${text}`}>
      <defs>
        <radialGradient id="seal-shine" cx="38%" cy="32%" r="70%">
          <stop offset="0" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.25" />
        </radialGradient>
      </defs>
      <path
        d="M60 6 C 74 4, 82 12, 92 14 C 104 18, 110 30, 112 42 C 116 54, 114 66, 112 76 C 108 92, 98 104, 84 110 C 72 116, 56 116, 44 112 C 28 108, 16 98, 10 84 C 4 70, 6 54, 8 42 C 12 26, 24 14, 38 9 C 46 6, 52 6, 60 6 Z"
        fill={color}
      />
      <path d="M60 6 C 74 4, 82 12, 92 14 C 104 18, 110 30, 112 42 C 116 54, 114 66, 112 76 C 108 92, 98 104, 84 110 C 72 116, 56 116, 44 112 C 28 108, 16 98, 10 84 C 4 70, 6 54, 8 42 C 12 26, 24 14, 38 9 C 46 6, 52 6, 60 6 Z" fill="url(#seal-shine)" />
      <circle cx="60" cy="60" r="34" fill="none" stroke="#000" strokeOpacity="0.22" strokeWidth="2" />
      <circle cx="60" cy="60" r="31" fill="none" stroke="#fff" strokeOpacity="0.18" strokeWidth="1" />
      <text
        x="60"
        y="68"
        textAnchor="middle"
        fontFamily="var(--font-script), cursive"
        fontSize={text.length > 3 ? 20 : 26}
        fill="#fff"
        fillOpacity="0.82"
      >
        {text}
      </text>
    </svg>
  );
}
