"use server";

import { requireStaff } from "@/lib/auth";
import { deeplTranslate, type TranslateResult } from "@/lib/deepl";
import { LANGUAGES, type Language } from "@/lib/invitation/schema";

const isLang = (v: unknown): v is Language => typeof v === "string" && (LANGUAGES as readonly string[]).includes(v);

/** Traduction automatique pour l'administration (jamais accessible aux visiteurs). */
export async function translateTexts(texts: string[], from: Language, to: Language): Promise<TranslateResult> {
  await requireStaff();
  if (!Array.isArray(texts) || texts.length > 400 || texts.some((t) => typeof t !== "string" || t.length > 5000)) return { ok: false, message: "Textes invalides." };
  if (!isLang(from) || !isLang(to) || from === to) return { ok: false, message: "Langues invalides." };
  return deeplTranslate(texts, from, to);
}
