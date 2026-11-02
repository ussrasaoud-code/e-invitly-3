"use client";

import { useEffect, useState } from "react";
import { LANG_META, localePath, suggestLang, type SiteLang } from "@/lib/i18n/config";
import { useLang } from "./LangContext";
import { rememberLang } from "./LanguageSwitcher";

type BannerTexts = Record<string, { text: string; switch: string; dismiss: string }>;
const DISMISS_KEY = "ei-lang-suggest-dismissed";

/**
 * Propose (sans jamais rediriger) la langue du téléphone ou, à défaut, celle du pays.
 * Le bandeau est écrit dans la langue proposée. Un refus est mémorisé.
 */
export function LangSuggest({ country, hasChoice, texts }: { country: string; hasChoice: boolean; texts: BannerTexts }) {
  const { lang, enabled, path } = useLang();
  const [target, setTarget] = useState<SiteLang | null>(null);

  useEffect(() => {
    if (hasChoice) return;
    try {
      if (window.localStorage.getItem(DISMISS_KEY)) return;
    } catch {
      /* stockage indisponible */
    }
    const s = suggestLang(navigator.languages?.length ? navigator.languages : [navigator.language], country || null, enabled);
    if (s && s !== lang) setTarget(s);
  }, [country, enabled, hasChoice, lang]);

  if (!target) return null;
  const t = texts[target];
  return (
    <div role="region" aria-label={LANG_META[target].native} lang={target} dir={LANG_META[target].dir} className="border-b border-line bg-paper px-5 py-2.5 text-sm">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-4 gap-y-1 text-center">
        <span>{t.text}</span>
        <a href={localePath(target, path)} onClick={() => rememberLang(target)} className="font-medium text-forest underline underline-offset-4">
          {t.switch}
        </a>
        <button
          type="button"
          className="text-stone underline-offset-4 hover:underline"
          onClick={() => {
            rememberLang(lang);
            try {
              window.localStorage.setItem(DISMISS_KEY, "1");
            } catch {
              /* ignoré */
            }
            setTarget(null);
          }}
        >
          {t.dismiss}
        </button>
      </div>
    </div>
  );
}
