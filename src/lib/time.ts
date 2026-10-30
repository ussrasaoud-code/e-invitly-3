/**
 * Dates et fuseaux horaires sans dépendance externe.
 * Une date d'événement est saisie en heure LOCALE du lieu
 * (« 2027-06-12T15:30 » à Europe/Paris) puis convertie en instant UTC,
 * ce qui rend le compte à rebours juste pour un invité à l'étranger.
 */

function offsetMs(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/** « 2027-06-12T15:30 » + « Europe/Paris » → Date (instant UTC). */
export function zonedToUtc(local: string, timeZone: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) return null;
  const naive = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  try {
    let guess = naive - offsetMs(naive, timeZone);
    guess = naive - offsetMs(guess, timeZone); // second passage : changements d'heure
    return new Date(guess);
  } catch {
    return null; // fuseau inconnu
  }
}

const LOCALES = { fr: "fr-FR", en: "en-GB", ar: "ar-MA" } as const;
export type Lang = keyof typeof LOCALES;

/** « samedi 12 juin 2027 » dans la langue de l'invitation. */
export function formatLongDate(local: string, lang: Lang = "fr"): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(local);
  if (!m) return "";
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12));
  return new Intl.DateTimeFormat(LOCALES[lang], { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(d);
}

/** « 12 . 06 . 2027 » */
export function formatDotDate(local: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(local);
  return m ? `${m[3]} · ${m[2]} · ${m[1]}` : "";
}

/** « 15h30 » (fr) ou « 15:30 » */
export function formatTime(hhmm: string, lang: Lang = "fr"): string {
  if (!/^\d{2}:\d{2}$/.test(hhmm)) return hhmm;
  return lang === "fr" ? hhmm.replace(":", "h") : hhmm;
}

/** Date courte pour l'administration : 12/06/2027 */
export function formatShortDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value.length === 10 ? `${value}T12:00:00Z` : value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Paris" }).format(d);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  }).format(d);
}

export function relativeFromNow(value: string): string {
  const diff = (new Date(value).getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day");
  return formatShortDate(value);
}
