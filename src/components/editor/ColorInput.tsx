"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";

const RECENT_KEY = "ei-recent-colors";

/** Couleurs proposées : celles déjà utilisées dans l'invitation, puis les dernières choisies. */
export const UsedColorsContext = createContext<{ palette?: string[]; used: string[]; recent: string[]; remember: (c: string) => void }>({
  palette: [],
  used: [],
  recent: [],
  remember: () => {},
});

/** Toutes les couleurs #RRGGBB présentes dans le contenu (thème, calques, fonds…). */
export function collectColors(content: unknown): string[] {
  const found = JSON.stringify(content).match(/#[0-9a-fA-F]{6}\b/g) ?? [];
  return [...new Set(found.map((c) => c.toLowerCase()))];
}

export function useRecentColors() {
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(RECENT_KEY);
      const list = raw ? (JSON.parse(raw) as unknown) : [];
      if (Array.isArray(list)) setRecent(list.filter((c): c is string => typeof c === "string" && /^#[0-9a-f]{6}$/.test(c)).slice(0, 16));
    } catch {
      /* stockage indisponible : la liste reste vide */
    }
  }, []);
  const remember = (c: string) => {
    const color = c.toLowerCase();
    if (!/^#[0-9a-f]{6}$/.test(color)) return;
    setRecent((prev) => {
      const next = [color, ...prev.filter((x) => x !== color)].slice(0, 16);
      try {
        window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {
        /* ignoré */
      }
      return next;
    });
  };
  return { recent, remember };
}

/**
 * Pastille de couleur : un clic ouvre les couleurs déjà utilisées dans
 * l'invitation, les dernières choisies, un code #RRGGBB et le sélecteur complet.
 * Même interface qu'un <input type="color">.
 */
export function ColorInput({
  value,
  onChange,
  className = "",
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (e: { target: { value: string } }) => void;
  className?: string;
  "aria-label"?: string;
}) {
  const { palette = [], used: allUsed, recent, remember } = useContext(UsedColorsContext);
  const mine = palette.map((c) => c.toLowerCase());
  const used = allUsed.filter((c) => !mine.includes(c));
  const [open, setOpen] = useState(false);
  const [hex, setHex] = useState(value);
  const box = useRef<HTMLSpanElement>(null);
  useEffect(() => setHex(value), [value]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", esc);
    };
  }, [open]);

  const pick = (c: string) => {
    onChange({ target: { value: c } });
    remember(c);
  };
  const recentOnly = recent.filter((c) => !used.includes(c) && !mine.includes(c));

  return (
    <span ref={box} className="relative inline-block">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        title={value}
        onClick={() => setOpen((o) => !o)}
        className={`block cursor-pointer rounded-sm border border-line p-0.5 ${className || "h-9 w-10"}`}
      >
        <span className="block h-full w-full rounded-[2px]" style={{ backgroundColor: value }} />
      </button>
      {open ? (
        <span role="dialog" aria-label="Choisir une couleur" className="absolute left-0 top-full z-[70] mt-1 block w-60 rounded-sm border border-line bg-white p-3 shadow-xl">
          {mine.length ? (
            <>
              <span className="mb-1 block text-[0.65rem] uppercase tracking-wider text-stone">Palette du modèle</span>
              <Swatches colors={mine} current={value} onPick={pick} />
            </>
          ) : null}
          {used.length ? (
            <>
              <span className={`mb-1 block text-[0.65rem] uppercase tracking-wider text-stone ${mine.length ? "mt-2" : ""}`}>Autres couleurs de l&apos;invitation</span>
              <Swatches colors={used} current={value} onPick={pick} />
            </>
          ) : null}
          {recentOnly.length ? (
            <>
              <span className="mb-1 mt-2 block text-[0.65rem] uppercase tracking-wider text-stone">Utilisées récemment</span>
              <Swatches colors={recentOnly} current={value} onPick={pick} />
            </>
          ) : null}
          <span className="mt-3 flex items-center gap-2">
            <input
              type="color"
              value={value}
              onChange={(e) => onChange({ target: { value: e.target.value } })}
              onBlur={(e) => remember(e.target.value)}
              className="h-8 w-10 cursor-pointer rounded-sm border border-line"
              aria-label="Autre couleur"
            />
            <input
              value={hex}
              onChange={(e) => {
                setHex(e.target.value);
                const v = e.target.value.trim();
                if (/^#[0-9a-fA-F]{6}$/.test(v)) pick(v.toLowerCase());
              }}
              maxLength={7}
              aria-label="Code couleur"
              className="field min-h-8 w-24 px-2 py-0.5 font-mono text-xs"
            />
          </span>
        </span>
      ) : null}
    </span>
  );
}

function Swatches({ colors, current, onPick }: { colors: string[]; current: string; onPick: (c: string) => void }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          title={c}
          aria-label={`Couleur ${c}`}
          onClick={() => onPick(c)}
          className={`h-6 w-6 rounded-full border ${c === current.toLowerCase() ? "border-forest ring-2 ring-forest/40" : "border-line"}`}
          style={{ backgroundColor: c }}
        />
      ))}
    </span>
  );
}
