/**
 * Images allégées : les photos et décors téléversés (souvent des PNG de 1 à 3 Mo)
 * passent par le service d'images de Netlify, qui les redimensionne à la taille
 * affichée et les convertit en WebP (transparence conservée). Les fichiers d'origine
 * ne changent pas. Hors Netlify (tests locaux), l'adresse d'origine est gardée.
 */
const STEPS = [160, 240, 320, 480, 640, 800, 960, 1200, 1600];
const STORAGE = /^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\//;

export function cdnImage(url: string | null | undefined, displayWidth = 390): string {
  if (!url) return "";
  if (process.env.NEXT_PUBLIC_IMAGE_CDN !== "netlify") return url;
  if (!STORAGE.test(url) || /\.(svg|gif)(\?|#|$)/i.test(url)) return url;
  // Écrans haute densité (x2) et invitation agrandie jusqu'à 480 px de large
  const wanted = Math.ceil(displayWidth * 2 * (480 / 390));
  const w = STEPS.find((s) => s >= wanted) ?? STEPS[STEPS.length - 1];
  return `/.netlify/images?url=${encodeURIComponent(url)}&w=${w}&fm=webp&q=80`;
}

/** Si le service d'images ne répond pas, on revient à l'image d'origine. */
export function cdnFallback(original: string) {
  return (e: { currentTarget: HTMLImageElement }) => {
    const el = e.currentTarget;
    if (original && el.getAttribute("src") !== original) el.src = original;
  };
}
