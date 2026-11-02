"use client";

import { useRouter } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { LANG_META, SITE_LANGS, type SiteLang } from "@/lib/i18n/config";
import { rememberLang } from "@/components/site/LanguageSwitcher";

/** En-tête de l'espace mariés : logo, choix de la langue, déconnexion. */
export function CoupleHeader({ lang, logout, languageLabel }: { lang: SiteLang; logout: string; languageLabel: string }) {
  const router = useRouter();
  return (
    <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
      <Logo className="h-8" />
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <span className="sr-only">{languageLabel}</span>
          <svg viewBox="0 0 24 24" className="h-4 w-4 text-stone" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4">
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18M12 3c2.6 2.7 2.6 15.3 0 18M12 3c-2.6 2.7-2.6 15.3 0 18" />
          </svg>
          <select
            value={lang}
            onChange={(e) => {
              rememberLang(e.target.value as SiteLang);
              router.refresh();
            }}
            className="field min-h-9 w-auto py-1 text-sm"
          >
            {SITE_LANGS.map((l) => (
              <option key={l} value={l} lang={l}>{LANG_META[l].native}</option>
            ))}
          </select>
        </label>
        <form action="/auth/deconnexion" method="post">
          <button className="text-sm text-stone hover:text-danger">{logout}</button>
        </form>
      </div>
    </header>
  );
}
