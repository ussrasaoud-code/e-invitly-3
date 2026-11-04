import { LANG_META } from "@/lib/i18n/config";
import type { Language } from "@/lib/invitation/schema";

/**
 * Choix de la langue d'une invitation bilingue : deux pastilles discrètes en haut,
 * qui restent sur le même lien (le lien privé d'un groupe est conservé).
 */
export function LangSwitch({ langs, current, hrefFor, top = "0.75rem" }: { langs: Language[]; current: Language; hrefFor: (l: Language) => string; top?: string }) {
  if (langs.length < 2) return null;
  return (
    <nav
      aria-label="Language · Langue · اللغة"
      className="fixed end-3 z-[70] flex gap-1 rounded-full border border-white/60 bg-ivory/85 p-1 text-[0.72rem] shadow-sm backdrop-blur"
      style={{ top }}
      dir="ltr"
    >
      {langs.map((l) => (
        <a
          key={l}
          href={hrefFor(l)}
          hrefLang={l}
          lang={l}
          aria-current={l === current ? "true" : undefined}
          className={`rounded-full px-3 py-1 tracking-wide transition-colors ${l === current ? "bg-charcoal text-ivory" : "text-charcoal hover:bg-paper"}`}
        >
          {LANG_META[l].native}
        </a>
      ))}
    </nav>
  );
}
