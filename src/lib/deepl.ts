import "server-only";
import type { Language } from "@/lib/invitation/schema";

/** Codes DeepL (langue cible ; l'anglais cible demande une variante) */
const TARGET: Record<Language, string> = { fr: "FR", en: "EN-GB", ar: "AR", es: "ES", it: "IT", de: "DE", nl: "NL" };
const SOURCE: Record<Language, string> = { fr: "FR", en: "EN", ar: "AR", es: "ES", it: "IT", de: "DE", nl: "NL" };

export type TranslateResult = { ok: true; texts: string[] } | { ok: false; message: string };

export const MAX_CHARS = 60_000;

export function deeplConfigured(): boolean {
  return !!process.env.DEEPL_API_KEY;
}

/**
 * Traduit une liste de textes avec l'API DeepL (clé DEEPL_API_KEY, côté serveur seulement).
 * Les clés de l'offre gratuite se terminent par « :fx » et utilisent un autre serveur.
 */
export async function deeplTranslate(texts: string[], from: Language, to: Language): Promise<TranslateResult> {
  const key = process.env.DEEPL_API_KEY;
  if (!key) return { ok: false, message: "La traduction automatique n'est pas encore activée : ajoutez la clé DEEPL_API_KEY dans Netlify puis redéployez." };
  if (!texts.length) return { ok: true, texts: [] };
  if (texts.reduce((n, t) => n + t.length, 0) > MAX_CHARS) return { ok: false, message: "Trop de texte d'un coup : traduisez en plusieurs fois." };
  // DEEPL_API_BASE : seulement pour les tests locaux (serveur factice)
  const host = process.env.DEEPL_API_BASE || (key.trim().endsWith(":fx") ? "https://api-free.deepl.com" : "https://api.deepl.com");
  const out: string[] = [];
  try {
    for (let i = 0; i < texts.length; i += 50) {
      const res = await fetch(`${host}/v2/translate`, {
        method: "POST",
        headers: { Authorization: `DeepL-Auth-Key ${key.trim()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ text: texts.slice(i, i + 50), source_lang: SOURCE[from], target_lang: TARGET[to], preserve_formatting: true }),
        cache: "no-store",
      });
      if (res.status === 403) return { ok: false, message: "Clé DeepL refusée : vérifiez DEEPL_API_KEY dans Netlify." };
      if (res.status === 456) return { ok: false, message: "Quota DeepL du mois atteint." };
      if (!res.ok) return { ok: false, message: `DeepL ne répond pas correctement (erreur ${res.status}). Réessayez dans un instant.` };
      const data = (await res.json()) as { translations?: { text: string }[] };
      if (!data.translations || data.translations.length !== Math.min(50, texts.length - i)) return { ok: false, message: "Réponse DeepL inattendue." };
      out.push(...data.translations.map((t) => t.text));
    }
  } catch {
    return { ok: false, message: "Impossible de joindre DeepL. Réessayez dans un instant." };
  }
  return { ok: true, texts: out };
}
