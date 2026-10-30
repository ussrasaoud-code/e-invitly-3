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
