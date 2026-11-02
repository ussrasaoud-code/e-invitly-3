import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/mon-espace", "/apercu", "/api", "/auth", "/personnalisation", "/connexion", "/demo", "/*/personnalisation", "/*/connexion", "/*/demo"] },
    sitemap: new URL("/sitemap.xml", env.siteUrl).toString(),
  };
}
