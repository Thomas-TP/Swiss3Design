import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

// Bloque les espaces privés/transactionnels (sans valeur SEO et susceptibles de
// fuiter des données : panier, suivi, compte, admin) et pointe le sitemap. Les
// motifs `/*/…` couvrent les 4 préfixes de langue (/fr/admin, /de/admin, …).
//
// Facettes du catalogue : chaque combinaison tri × matière × couleur ×
// recherche crée une URL (plus de 100 crawlées par Ahrefs pour UN produit),
// toutes canonicalisées vers /shop. On les ferme au crawl, comme le recommande
// Google pour la navigation à facettes ; seul ?category= reste explorable
// (lien d'entrée vers les produits). `color=` couvre aussi `multicolor=`.
//
// Aucun groupe dédié aux robots IA (GPTBot, ClaudeBot, PerplexityBot…) : un
// groupe nommé ferait ignorer au robot les règles de `*`. Ils suivent donc
// exactement les mêmes règles que Google — visibles dans les moteurs de
// réponse, sans accès aux espaces privés.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/api/files/products/"],
      disallow: [
        "/*/admin",
        "/*/account",
        "/*/checkout",
        "/*/cart",
        "/*/track",
        "/*/favorites",
        "/*?*sort=",
        "/*?*material=",
        "/*?*color=",
        "/*?*q=",
        "/api/",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
