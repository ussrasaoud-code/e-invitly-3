import type { InvitationContent, RendererKey, SectionType } from "./schema";

/**
 * Éléments intégrés à chaque section d'un modèle (titres, prénoms, ornements…).
 * L'éditeur visuel permet de les sélectionner, déplacer, recolorer, changer leur
 * police ou les retirer. Certains sont des groupes (prénoms, listes) que l'on
 * peut dégrouper pour modifier chaque partie séparément.
 */
export type SimpleEdit =
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

export type EventField = "startTime" | "title" | "venueName" | "description" | "address";
export type ElementEdit =
  | SimpleEdit
  | { partner: "partnerOne" | "partnerTwo" }
  | { venue: "name" | "city" }
  | { event: string; field: EventField }
  | { contact: number; field: "name" | "role" | "phone" };

export type ElementDef = {
  id: string;
  label: string;
  kind: "text" | "ornament" | "block";
  edit?: ElementEdit;
  /** Libellé fixe remplaçable (ex. « & ») */
  literal?: string;
  /** Limité à certains modèles (sinon : tous) */
  renderers?: RendererKey[];
  /** false : l'élément ne peut pas être retiré (logique verrouillée) */
  hideable?: boolean;
  /** Parties d'un groupe (dégroupable) */
  children?: ElementDef[];
};

const title = (): ElementDef[] => [
  { id: "title", label: "Titre de la section", kind: "text", edit: "section-title" },
  { id: "title-ornament", label: "Ornement sous le titre", kind: "ornament", renderers: ["the-garden"] },
];

export const elKey = (raw: string) => raw.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 30) || "x";

const EVENT_LABEL: Record<EventField, string> = {
  startTime: "Heure",
  title: "Intitulé",
  venueName: "Lieu",
  description: "Description",
  address: "Adresse",
};

function programItems(c: InvitationContent): ElementDef[] {
  return c.events
    .filter((e) => e.startTime || e.title)
    .map((e) => {
      const k = `list.${elKey(e.id)}`;
      const parts: ElementDef[] = [
        { id: `${k}.time`, label: EVENT_LABEL.startTime, kind: "text", edit: { event: e.id, field: "startTime" } },
        { id: `${k}.title`, label: EVENT_LABEL.title, kind: "text", edit: { event: e.id, field: "title" } },
      ];
      if (e.venueName) parts.push({ id: `${k}.place`, label: EVENT_LABEL.venueName, kind: "text", edit: { event: e.id, field: "venueName" } });
      if (e.description) parts.push({ id: `${k}.desc`, label: EVENT_LABEL.description, kind: "text", edit: { event: e.id, field: "description" } });
      return { id: k, label: e.title || "Moment", kind: "block", children: parts };
    });
}

function venueItems(c: InvitationContent): ElementDef[] {
  const seen = new Set<string>();
  const items: ElementDef[] = [];
  for (const e of c.events) {
    if (!e.address || seen.has(e.address.toLowerCase())) continue;
    seen.add(e.address.toLowerCase());
    const k = `list.${elKey(e.id)}`;
    items.push({
      id: k,
      label: e.venueName || e.title || "Lieu",
      kind: "block",
      children: [
        { id: `${k}.title`, label: "Intitulé et heure d'arrivée", kind: "text", edit: { event: e.id, field: "title" } },
        { id: `${k}.place`, label: EVENT_LABEL.venueName, kind: "text", edit: { event: e.id, field: "venueName" } },
        { id: `${k}.address`, label: EVENT_LABEL.address, kind: "text", edit: { event: e.id, field: "address" } },
        { id: `${k}.maps`, label: "Boutons d'itinéraire", kind: "block" },
      ],
    });
  }
  const p = c.practical;
  if (p.parking || p.shuttles || p.transport || p.lodging) items.push({ id: "list.practical", label: "Infos pratiques", kind: "block" });
  return items;
}

function contactItems(c: InvitationContent): ElementDef[] {
  return c.contacts.map((ct, i) => {
    const k = `list.c${i}`;
    const parts: ElementDef[] = [{ id: `${k}.name`, label: "Nom", kind: "text", edit: { contact: i, field: "name" } }];
    if (ct.role) parts.push({ id: `${k}.role`, label: "Rôle", kind: "text", edit: { contact: i, field: "role" } });
    if (ct.phone) parts.push({ id: `${k}.phone`, label: "Téléphone", kind: "text", edit: { contact: i, field: "phone" } });
    return { id: k, label: ct.name || "Contact", kind: "block", children: parts };
  });
}

