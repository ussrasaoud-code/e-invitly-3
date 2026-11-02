/** Accepte « @compte », « compte » ou un lien, et renvoie le lien du profil. */
export function instagramUrl(v: string): string {
  const s = v.trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s.replace(/^http:/i, "https:");
  const handle = s.replace(/^@/, "").replace(/^(www\.)?instagram\.com\//i, "").replace(/\/+$/, "");
  return /^[\w.]{1,30}$/.test(handle) ? `https://www.instagram.com/${handle}/` : s;
}

/** « @compte » à partir d'un lien de profil Instagram (sinon null). */
export function instagramHandle(url: string): string | null {
  const m = url.match(/instagram\.com\/([\w.]{1,30})\/?(?:[?#].*)?$/i);
  return m ? `@${m[1]}` : null;
}
