import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

// Bloque les espaces privés/transactionnels (sans valeur SEO et susceptibles de
// fuiter des données : panier, suivi, compte, admin) et pointe le sitemap. Les
// motifs `/*/…` couvrent les 4 préfixes de langue (/fr/admin, /de/admin, …).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/*/admin",
        "/*/account",
        "/*/checkout",
        "/*/cart",
        "/*/track",
        "/api/",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