function definitions(type: SectionType, c: InvitationContent): ElementDef[] {
  switch (type) {
    case "hero":
      return [
        { id: "corner-left", label: "Bouquet en haut à gauche", kind: "ornament", renderers: ["the-garden"] },
        { id: "corner-right", label: "Bouquet en haut à droite", kind: "ornament", renderers: ["the-garden"] },
        { id: "arch", label: "Arche", kind: "ornament", renderers: ["province"] },
        { id: "sprig-left", label: "Rameau gauche", kind: "ornament", renderers: ["province"] },
        { id: "sprig-right", label: "Rameau droit", kind: "ornament", renderers: ["province"] },
        { id: "kicker", label: "Accroche", kind: "text", edit: "kicker" },
        { id: "photo", label: "Photo du couple", kind: "block" },
        {
          id: "names",
          label: "Prénoms",
          kind: "text",
          edit: "names",
          children: [
            { id: "names.one", label: "Premier prénom", kind: "text", edit: { partner: "partnerOne" } },
            { id: "names.and", label: "Esperluette « & »", kind: "text", literal: "&" },
            { id: "names.two", label: "Second prénom", kind: "text", edit: { partner: "partnerTwo" } },
          ],
        },
        { id: "intro", label: "Texte d'invitation", kind: "text", edit: "intro" },
        { id: "divider", label: "Ornement central", kind: "ornament", renderers: ["the-garden"] },
        { id: "date", label: "Date en chiffres", kind: "text" },
        { id: "date-long", label: "Date en lettres", kind: "text" },
        {
          id: "venue",
          label: "Lieu principal",
          kind: "text",
          edit: "venue",
          children: [
            { id: "venue.name", label: "Nom du lieu", kind: "text", edit: { venue: "name" } },
            { id: "venue.city", label: "Ville", kind: "text", edit: { venue: "city" } },
          ],
        },
      ];
    case "program":
      return [...title(), { id: "list", label: "Liste des moments", kind: "block", children: programItems(c) }];
    case "countdown":
      return [...title(), { id: "timer", label: "Compteur", kind: "block", hideable: false }];
    case "dresscode":
      return [...title(), { id: "text", label: "Texte du dress code", kind: "text", edit: "dresscode-text" }, { id: "palette", label: "Palette de couleurs", kind: "block" }];
    case "venues":
      return [...title(), { id: "list", label: "Lieux et infos pratiques", kind: "block", children: venueItems(c) }];
    case "rsvp":
      return [...title(), { id: "intro", label: "Texte d'introduction", kind: "text", edit: "rsvp-intro" }, { id: "form", label: "Formulaire de réponse", kind: "block", hideable: false }];
    case "contacts":
      return [...title(), { id: "list", label: "Liste des contacts", kind: "block", children: contactItems(c) }];
    case "closing":
      return [
        { id: "sprig", label: "Rameau", kind: "ornament", renderers: ["the-garden"] },
        { id: "title", label: "Titre", kind: "text", edit: "closing-title" },
        { id: "text", label: "Message", kind: "text", edit: "closing-text" },
        { id: "signature", label: "Signature (prénoms)", kind: "text", edit: "names" },
      ];
    case "text":
      return [...title(), { id: "body", label: "Texte", kind: "text", edit: "section-body" }];
    case "decor":
      return [];
  }
}

/** Arbre des éléments d'une section pour un modèle donné. */
export function elementsFor(type: SectionType, renderer: RendererKey, content: InvitationContent): ElementDef[] {
  const filter = (defs: ElementDef[]): ElementDef[] =>
    defs.filter((e) => !e.renderers || e.renderers.includes(renderer)).map((e) => (e.children ? { ...e, children: filter(e.children) } : e));
  return filter(definitions(type, content));
}

/** Tous les éléments (groupes et parties) à plat. */
export function flattenElements(defs: ElementDef[], parent?: ElementDef): Array<ElementDef & { parent?: ElementDef }> {
  return defs.flatMap((d) => [{ ...d, parent }, ...(d.children ? flattenElements(d.children, d) : [])]);
}
