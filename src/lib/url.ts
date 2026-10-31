/**
 * Adresse d'image, de vidéo ou de musique acceptée : https, chemin du site,
 * ou (en développement seulement) le stockage local http://127.0.0.1.
 */
export function isAllowedAssetUrl(v: string): boolean {
  if (v === "") return true;
  if (v.startsWith("/") && !v.startsWith("//")) return true;
  if (/^https:\/\/[^\s"'<>]+$/.test(v)) return true;
  return process.env.NODE_ENV !== "production" && /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(v);
}
