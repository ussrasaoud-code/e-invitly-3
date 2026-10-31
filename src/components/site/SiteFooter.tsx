import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import type { SettingsMap } from "@/lib/settings-defaults";

export function SiteFooter({ settings }: { settings: SettingsMap }) {
  const { brand, policies } = settings;
  const socials = [
    { href: brand.instagram, label: "Instagram" },
    { href: brand.facebook, label: "Facebook" },
    { href: brand.pinterest, label: "Pinterest" },
  ].filter((s) => s.href);
  return (
    <footer className="border-t border-line bg-paper">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo variant="full" className="h-14 md:h-16" />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-stone">{brand.tagline}</p>
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
        <nav aria-label="Liens utiles">
          <p className="eyebrow">Découvrir</p>
          <ul className="mt-4 space-y-2 text-sm">
            <li><Link href="/invitations" className="hover:text-forest">Nos invitations</Link></li>
            <li><Link href="/#comment-ca-marche" className="hover:text-forest">Comment ça marche</Link></li>
            <li><Link href="/#faq" className="hover:text-forest">Questions fréquentes</Link></li>
            <li><Link href="/mon-espace" className="hover:text-forest">Espace mariés</Link></li>
          </ul>
        </nav>
        <div>
          <p className="eyebrow">Contact</p>
          <ul className="mt-4 space-y-2 text-sm">
            {brand.contactEmail ? (
              <li><a href={`mailto:${brand.contactEmail}`} className="hover:text-forest">{brand.contactEmail}</a></li>
            ) : null}
            {brand.contactPhone ? (
              <li><a href={`tel:${brand.contactPhone.replace(/\s/g, "")}`} className="hover:text-forest">{brand.contactPhone}</a></li>
            ) : null}
            <li><Link href="/mentions-legales" className="hover:text-forest">Mentions légales</Link></li>
            <li><Link href="/confidentialite" className="hover:text-forest">Confidentialité</Link></li>
            {policies.termsOfSale ? (
              <li><Link href="/cgv" className="hover:text-forest">Conditions générales de vente</Link></li>
            ) : null}
          </ul>
        </div>
      </div>
      <p className="border-t border-line px-5 py-5 text-center text-xs text-stone">
        © {new Date().getFullYear()} {brand.name}. Tous droits réservés.
      </p>
    </footer>
  );
}
