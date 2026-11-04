import { formatDotDate, formatLongDate, formatTime, type Lang } from "@/lib/time";
import type { InvitationContent } from "./schema";

/**
 * Champs automatiques dans les calques texte : {prenom1}, {prenom2}, {date}…
 * Ils affichent les informations de l'invitation : quand un client choisit le modèle,
 * ses prénoms et sa date remplacent ceux de la démo sans retouche manuelle.
 * Écrit en majuscules ({PRENOM1}), le champ s'affiche en majuscules.
 */
export const FIELD_TOKENS = [
  { key: "prenom1", label: "Prénom 1" },
  { key: "prenom2", label: "Prénom 2" },
  { key: "date", label: "Date (12 · 06 · 2027)" },
  { key: "date_longue", label: "Date en toutes lettres" },
  { key: "heure", label: "Heure" },
  { key: "lieu", label: "Lieu principal" },
  { key: "ville", label: "Ville" },
] as const;
export type FieldKey = (typeof FIELD_TOKENS)[number]["key"];
export type FieldValues = Record<FieldKey, string>;

export function fieldValues(c: Pick<InvitationContent, "couple" | "eventAt" | "mainVenue" | "language">): FieldValues {
  const lang = c.language as Lang;
  return {
    prenom1: c.couple.partnerOne,
    prenom2: c.couple.partnerTwo,
    date: formatDotDate(c.eventAt),
    date_longue: formatLongDate(c.eventAt, lang),
    heure: c.eventAt ? formatTime(c.eventAt.slice(11, 16), lang) : "",
    lieu: c.mainVenue.name,
    ville: c.mainVenue.city,
  };
}

const TOKEN_RE = /\{(prenom1|prenom2|date_longue|date|heure|lieu|ville)\}/gi;

export function hasFields(text: string): boolean {
  TOKEN_RE.lastIndex = 0;
  return TOKEN_RE.test(text);
}

export function fillFields(text: string, v: FieldValues | null): string {
  if (!v || !text.includes("{")) return text;
  return text.replace(TOKEN_RE, (raw, k: string) => {
    const value = v[k.toLowerCase() as FieldKey] ?? "";
    const word = raw.slice(1, -1);
    return word === word.toUpperCase() && /[A-Z]/.test(word) ? value.toLocaleUpperCase() : value;
  });
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Remplace les prénoms écrits « en dur » (ceux de la démo) par les champs automatiques.
 * « CAMILLE » → {PRENOM1}, « Camille » → {prenom1}. Mot entier seulement.
 */
export function linkNames(text: string, one: string, two: string): string {
  let out = text;
  for (const [name, key] of [[one, "prenom1"], [two, "prenom2"]] as const) {
    const n = name.trim();
    if (n.length < 2) continue;
    out = out.replace(new RegExp(`(?<![\\p{L}\\p{N}{])${escapeRe(n)}(?![\\p{L}\\p{N}}])`, "giu"), (m) =>
      m === m.toLocaleUpperCase() && m !== m.toLocaleLowerCase() ? `{${key.toUpperCase()}}` : `{${key}}`,
    );
  }
  return out;
}

/** Tous les calques texte d'un contenu : prénoms de la démo → champs automatiques. */
export function linkNamesInContent<T extends InvitationContent>(c: T, one: string, two: string): T {
  return {
    ...c,
    sections: c.sections.map((s) => ({
      ...s,
      layers: s.layers.map((l) => (l.kind === "text" ? { ...l, text: linkNames(l.text, one, two) } : l)),
    })),
  };
}
