import { zonedToUtc } from "./time";

export type IcsEvent = { title: string; local: string; timeZone: string; location: string; durationMin?: number };

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (v: string) => v.replace(/[\;,]/g, (c) => `\\${c}`).replace(/\r?\n/g, "\\n");

/** Fichier .ics d'un événement (heure locale du mariage convertie en UTC). */
export function buildIcs(e: IcsEvent): string | null {
  const start = zonedToUtc(e.local, e.timeZone);
  if (!start) return null;
  const end = new Date(start.getTime() + (e.durationMin ?? 120) * 60_000);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//E-Invitly//Invitation//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${stamp(start)}-${Math.abs(hash(e.title + e.location))}@e-invitly.com`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(e.title)}`,
    ...(e.location ? [`LOCATION:${esc(e.location)}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

function hash(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return h;
}

/** Lien vers /api/calendrier pour un lieu de l'invitation (null si date ou heure manquante). */
export function calendarHref(p: { date: string; time: string; timeZone: string; title: string; location: string }): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date) || !/^\d{2}:\d{2}$/.test(p.time)) return null;
  const q = new URLSearchParams({ t: p.title.slice(0, 160), d: `${p.date}T${p.time}`, z: p.timeZone, l: p.location.slice(0, 300) });
  return `/api/calendrier?${q}`;
}
