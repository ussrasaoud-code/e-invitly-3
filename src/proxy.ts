import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { LANG_COOKIE, isSitePath, splitLocale } from "@/lib/i18n/config";

/** Pays du visiteur fourni par l'hébergeur (Netlify, Cloudflare ou Vercel). Rien n'est enregistré. */
function visitorCountry(request: NextRequest): string {
  const h = request.headers;
  const direct = h.get("x-country") || h.get("cf-ipcountry") || h.get("x-vercel-ip-country");
  if (direct) return direct.slice(0, 2).toUpperCase();
  const nf = h.get("x-nf-geo");
  if (nf) {
    try {
      const geo = JSON.parse(atob(nf)) as { country?: { code?: string } };
      if (geo.country?.code) return geo.country.code.slice(0, 2).toUpperCase();
    } catch {
      /* format inattendu : pays inconnu */
    }
  }
  return "";
}

/**
 * 1. Langue du site vitrine : /en/invitations est servi par la page /invitations
 *    avec la langue « en » (en-têtes x-site-lang / x-site-path).
 * 2. Rafraîchit la session Supabase et protège /admin et /mon-espace.
 *    La vérification des RÔLES se fait ensuite côté serveur (requireStaff).
 */
export async function proxy(request: NextRequest) {
  const { lang, path, prefixed } = splitLocale(request.nextUrl.pathname);
  const site = prefixed || isSitePath(path);

  const headers = new Headers(request.headers);
  for (const h of ["x-site-lang", "x-site-path", "x-site-prefixed", "x-site-country", "x-site-cookie-lang"]) headers.delete(h);
  if (site) {
    headers.set("x-site-lang", lang);
    headers.set("x-site-path", path + request.nextUrl.search);
    headers.set("x-site-prefixed", prefixed ? "1" : "0");
    headers.set("x-site-country", visitorCountry(request));
    headers.set("x-site-cookie-lang", request.cookies.get(LANG_COOKIE)?.value ?? "");
  }
  const make = () => {
    if (prefixed) {
      const url = request.nextUrl.clone();
      url.pathname = path;
      return NextResponse.rewrite(url, { request: { headers } });
    }
    return NextResponse.next({ request: { headers } });
  };
  let response = make();

  const needsSession = path.startsWith("/admin") || path.startsWith("/mon-espace") || path === "/connexion" || path.startsWith("/auth");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!needsSession || !url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = make();
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const isPrivate = path.startsWith("/admin") || path.startsWith("/mon-espace");

  if (isPrivate && !data.user) {
    const login = request.nextUrl.clone();
    login.pathname = "/connexion";
    login.search = `?suite=${encodeURIComponent(path)}`;
    return NextResponse.redirect(login);
  }
  return response;
}

export const config = {
  // Toutes les pages, sauf les fichiers statiques et les routes techniques
  matcher: ["/((?!_next/|api/|favicon|icon|apple-icon|robots.txt|sitemap.xml|templates/|decor/|.*\\.[a-z0-9]{2,5}$).*)"],
};
