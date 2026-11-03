import type { GuestGroup, InvitationContent, InvitationEvent } from "./schema";

/**
 * Groupes d'invités : le lien principal ne montre que les moments ouverts à tous ;
 * le lien privé d'un groupe (?g=<jeton>) montre aussi les moments réservés à ce groupe.
 * Le filtrage se fait côté serveur : un invité ne reçoit jamais les moments des autres groupes.
 */
export function forGroup(content: InvitationContent, groupId: string | null): InvitationContent {
  return {
    ...content,
    events: content.events.filter((e) => !e.groups.length || (!!groupId && e.groups.includes(groupId))),
    guestGroups: groupId ? content.guestGroups.filter((g) => g.id === groupId) : [],
  };
}

/** Groupes réellement utilisés par au moins un moment. */
export const usedGroups = (content: InvitationContent): GuestGroup[] =>
  content.guestGroups.filter((g) => content.events.some((e) => e.groups.includes(g.id)));

/** Identifiant stable d'un groupe à partir de son nom (« Famille proche » → famille-proche). */
export function groupId(name: string, taken: string[] = []): string {
  const base =
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 30) || "groupe";
  let id = base;
  for (let n = 2; taken.includes(id); n++) id = `${base}-${n}`;
  return id;
}

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
