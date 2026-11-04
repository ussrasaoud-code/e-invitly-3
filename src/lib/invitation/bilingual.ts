import { invitationContentSchema, type InvitationContent, type Language } from "./schema";
import { syncDesign } from "./variants";
import { linkNamesInContent } from "./fields";

/**
 * Invitation en deux langues : la version principale porte le design ; la deuxième
 * langue (content.alt) ne garde que ses textes. Un seul lien, les invités choisissent.
 */
export function altOf(c: InvitationContent): InvitationContent | null {
  if (!c.alt) return null;
  const parsed = invitationContentSchema.safeParse(c.alt);
  if (!parsed.success || parsed.data.language === c.language) return null;
  return { ...parsed.data, alt: undefined };
}

export function stripAlt(c: InvitationContent): InvitationContent {
  const { alt: _alt, ...rest } = c;
  void _alt;
  return rest as InvitationContent;
}

/** Langues proposées aux invités, la principale en premier. */
export function invitationLangs(c: InvitationContent): Language[] {
  const alt = altOf(c);
  return alt ? [c.language, alt.language] : [c.language];
}

/** Deuxième langue mise au design de la version principale (textes de la traduction). */
export function syncInvitationAlt(main: InvitationContent, alt: InvitationContent): InvitationContent {
  const base = stripAlt(main);
  const synced = syncDesign(base, alt);
  const altEvents = new Map(alt.events.map((e) => [e.id, e]));
  const altGroups = new Map(alt.guestGroups.map((g) => [g.id, g]));
  return {
    ...synced,
    alt: undefined,
    // Moments : horaires, groupes et adresses de la version principale ; textes traduits
    events: base.events.map((e) => {
      const a = altEvents.get(e.id);
      return a ? { ...e, title: a.title || e.title, venueName: a.venueName || e.venueName, description: a.description } : e;
    }),
    guestGroups: base.guestGroups.map((g) => ({ ...g, name: altGroups.get(g.id)?.name || g.name })),
    contacts: base.contacts.map((ct, i) => ({ ...ct, role: alt.contacts[i]?.role ?? ct.role })),
  };
}

/** Contenu à montrer dans une langue donnée (repli : version principale). */
export function contentInLang(c: InvitationContent, lang: string | null | undefined): InvitationContent {
  const alt = altOf(c);
  if (alt && lang === alt.language) return syncInvitationAlt(c, alt);
  return stripAlt(c);
}

/**
 * Nouvelle deuxième langue. Sans version du modèle dans cette langue : copie des textes
 * principaux (à traduire). Avec : textes de design du modèle traduit (titres, calques…),
 * mais les informations du couple (moments, infos pratiques, dress code…) restent les
 * leurs, à traduire ; les phrases génériques non modifiées reprennent la version traduite.
 */
export function newAlt(main: InvitationContent, lang: Language, tpl?: { main: InvitationContent; variant: InvitationContent } | null): InvitationContent {
  const m = stripAlt(main);
  if (!tpl) return { ...structuredClone(m), language: lang, alt: undefined };
  const v = linkNamesInContent({ ...tpl.variant, language: lang }, tpl.variant.couple.partnerOne, tpl.variant.couple.partnerTwo);
  const synced = syncInvitationAlt(m, v);
  const same = (a: string, b: string) => a.trim() === b.trim();
  return {
    ...synced,
    language: lang,
    couple: { ...m.couple },
    mainVenue: { ...m.mainVenue },
    kicker: same(m.kicker, tpl.main.kicker) ? v.kicker : m.kicker,
    intro: same(m.intro, tpl.main.intro) ? v.intro : m.intro,
    events: structuredClone(m.events),
    guestGroups: structuredClone(m.guestGroups),
    dressCode: { ...m.dressCode },
    practical: { ...m.practical },
    contacts: structuredClone(m.contacts),
    rsvp: { ...m.rsvp, intro: same(m.rsvp.intro, tpl.main.rsvp.intro) ? v.rsvp.intro : m.rsvp.intro },
    closing: same(m.closing.title + m.closing.text, tpl.main.closing.title + tpl.main.closing.text) ? { ...v.closing } : { ...m.closing },
    alt: undefined,
  };
}

/**
 * Choix de la langue d'affichage : paramètre ?langue, sinon langue préférée du téléphone
 * si elle fait partie des deux, sinon la langue principale.
 */
export function pickLang(langs: Language[], requested: string | undefined, acceptLanguage: string | null): Language {
  if (requested && (langs as string[]).includes(requested)) return requested as Language;
  if (langs.length > 1 && acceptLanguage) {
    for (const part of acceptLanguage.split(",")) {
      const code = part.split(";")[0].trim().slice(0, 2).toLowerCase();
      if ((langs as string[]).includes(code)) return code as Language;
    }
  }
  return langs[0];
}
