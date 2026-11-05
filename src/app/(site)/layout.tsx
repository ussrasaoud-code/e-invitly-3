import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LangProvider } from "@/components/site/LangContext";
import { LangSuggest } from "@/components/site/LangSuggest";
import { SiteFooter } from "@/components/site/SiteFooter";
import { WhatsAppFab } from "@/components/contact/WhatsAppFab";
import { SiteHeader } from "@/components/site/SiteHeader";
import { CookieConsent } from "@/components/site/CookieConsent";
import { InstagramStrip } from "@/components/site/InstagramStrip";
import { getCurrentUser } from "@/lib/auth";
import { LANG_META, localePath } from "@/lib/i18n/config";
import { dictFor, getDict, getEnabledLangs, getSiteRequest } from "@/lib/i18n/server";
import { getSettings } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  const { lang, t } = await getDict();
  return {
    title: { default: t.meta.title, template: "%s · E-Invitly" },
    description: t.meta.description,
    openGraph: { siteName: "E-Invitly", locale: LANG_META[lang].og, type: "website" },
  };
}

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [settings, req, enabled] = await Promise.all([getSettings(), getSiteRequest(), getEnabledLangs()]);

  // Langue déjà choisie par le visiteur : le site s'ouvre directement dans cette langue
  if (!req.prefixed && req.cookieLang && req.cookieLang !== "fr" && enabled.includes(req.cookieLang)) {
    redirect(localePath(req.cookieLang, req.path));
  }
  // Langue pas encore ouverte : visible uniquement par l'équipe (relecture)
  let staffPreview = false;
  if (!enabled.includes(req.lang)) {
    const user = await getCurrentUser();
    if (user && user.role !== "client") staffPreview = true;
    else redirect(req.path);
  }

  const t = dictFor(req.lang);
  const tracking = !!(settings.analytics.gaId || settings.analytics.metaPixelId);
  const bannerTexts = Object.fromEntries(enabled.map((l) => [l, dictFor(l).banner]));
  return (
    <LangProvider value={{ lang: req.lang, enabled: staffPreview ? [...enabled, req.lang] : enabled, path: req.path }}>
      <a href="#contenu" className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:bg-white focus:px-4 focus:py-2">
        {t.nav.skip}
      </a>
      {staffPreview ? (
        <p role="status" className="bg-warning/15 px-5 py-2 text-center text-sm">{t.preview.hidden}</p>
      ) : null}
      <LangSuggest country={req.country} hasChoice={!!req.cookieLang} texts={bannerTexts} />
      <SiteHeader t={t.nav} />
      <div id="contenu">{children}</div>
      {/* Derniers posts Instagram (si le compte est connecté), sauf pendant la commande et le paiement */}
      {!/\/(personnalisation|paiement)(\/|$)/.test(req.path) ? <InstagramStrip t={t.instagram} profileUrl={settings.brand.instagram} /> : null}
      <SiteFooter settings={settings} t={t.footer} lang={req.lang} tagline={req.lang === "fr" ? settings.brand.tagline : t.meta.tagline} whatsappLabel={t.contact.whatsapp} cookiesLabel={tracking ? t.cookies.manage : undefined} />
      <WhatsAppFab number={settings.brand.whatsapp} label={t.contact.fab} message={t.contact.siteMessage} />
      {/* Outils de mesure : seulement s'ils sont configurés (Admin → Paramètres), et après accord du visiteur */}
      {tracking ? <CookieConsent gaId={settings.analytics.gaId} pixelId={settings.analytics.metaPixelId} t={t.cookies} privacyHref={localePath(req.lang, "/confidentialite")} /> : null}
    </LangProvider>
  );
}
