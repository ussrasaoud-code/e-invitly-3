import type { Metadata, Viewport } from "next";
import "@fontsource/aboreto/latin-400.css";
import "@fontsource/dancing-script/latin-400.css";
import "@fontsource-variable/jost/index.css";
import "@fontsource/cormorant-garamond/latin-400.css";
import "@fontsource/cormorant-garamond/latin-400-italic.css";
import "@fontsource/cormorant-garamond/latin-500.css";
import "./globals.css";
import { env } from "@/lib/env";

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
