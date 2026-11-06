import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { localePath, type SiteLang } from "@/lib/i18n/config";
import type { SiteDict } from "@/lib/i18n/dict";
import type { SettingsMap } from "@/lib/settings-defaults";
import { whatsappLink } from "@/lib/whatsapp";
import { CookieSettingsLink } from "./CookieConsent";

export function SiteFooter({ settings, t, lang, whatsappLabel = "WhatsApp", cookiesLabel }: { settings: SettingsMap; t: SiteDict["footer"]; lang: SiteLang; tagline?: string; whatsappLabel?: string; cookiesLabel?: string }) {
  const href = (p: string) => localePath(lang, p);
  const { brand, policies } = settings;
  const wa = whatsappLink(brand.whatsapp);
  const socials = [
    { href: brand.facebook, label: "Facebook" },
    { href: brand.pinterest, label: "Pinterest" },
  ].filter((s) => s.href);
  return (
    <footer className="border-t border-line bg-paper">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo variant="full" className="h-14 md:h-16" href={href("/")} />
          {/* Instagram : bande des derniers posts au-dessus du pied de page */}
          {socials.length ? (
            <ul className="mt-5 flex gap-4">
              {socials.map((s) => (
                <li key={s.label}>
                  <a href={s.href} target="_blank" rel="noopener noreferrer" className="text-sm text-forest underline-offset-4 hover:underline">
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <nav aria-label={t.usefulLinks}>
          <p className="eyebrow">{t.discover}</p>
          <ul className="mt-4 space-y-2 text-sm">
            <li><Link href={href("/invitations")} className="hover:text-forest">{t.ourInvitations}</Link></li>
            <li><Link href={href("/#comment-ca-marche")} className="hover:text-forest">{t.howItWorks}</Link></li>
            <li><Link href={href("/#faq")} className="hover:text-forest">{t.faq}</Link></li>
            <li><Link href="/mon-espace" className="hover:text-forest">{t.coupleSpace}</Link></li>
          </ul>
        </nav>
        <div>
          <p className="eyebrow">{t.contact}</p>
          <ul className="mt-4 space-y-2 text-sm">
            {brand.contactEmail ? (
              <li><a href={`mailto:${brand.contactEmail}`} className="hover:text-forest">{brand.contactEmail}</a></li>
            ) : null}
            {wa ? (
              <li><a href={wa} target="_blank" rel="noopener noreferrer" className="hover:text-forest">{whatsappLabel} · <bdi dir="ltr">{brand.whatsapp}</bdi></a></li>
            ) : null}
            {brand.contactPhone ? (
              <li><a href={`tel:${brand.contactPhone.replace(/\s/g, "")}`} className="hover:text-forest">{brand.contactPhone}</a></li>
            ) : null}
            <li><Link href={href("/mentions-legales")} className="hover:text-forest">{t.legal}</Link></li>
            <li><Link href={href("/confidentialite")} className="hover:text-forest">{t.privacy}</Link></li>
            {policies.termsOfSale ? (
              <li><Link href={href("/cgv")} className="hover:text-forest">{t.terms}</Link></li>
            ) : null}
            {cookiesLabel ? (
              <li><CookieSettingsLink label={cookiesLabel} className="text-start hover:text-forest" /></li>
            ) : null}
          </ul>
        </div>
      </div>
      <p className="border-t border-line px-5 py-5 text-center text-xs text-stone">
        © {new Date().getFullYear()} {brand.name}. {t.rights}
      </p>
    </footer>
  );
}
