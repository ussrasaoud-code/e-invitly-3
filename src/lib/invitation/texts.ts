import { SECTION_LABELS, type InvitationContent } from "./schema";

/**
 * Tous les textes saisis d'une invitation / d'un modèle, pour les traduire au même endroit.
 * Chaque texte a une clé stable (identifiants des sections, calques, moments) : on
 * rapproche ainsi la version principale et la version traduite.
 */
export type TextField = {
  key: string;
  group: string;
  label: string;
  path: (string | number)[];
  max: number;
  multiline: boolean;
  /** false : pas de traduction automatique (prénoms, signatures…) */
  auto: boolean;
};

export function textFields(c: InvitationContent): TextField[] {
  const out: TextField[] = [];
  const add = (key: string, group: string, label: string, path: (string | number)[], max: number, multiline = false, auto = true) =>
    out.push({ key, group, label, path, max, multiline, auto });

  const g0 = "Textes généraux";
  add("couple.one", g0, "Prénom 1", ["couple", "partnerOne"], 60, false, false);
  add("couple.two", g0, "Prénom 2", ["couple", "partnerTwo"], 60, false, false);
  add("kicker", g0, "Phrase d'introduction (au-dessus des prénoms)", ["kicker"], 120);
  add("intro", g0, "Texte d'invitation", ["intro"], 600, true);
  add("venue.name", g0, "Lieu principal", ["mainVenue", "name"], 120);
  add("venue.city", g0, "Ville", ["mainVenue", "city"], 120);
  add("seal", g0, "Texte du cachet de l'enveloppe", ["envelope", "sealText"], 6, false, false);

  c.events.forEach((e, i) => {
    const g = `Programme — ${e.title || `moment ${i + 1}`}`;
    add(`ev.${e.id}.title`, g, "Nom du moment", ["events", i, "title"], 80);
    add(`ev.${e.id}.venue`, g, "Lieu", ["events", i, "venueName"], 120);
    add(`ev.${e.id}.address`, g, "Adresse", ["events", i, "address"], 240, false, false);
    add(`ev.${e.id}.desc`, g, "Description", ["events", i, "description"], 400, true);
  });
  c.guestGroups.forEach((gr, i) => add(`group.${gr.id}`, "Groupes d'invités", "Nom du groupe", ["guestGroups", i, "name"], 40));

  const g1 = "Infos pratiques";
  add("dress", g1, "Dress code", ["dressCode", "text"], 600, true);
  add("parking", g1, "Parking", ["practical", "parking"], 400, true);
  add("shuttles", g1, "Navettes", ["practical", "shuttles"], 400, true);
  add("transport", g1, "Transports", ["practical", "transport"], 400, true);
  add("lodging", g1, "Hébergement", ["practical", "lodging"], 600, true);
  c.contacts.forEach((ct, i) => add(`contact.${i}.role`, g1, `Rôle du contact ${ct.name || i + 1}`, ["contacts", i, "role"], 80));
  add("rsvp.intro", "Réponse des invités", "Texte du formulaire de réponse", ["rsvp", "intro"], 400, true);
  add("closing.title", "Fin de l'invitation", "Titre de fin", ["closing", "title"], 120);
  add("closing.text", "Fin de l'invitation", "Texte de fin", ["closing", "text"], 600, true);

  c.sections.forEach((s, si) => {
    const g = `Section — ${s.title || SECTION_LABELS[s.type]}`;
    add(`s.${s.id}.title`, g, "Titre", ["sections", si, "title"], 120);
    add(`s.${s.id}.kicker`, g, "Surtitre", ["sections", si, "kicker"], 120);
    add(`s.${s.id}.body`, g, "Texte", ["sections", si, "body"], 2000, true);
    s.items.forEach((it, ii) => {
      add(`s.${s.id}.it.${it.id}.title`, g, `Moment ${ii + 1} — titre`, ["sections", si, "items", ii, "title"], 80);
      add(`s.${s.id}.it.${it.id}.detail`, g, `Moment ${ii + 1} — détail`, ["sections", si, "items", ii, "detail"], 200);
    });
    s.layers.forEach((l, li) => {
      if (l.kind === "text") add(`s.${s.id}.l.${l.id}`, g, `Calque texte ${l.name ? `« ${l.name} »` : li + 1}`, ["sections", si, "layers", li, "text"], 240, true);
    });
    Object.keys(s.elements).forEach((k) => {
      add(`s.${s.id}.el.${k}`, g, `Texte remplacé (${k})`, ["sections", si, "elements", k, "text"], 80);
    });
  });
  return out;
}

export function getText(c: unknown, path: (string | number)[]): string {
  let v: unknown = c;
  for (const p of path) {
    if (v == null || typeof v !== "object") return "";
    v = (v as Record<string | number, unknown>)[p];
  }
  return typeof v === "string" ? v : "";
}

/** Copie du contenu avec ce texte remplacé (coupé à la longueur autorisée). */
export function setText(c: InvitationContent, field: TextField, value: string): InvitationContent {
  const copy = structuredClone(c) as unknown as Record<string | number, unknown>;
  let o = copy;
  for (const p of field.path.slice(0, -1)) {
    if (o[p] == null || typeof o[p] !== "object") return c;
    o = o[p] as Record<string | number, unknown>;
  }
  o[field.path[field.path.length - 1]] = value.slice(0, field.max);
  return copy as unknown as InvitationContent;
}

export type TextRow = TextField & { source: string; value: string; todo: boolean };

/**
 * Lignes à afficher : textes non vides dans la version principale ou dans la traduction.
 * « todo » : texte encore identique à la version principale.
 */
export function translationRows(main: InvitationContent, variant: InvitationContent): TextRow[] {
  const src = new Map(textFields(main).map((f) => [f.key, getText(main, f.path)]));
  return textFields(variant)
    .map((f) => {
      const source = src.get(f.key) ?? "";
      const value = getText(variant, f.path);
      return { ...f, source, value, todo: !!source.trim() && value.trim() === source.trim() && /\p{L}/u.test(source) };
    })
    .filter((r) => r.source.trim() || r.value.trim());
}
