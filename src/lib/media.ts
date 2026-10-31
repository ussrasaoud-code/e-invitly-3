/**
 * Bibliothèque de médias : formats acceptés, tailles maximales, collections.
 * Partagé entre le navigateur (vérification immédiate) et le serveur (qui fait foi).
 */

export type MediaKind = "image" | "svg" | "video" | "audio";

export const MEDIA_TYPES: Record<string, { kind: MediaKind; ext: string; maxBytes: number }> = {
  "image/png": { kind: "image", ext: "png", maxBytes: 10 * 1024 * 1024 },
  "image/jpeg": { kind: "image", ext: "jpg", maxBytes: 10 * 1024 * 1024 },
  "image/webp": { kind: "image", ext: "webp", maxBytes: 10 * 1024 * 1024 },
  "image/svg+xml": { kind: "svg", ext: "svg", maxBytes: 2 * 1024 * 1024 },
  "video/mp4": { kind: "video", ext: "mp4", maxBytes: 15 * 1024 * 1024 },
  "video/webm": { kind: "video", ext: "webm", maxBytes: 15 * 1024 * 1024 },
  "audio/mpeg": { kind: "audio", ext: "mp3", maxBytes: 15 * 1024 * 1024 },
  "audio/mp4": { kind: "audio", ext: "m4a", maxBytes: 15 * 1024 * 1024 },
  "audio/x-m4a": { kind: "audio", ext: "m4a", maxBytes: 15 * 1024 * 1024 },
  "audio/ogg": { kind: "audio", ext: "ogg", maxBytes: 15 * 1024 * 1024 },
};

export const ACCEPT_ATTRIBUTE = Object.keys(MEDIA_TYPES).join(",") + ",.svg,.m4a,.mp3";

export const KIND_LABELS: Record<MediaKind, string> = {
  image: "Image",
  svg: "Illustration vectorielle (SVG)",
  video: "Vidéo",
  audio: "Musique",
};

export const DEFAULT_COLLECTIONS = [
  "Fleurs",
  "Feuillages",
  "Colombes et oiseaux",
  "Arches",
  "Textures",
  "Enveloppes",
  "Cachets de cire",
  "Photos",
  "Vidéos d'ouverture",
  "Musiques",
  "Divers",
];

/** Navigateurs qui annoncent un type vide ou approximatif : on déduit de l'extension. */
export function guessMime(name: string, type: string): string {
  if (type && MEDIA_TYPES[type]) return type;
  const ext = name.toLowerCase().split(".").pop() ?? "";
  const byExt: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", svg: "image/svg+xml", mp4: "video/mp4", webm: "video/webm", mp3: "audio/mpeg", m4a: "audio/mp4", ogg: "audio/ogg" };
  return byExt[ext] ?? type;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} Ko`;
  return `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} Mo`;
}

/** Un SVG ne doit contenir ni script, ni gestionnaire d'événement, ni contenu externe. */
export function isSafeSvg(text: string): boolean {
  const t = text.toLowerCase();
  return !(
    /<script/.test(t) ||
    /\son[a-z]+\s*=/.test(t) ||
    /javascript:/.test(t) ||
    /<foreignobject/.test(t) ||
    /<iframe|<embed|<object/.test(t) ||
    /xlink:href\s*=\s*["']?\s*(https?:|data:text)/.test(t) ||
    /<!entity/.test(t)
  );
}

export type MediaItem = {
  id: string;
  name: string;
  kind: MediaKind;
  url: string;
  mime_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  collection: string;
  tags: string[];
  license_note: string | null;
  created_at: string;
};
