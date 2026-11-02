import type { SiteDict } from "@/lib/i18n/dict";
import { fmt } from "@/lib/i18n/config";
import type { BrandSettings } from "@/lib/settings-defaults";
import { whatsappLink } from "@/lib/whatsapp";
import { WhatsAppIcon } from "./WhatsAppIcon";

/** Encadré « Une question, une modification ? » de l'espace mariés. */
export function CoupleHelp({ brand, t, couple }: { brand: BrandSettings; t: SiteDict["contact"]; couple?: string }) {
  const wa = whatsappLink(brand.whatsapp, couple ? fmt(t.coupleMessage, { couple }) : t.siteMessage);
  if (!wa && !brand.contactEmail) return null;
  return (
    <section aria-labelledby="aide-titre" className="card mt-10 p-6">
      <h2 id="aide-titre" className="font-serif text-2xl">{t.helpTitle}</h2>
      <p className="mt-2 text-sm text-stone">{t.helpText}</p>
      <div className="mt-4 flex flex-wrap gap-3">
        {wa ? (
          <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-sm inline-flex items-center gap-2 bg-[#25D366] text-white hover:brightness-95">
            <WhatsAppIcon /> {t.whatsapp}
          </a>
        ) : null}
        {brand.contactEmail ? (
          <a href={`mailto:${brand.contactEmail}`} className="btn btn-secondary btn-sm" dir="ltr">
            {t.email} · {brand.contactEmail}
          </a>
        ) : null}
      </div>
    </section>
  );
}
