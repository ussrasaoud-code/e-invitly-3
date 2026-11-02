"use client";

import { useEffect, useRef, useState } from "react";
import { LANG_COOKIE, LANG_META, localePath, type SiteLang } from "@/lib/i18n/config";
import { useLang } from "./LangContext";

/** Mémorise le choix du visiteur (1 an) : le site s'ouvrira ensuite dans cette langue. */
export function rememberLang(lang: SiteLang) {
  try {
    document.cookie = `${LANG_COOKIE}=${lang}; path=/; max-age=31536000; samesite=lax`;
  } catch {
    /* cookies bloqués : le choix vaut pour cette visite */
  }
}

/** Sélecteur « FR ▾ » : une liste des langues ouvertes, chacune écrite dans sa propre langue. */
export function LanguageSwitcher({ label, className = "" }: { label: string; className?: string }) {
  const { lang, enabled, path } = useLang();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", esc);
    };
  }, [open]);
  if (enabled.length < 2) return null;

  return (
    <div ref={box} className={`relative ${className}`}>
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`${label} : ${LANG_META[lang].native}`}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-11 items-center gap-1.5 px-2 text-[0.78rem] tracking-[0.14em] text-charcoal/80 hover:text-forest"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.3">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c2.6 2.7 2.6 15.3 0 18M12 3c-2.6 2.7-2.6 15.3 0 18" />
        </svg>
        {LANG_META[lang].short}
        <span aria-hidden="true" className="text-[0.6rem]">▾</span>
      </button>
      {open ? (
        <ul className="absolute end-0 top-full z-50 mt-1 min-w-44 border border-line bg-ivory py-1 shadow-lg">
          {enabled.map((l) => (
            <li key={l}>
              <a
                href={localePath(l, path)}
                hrefLang={l}
                lang={l}
                aria-current={l === lang ? "true" : undefined}
                onClick={() => rememberLang(l)}
                className={`flex min-h-11 items-center justify-between gap-4 px-4 text-sm hover:bg-paper ${l === lang ? "text-forest" : "text-charcoal"}`}
              >
                <span>{LANG_META[l].native}</span>
                <span className="text-[0.7rem] text-stone">{LANG_META[l].short}</span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
