import type { Metadata, Viewport } from "next";
import "@fontsource/aboreto/latin-400.css";
import "@fontsource/dancing-script/latin-400.css";
import "@fontsource-variable/jost/index.css";
import "@fontsource/cormorant-garamond/latin-400.css";
import "@fontsource/cormorant-garamond/latin-400-italic.css";
import "@fontsource/cormorant-garamond/latin-500.css";
import "@fontsource/playfair-display/latin-400.css";
import "@fontsource/playfair-display/latin-400-italic.css";
import "@fontsource/italiana/latin-400.css";
import "@fontsource/lora/latin-400.css";
import "@fontsource/montserrat/latin-400.css";
import "@fontsource/great-vibes/latin-400.css";
import "@fontsource/pinyon-script/latin-400.css";
import "@fontsource/parisienne/latin-400.css";
// Gras et italique (les polices calligraphiques n'en ont pas : le navigateur les simule)
import "@fontsource-variable/jost/wght-italic.css";
import "@fontsource/dancing-script/latin-700.css";
import "@fontsource/cormorant-garamond/latin-700.css";
import "@fontsource/cormorant-garamond/latin-700-italic.css";
import "@fontsource/playfair-display/latin-700.css";
import "@fontsource/playfair-display/latin-700-italic.css";
import "@fontsource/montserrat/latin-700.css";
import "@fontsource/montserrat/latin-400-italic.css";
import "@fontsource/montserrat/latin-700-italic.css";
import "@fontsource/lora/latin-700.css";
import "@fontsource/lora/latin-400-italic.css";
import "@fontsource/lora/latin-700-italic.css";
import "@fontsource/amiri/400.css";
import "@fontsource/amiri/700.css";
import "@fontsource/ibm-plex-sans-arabic/arabic-400.css";
import "@fontsource/ibm-plex-sans-arabic/arabic-500.css";
import "@fontsource/cinzel/latin-400.css";
import "@fontsource/cinzel/latin-600.css";
import "@fontsource/cinzel-decorative/latin-400.css";
import "@fontsource/bodoni-moda/latin-400.css";
import "@fontsource/bodoni-moda/latin-400-italic.css";
import "@fontsource/bodoni-moda/latin-700.css";
import "@fontsource/marcellus/latin-400.css";
import "@fontsource/prata/latin-400.css";
import "@fontsource/dm-serif-display/latin-400.css";
import "@fontsource/dm-serif-display/latin-400-italic.css";
import "@fontsource/gilda-display/latin-400.css";
import "@fontsource/bellefair/latin-400.css";
import "@fontsource/forum/latin-400.css";
import "@fontsource/allura/latin-400.css";
import "@fontsource/alex-brush/latin-400.css";
import "@fontsource/sacramento/latin-400.css";
import "@fontsource/tangerine/latin-400.css";
import "@fontsource/tangerine/latin-700.css";
import "@fontsource/mrs-saint-delafield/latin-400.css";
import "@fontsource/italianno/latin-400.css";
import "@fontsource/petit-formal-script/latin-400.css";
import "@fontsource/monsieur-la-doulaise/latin-400.css";
import "@fontsource/rouge-script/latin-400.css";
import "@fontsource/windsong/latin-400.css";
import "@fontsource/corinthia/latin-400.css";
import "@fontsource/eb-garamond/latin-400.css";
import "@fontsource/eb-garamond/latin-400-italic.css";
import "@fontsource/eb-garamond/latin-700.css";
import "@fontsource/libre-baskerville/latin-400.css";
import "@fontsource/libre-baskerville/latin-400-italic.css";
import "@fontsource/libre-baskerville/latin-700.css";
import "@fontsource/raleway/latin-400.css";
import "@fontsource/raleway/latin-400-italic.css";
import "@fontsource/raleway/latin-700.css";
import "@fontsource/josefin-sans/latin-400.css";
import "@fontsource/josefin-sans/latin-400-italic.css";
import "@fontsource/josefin-sans/latin-700.css";
import "@fontsource/poppins/latin-400.css";
import "@fontsource/poppins/latin-400-italic.css";
import "@fontsource/poppins/latin-700.css";
import "@fontsource/quicksand/latin-400.css";
import "@fontsource/quicksand/latin-700.css";
import "@fontsource/tenor-sans/latin-400.css";
import "@fontsource/aref-ruqaa/400.css";
import "@fontsource/aref-ruqaa/700.css";
import "@fontsource/reem-kufi/400.css";
import "@fontsource/reem-kufi/700.css";
import "@fontsource/el-messiri/400.css";
import "@fontsource/el-messiri/700.css";
import "@fontsource/scheherazade-new/400.css";
import "@fontsource/scheherazade-new/700.css";
import "@fontsource/lateef/400.css";
import "@fontsource/lateef/700.css";
import "@fontsource/mirza/400.css";
import "@fontsource/mirza/700.css";
import "@fontsource/marhey/400.css";
import "@fontsource/marhey/700.css";
import "@fontsource/rakkas/400.css";
import "@fontsource/cairo/400.css";
import "@fontsource/cairo/700.css";
import "@fontsource/tajawal/400.css";
import "@fontsource/tajawal/700.css";
import "./globals.css";
import { env } from "@/lib/env";
import { LANG_META } from "@/lib/i18n/config";
import { getSiteLang } from "@/lib/i18n/server";

/** Toutes les pages lisent la base en direct (modèles, paramètres, invitations). */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  metadataBase: new URL(env.siteUrl),
  title: { default: "E-Invitly — Invitations digitales élégantes", template: "%s · E-Invitly" },
  description:
    "Invitations digitales interactives et personnalisées pour vos mariages et événements : programme, lieux, compte à rebours et RSVP intégré.",
  openGraph: { siteName: "E-Invitly", locale: "fr_FR", type: "website" },
};

export const viewport: Viewport = {
  themeColor: "#FAF8F4",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getSiteLang();
  return (
    <html lang={lang} dir={LANG_META[lang].dir}>
      <body>{children}</body>
    </html>
  );
}
