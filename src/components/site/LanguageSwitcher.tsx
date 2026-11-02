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
export function LanguageSwitcher({ label, title, className = "" }: { label: string; title: string; className?: string }) {
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
    <div ref={box} className={`md:relative ${className}`}>
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`${label} : ${LANG_META[lang].native}`}
        onClick={() => setOpen((o) => !o)}
        className={`flex min-h-11 items-center gap-2 rounded-xl border px-3.5 text-[0.78rem] font-medium tracking-[0.16em] transition-colors ${
          open ? "border-forest text-forest" : "border-line bg-white/60 text-charcoal hover:border-forest hover:text-forest"
        }`}
      >
        <svg viewBox="0 0 24 24" className="h-[1.1rem] w-[1.1rem]" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c2.6 2.7 2.6 15.3 0 18M12 3c-2.6 2.7-2.6 15.3 0 18" />
        </svg>
        {LANG_META[lang].short}
      </button>
      {open ? (
        <div className="absolute inset-x-4 top-full z-50 mt-2 rounded-2xl md:inset-x-auto md:end-0 md:mt-3 md:w-[21rem] border border-line bg-paper p-5 shadow-[0_24px_60px_-20px_rgb(40_35_30/0.35)]">
          <p className="mb-3 px-1 text-[0.68rem] font-medium uppercase tracking-[0.22em] text-stone">{title}</p>
          <ul className="grid grid-cols-2 gap-1.5">
            {enabled.map((l) => (
              <li key={l}>
                <a
                  href={localePath(l, path)}
                  hrefLang={l}
                  lang={l}
                  aria-current={l === lang ? "true" : undefined}
                  onClick={() => rememberLang(l)}
                  className={`flex min-h-12 items-center rounded-xl px-4 text-[1rem] transition-colors ${
                    l === lang ? "bg-forest text-ivory" : "text-charcoal hover:bg-ivory"
                  }`}
                >
                  {LANG_META[l].native}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
