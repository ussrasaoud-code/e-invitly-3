import { LANGUAGES, type InvitationContent, type Language, type TemplateDefinition } from "./schema";

/**
 * Versions par langue d'un modèle : un seul design, des textes traduits.
 * La version principale est `sample` (sa langue = sample.language) ;
 * les autres sont dans `variants`.
 */
export const mainLang = (def: TemplateDefinition): Language => def.sample.language;

/** Langues disponibles, la principale en premier. */
export function templateLangs(def: TemplateDefinition): Language[] {
  const main = mainLang(def);
  return [main, ...LANGUAGES.filter((l) => l !== main && def.variants?.[l])];
}

export function getVariant(def: TemplateDefinition, lang: Language): InvitationContent | null {
  if (lang === mainLang(def)) return def.sample;
  return def.variants?.[lang] ?? null;
}

/** Contenu à afficher dans une langue (repli sur la version principale). */
export function contentFor(def: TemplateDefinition, lang: Language | null | undefined): InvitationContent {
  return (lang && getVariant(def, lang)) || def.sample;
}

/** Remplace (ou ajoute) la version d'une langue. */
export function setVariant(def: TemplateDefinition, lang: Language, content: InvitationContent): TemplateDefinition {
  const c = { ...content, language: lang };
  if (lang === mainLang(def)) return { ...def, sample: c };
  return { ...def, variants: { ...(def.variants ?? {}), [lang]: c } };
}

export function removeVariant(def: TemplateDefinition, lang: Language): TemplateDefinition {
  if (lang === mainLang(def)) return def;
  const variants = { ...(def.variants ?? {}) };
  delete variants[lang];
  return { ...def, variants };
}

/** Nouvelle langue : copie de la version principale, textes à traduire. */
export function newVariant(def: TemplateDefinition, lang: Language): InvitationContent {
  return { ...structuredClone(def.sample), language: lang };
}

/**
 * Reprend le design de la version principale (sections, calques, positions,
 * couleurs, fonds, animations) en conservant les textes de la version traduite.
 * Les éléments rapprochés par identifiant (sections, calques, moments).
 */
export function syncDesign(main: InvitationContent, variant: InvitationContent): InvitationContent {
  const vSections = new Map(variant.sections.map((s) => [s.id, s]));
  const sections = main.sections.map((s) => {
    const v = vSections.get(s.id);
    const copy = structuredClone(s);
    if (!v) return copy;
    const vLayers = new Map(v.layers.map((l) => [l.id, l]));
    const vItems = new Map(v.items.map((it) => [it.id, it]));
    return {
      ...copy,
      title: v.title,
      body: v.body,
      kicker: v.kicker,
      items: copy.items.map((it) => {
        const vi = vItems.get(it.id);
        return vi ? { ...it, time: vi.time, title: vi.title, detail: vi.detail } : it;
      }),
      layers: [
        ...copy.layers.map((l) => {
          const vl = vLayers.get(l.id);
          return vl && l.kind === "text" ? { ...l, text: vl.text } : l;
        }),
        // Calques ajoutés seulement dans cette langue : conservés
        ...v.layers.filter((l) => !copy.layers.some((m) => m.id === l.id)),
      ].slice(0, 40),
      elements: Object.fromEntries(Object.entries(copy.elements).map(([k, st]) => [k, { ...st, text: v.elements[k]?.text ?? "" }])),
    };
  });
  const base = structuredClone(main);
  return {
    ...base,
    language: variant.language,
    couple: { ...variant.couple, photoUrl: main.couple.photoUrl },
    kicker: variant.kicker,
    intro: variant.intro,
    mainVenue: variant.mainVenue,
    events: structuredClone(variant.events),
    dressCode: { ...base.dressCode, text: variant.dressCode.text },
    practical: { ...variant.practical },
    contacts: structuredClone(variant.contacts),
    rsvp: { ...base.rsvp, intro: variant.rsvp.intro },
    closing: { ...variant.closing },
    envelope: { ...base.envelope, sealText: variant.envelope.sealText },
    sections,
  };
}

/** Applique le design de la version principale à toutes les autres langues. */
export function syncAllVariants(def: TemplateDefinition): TemplateDefinition {
  const variants: TemplateDefinition["variants"] = {};
  for (const l of LANGUAGES) {
    const v = def.variants?.[l];
    if (v && l !== mainLang(def)) variants[l] = syncDesign(def.sample, v);
  }
  return { ...def, variants };
}
