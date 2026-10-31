import type { FontKey } from "@/lib/invitation/schema";

/** Polices disponibles dans les invitations (chargées seulement si utilisées). */
export const FONTS: Record<FontKey, { label: string; stack: string; kind: "Titres" | "Manuscrites" | "Texte" }> = {
  aboreto: { label: "Aboreto — capitales gravées", stack: '"Aboreto", "Cormorant Garamond", serif', kind: "Titres" },
  italiana: { label: "Italiana — fine et élancée", stack: '"Italiana", "Cormorant Garamond", serif', kind: "Titres" },
  playfair: { label: "Playfair Display — classique", stack: '"Playfair Display", Georgia, serif', kind: "Titres" },
  cormorant: { label: "Cormorant Garamond — serif élégante", stack: '"Cormorant Garamond", Georgia, serif', kind: "Titres" },
  dancing: { label: "Dancing Script — manuscrite ronde", stack: '"Dancing Script", cursive', kind: "Manuscrites" },
  greatvibes: { label: "Great Vibes — calligraphie", stack: '"Great Vibes", cursive', kind: "Manuscrites" },
  pinyon: { label: "Pinyon Script — calligraphie ancienne", stack: '"Pinyon Script", cursive', kind: "Manuscrites" },
  parisienne: { label: "Parisienne — manuscrite légère", stack: '"Parisienne", cursive', kind: "Manuscrites" },
  jost: { label: "Jost — moderne lisible", stack: '"Jost Variable", "Jost", system-ui, sans-serif', kind: "Texte" },
  montserrat: { label: "Montserrat — moderne", stack: '"Montserrat", system-ui, sans-serif', kind: "Texte" },
  lora: { label: "Lora — serif douce", stack: '"Lora", Georgia, serif', kind: "Texte" },
  amiri: { label: "Amiri — arabe", stack: '"Amiri", serif', kind: "Texte" },
};

export const FONT_GROUPS = (["Titres", "Manuscrites", "Texte"] as const).map((kind) => ({
  kind,
  keys: (Object.keys(FONTS) as FontKey[]).filter((k) => FONTS[k].kind === kind),
}));
