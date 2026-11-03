import type { Audience, InvitationContent, InvitationEvent } from "./schema";

/**
 * Invités du henné / invités de la soirée.
 * Le lien normal ne montre que les moments ouverts à tous ; le lien
 * « henné + soirée » (?h=<jeton>) montre aussi les moments réservés.
 * Le filtrage se fait côté serveur : un invité de la soirée ne reçoit
 * jamais les informations du henné dans sa page.
 */
export function forAudience(content: InvitationContent, audience: Audience): InvitationContent {
  if (audience === "henna") return content;
  return { ...content, events: content.events.filter((e) => e.audience !== "henna") };
}

export const hasHennaEvents = (content: InvitationContent) => content.events.some((e) => e.audience === "henna");

/** Jour d'un moment (sa propre date, sinon la date principale). */
export const eventDay = (e: InvitationEvent, content: InvitationContent) => e.date || content.eventAt.slice(0, 10);

/** Les moments s'étalent sur plusieurs jours ? */
export function isMultiDay(content: InvitationContent, events = content.events) {
  return new Set(events.map((e) => eventDay(e, content)).filter(Boolean)).size > 1;
}

/** Moments triés par jour puis par heure. */
export function sortByDay(content: InvitationContent, events = content.events) {
  return [...events].sort((a, b) => `${eventDay(a, content)} ${a.startTime || a.arrivalTime || "99:99"}`.localeCompare(`${eventDay(b, content)} ${b.startTime || b.arrivalTime || "99:99"}`));
}

/** Regroupe des éléments par jour (dans l'ordre d'apparition). */
export function groupByDay<T>(items: T[], day: (item: T) => string): Array<{ day: string; items: T[] }> {
  const out: Array<{ day: string; items: T[] }> = [];
  for (const it of items) {
    const d = day(it);
    const last = out.at(-1);
    if (last && last.day === d) last.items.push(it);
    else out.push({ day: d, items: [it] });
  }
  return out;
}
