/** Libellés du catalogue (catégories et styles). */
export const CATEGORIES = [
  { value: "mariage", label: "Mariage" },
  { value: "fiancailles", label: "Fiançailles" },
  { value: "anniversaire", label: "Anniversaire" },
  { value: "bapteme", label: "Baptême" },
  { value: "graduation", label: "Graduation" },
  { value: "autre", label: "Autres événements" },
] as const;

export const STYLES = [
  { value: "minimaliste", label: "Minimaliste" },
  { value: "floral", label: "Floral" },
  { value: "vintage", label: "Vintage" },
  { value: "moderne", label: "Moderne" },
  { value: "romantique", label: "Romantique" },
  { value: "classique", label: "Classique" },
] as const;

export const categoryLabel = (v: string) => CATEGORIES.find((c) => c.value === v)?.label ?? v;
export const styleLabel = (v: string) => STYLES.find((s) => s.value === v)?.label ?? v;

export const isCatalogStyle = (v: string) => STYLES.some((s) => s.value === v);

/** Styles libres saisis dans la fiche : séparés par des virgules, 30 caractères max, 10 au plus. */
export function parseCustomStyles(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const v = part.trim().replace(/\s+/g, " ").slice(0, 30);
    const key = v.toLowerCase();
    if (!v || seen.has(key) || STYLES.some((s) => s.value === key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out.slice(0, 10);
}
