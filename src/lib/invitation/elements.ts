import type { RendererKey, SectionType } from "./schema";

/**
 * Éléments intégrés à chaque section d'un modèle (titres, prénoms, ornements…).
 * L'éditeur visuel permet de les sélectionner, déplacer, recolorer ou retirer.
 * `edit` indique quel champ du contenu se modifie directement depuis l'éditeur.
 */
export type ElementEdit =
  | "kicker"
  | "names"
  | "intro"
  | "venue"
  | "section-title"
  | "section-body"
  | "closing-title"
  | "closing-text"
  | "dresscode-text"
  | "rsvp-intro";

export type ElementDef = {
  id: string;
  label: string;
  kind: "text" | "ornament" | "block";
  edit?: ElementEdit;
  /** Limité à certains modèles (sinon : tous) */
  renderers?: RendererKey[];
  /** false : l'élément ne peut pas être retiré (logique verrouillée) */
  hideable?: boolean;
};

const ORNATE: RendererKey[] = ["the-garden", "province"];
const title = (): ElementDef[] => [
  { id: "title", label: "Titre de la section", kind: "text", edit: "section-title" },
  { id: "title-ornament", label: "Ornement sous le titre", kind: "ornament", renderers: ["the-garden"] },
];

export const SECTION_ELEMENTS: Record<SectionType, ElementDef[]> = {
  hero: [
    { id: "corner-left", label: "Bouquet en haut à gauche", kind: "ornament", renderers: ["the-garden"] },
    { id: "corner-right", label: "Bouquet en haut à droite", kind: "ornament", renderers: ["the-garden"] },
    { id: "arch", label: "Arche", kind: "ornament", renderers: ["province"] },
    { id: "sprig-left", label: "Rameau gauche", kind: "ornament", renderers: ["province"] },
    { id: "sprig-right", label: "Rameau droit", kind: "ornament", renderers: ["province"] },
    { id: "kicker", label: "Accroche", kind: "text", edit: "kicker" },
    { id: "photo", label: "Photo du couple", kind: "block" },
    { id: "names", label: "Prénoms", kind: "text", edit: "names" },
    { id: "intro", label: "Texte d'invitation", kind: "text", edit: "intro" },
    { id: "divider", label: "Ornement central", kind: "ornament", renderers: ["the-garden"] },
    { id: "date", label: "Date en chiffres", kind: "text" },
    { id: "date-long", label: "Date en lettres", kind: "text" },
    { id: "venue", label: "Lieu principal", kind: "text", edit: "venue" },
  ],
  program: [...title(), { id: "list", label: "Liste des moments", kind: "block" }],
  countdown: [...title(), { id: "timer", label: "Compteur", kind: "block", hideable: false }],
  dresscode: [...title(), { id: "text", label: "Texte du dress code", kind: "text", edit: "dresscode-text" }, { id: "palette", label: "Palette de couleurs", kind: "block" }],
  venues: [...title(), { id: "list", label: "Lieux et infos pratiques", kind: "block" }],
  rsvp: [...title(), { id: "intro", label: "Texte d'introduction", kind: "text", edit: "rsvp-intro" }, { id: "form", label: "Formulaire de réponse", kind: "block", hideable: false }],
  contacts: [...title(), { id: "list", label: "Liste des contacts", kind: "block" }],
  closing: [
    { id: "sprig", label: "Rameau", kind: "ornament", renderers: ["the-garden"] },
    { id: "title", label: "Titre", kind: "text", edit: "closing-title" },
    { id: "text", label: "Message", kind: "text", edit: "closing-text" },
    { id: "signature", label: "Signature (prénoms)", kind: "text", edit: "names" },
  ],
  text: [...title(), { id: "body", label: "Texte", kind: "text", edit: "section-body" }],
  decor: [],
};

export function elementsFor(type: SectionType, renderer: RendererKey): ElementDef[] {
  return SECTION_ELEMENTS[type].filter((e) => !e.renderers || e.renderers.includes(renderer));
}

export const isOrnate = (renderer: RendererKey) => ORNATE.includes(renderer);
