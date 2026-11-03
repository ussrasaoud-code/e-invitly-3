import { programV2Items, type InvitationContent, type InvitationSection, type RendererKey, type SectionType } from "./schema";

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
  | "rsvp-intro"
  | "section-kicker";

export type EventField = "startTime" | "title" | "venueName" | "description" | "address";
export type ElementEdit =
  | SimpleEdit
  | { partner: "partnerOne" | "partnerTwo" }
  | { venue: "name" | "city" }
  | { event: string; field: EventField }
  | { contact: number; field: "name" | "role" | "phone" }
  | { item: number; field: "time" | "title" | "detail" };

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
    const key = `${e.address.toLowerCase()}|${e.date || c.eventAt.slice(0, 10)}`;
    if (!e.address || seen.has(key)) continue;
    seen.add(key);
    const k = `list.${elKey(e.id)}`;
    items.push({
      id: k,
      label: e.venueName || e.title || "Lieu",
      kind: "block",
      children: [
        { id: `${k}.title`, label: "Intitulé", kind: "text", edit: { event: e.id, field: "title" } },
        { id: `${k}.place`, label: EVENT_LABEL.venueName, kind: "text", edit: { event: e.id, field: "venueName" } },
        { id: `${k}.address`, label: EVENT_LABEL.address, kind: "text", edit: { event: e.id, field: "address" } },
        { id: `${k}.time`, label: "Horaire", kind: "text" },
        { id: `${k}.maps`, label: "Boutons (itinéraire, calendrier)", kind: "block" },
      ],
    });
  }
  const p = c.practical;
  const practical = (
    [
      ["parking", "Stationnement", p.parking],
      ["shuttles", "Navettes", p.shuttles],
      ["transport", "Transports", p.transport],
      ["lodging", "Hébergement", p.lodging],
    ] as const
  ).filter(([, , v]) => v);
  if (practical.length) {
    items.push({
      id: "list.practical",
      label: "Infos pratiques",
      kind: "block",
      children: practical.map(([id, label]) => ({
        id: `list.practical.${id}`,
        label,
        kind: "block" as const,
        children: [
          { id: `list.practical.${id}.label`, label: `${label} · intitulé`, kind: "text" as const },
          { id: `list.practical.${id}.text`, label: `${label} · texte`, kind: "text" as const },
        ],
      })),
    });
  }
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

function definitions(type: SectionType, c: InvitationContent, section?: InvitationSection): ElementDef[] {
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
    case "scratch":
      return [
        ...title(),
        { id: "hint", label: "Consigne (« Grattez… »)", kind: "text", edit: "section-kicker" },
        { id: "cards", label: "Cartes à gratter", kind: "block", hideable: false },
        { id: "done", label: "Message une fois la date découverte", kind: "text", edit: "section-body" },
      ];
    case "program2":
      return [
        { id: "kicker", label: "Surtitre", kind: "text", edit: "section-kicker" },
        { id: "title", label: "Titre", kind: "text", edit: "section-title" },
        { id: "stem", label: "Tige fleurie", kind: "ornament" },
        { id: "marker", label: "Fleur qui suit le défilement", kind: "ornament" },
        {
          id: "list",
          label: "Liste des moments",
          kind: "block",
          children: section
            ? programV2Items(section, c).map((it, i) => {
                const k = `list.${elKey(it.id)}`;
                // Moment repris du programme de l'invitation : on modifie l'événement lui-même
                const ev = "fromEvent" in it;
                return {
                  id: k,
                  label: it.title || "Moment",
                  kind: "block" as const,
                  children: [
                    { id: `${k}.time`, label: "Heure", kind: "text" as const, edit: ev ? { event: it.id, field: "startTime" as const } : { item: i, field: "time" as const } },
                    { id: `${k}.title`, label: "Intitulé", kind: "text" as const, edit: ev ? { event: it.id, field: "title" as const } : { item: i, field: "title" as const } },
                    ...(it.detail
                      ? [{ id: `${k}.detail`, label: "Détail", kind: "text" as const, edit: ev ? { event: it.id, field: "venueName" as const } : { item: i, field: "detail" as const } }]
                      : []),
                  ],
                };
              })
            : [],
        },
      ];
  }
}

/** Arbre des éléments d'une section pour un modèle donné. */
export function elementsFor(type: SectionType, renderer: RendererKey, content: InvitationContent, section?: InvitationSection): ElementDef[] {
  const filter = (defs: ElementDef[]): ElementDef[] =>
    defs.filter((e) => !e.renderers || e.renderers.includes(renderer)).map((e) => (e.children ? { ...e, children: filter(e.children) } : e));
  return filter(definitions(type, content, section));
}

/** Tous les éléments (groupes et parties) à plat. */
export function flattenElements(defs: ElementDef[], parent?: ElementDef): Array<ElementDef & { parent?: ElementDef }> {
  return defs.flatMap((d) => [{ ...d, parent }, ...(d.children ? flattenElements(d.children, d) : [])]);
}
