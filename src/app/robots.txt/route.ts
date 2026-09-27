import { PATHS, abs } from "@/lib/agent/config";
import { SITE_URL } from "@/lib/seo";

// robots.txt écrit à la main (et non via app/robots.ts) : le format de Next
// ne sait pas émettre Content-Signal ni Agentmap.
//
// Bloque les espaces privés/transactionnels (sans valeur SEO et susceptibles
// de fuiter des données : panier, suivi, compte, admin) et pointe le sitemap.
// Les motifs `/*/…` couvrent les 4 préfixes de langue (/fr/admin, …).
//
// Facettes du catalogue : chaque combinaison tri × matière × couleur ×
// recherche crée une URL (plus de 100 crawlées par Ahrefs pour UN produit),
// toutes canonicalisées vers /shop. On les ferme au crawl, comme le recommande
// Google pour la navigation à facettes ; seul ?category= reste explorable.
// `color=` couvre aussi `multicolor=`.
//
// Aucun groupe dédié aux robots IA (GPTBot, ClaudeBot, PerplexityBot…) : un
// groupe nommé ferait ignorer au robot les règles de `*`. Ils suivent donc
// exactement les mêmes règles que Google.
//
// Content-Signal (contentsignals.org) : recherche, réponses d'IA et
// entraînement autorisés — la boutique veut être connue et citée par les
// assistants. Passer ai-train=no suffirait à refuser l'entraînement.
// Agentmap : pointe le catalogue ARD (ce que les agents peuvent utiliser ici).
// /api/v1/ reste ouvert (API publique pour agents) ; le reste de /api/ non.
export function GET() {
  const body = `# Swiss3Design — ${SITE_URL}
# AI agents: ${abs(PATHS.agentsDoc)} · ${abs(PATHS.llms)}

User-agent: *
Content-Signal: search=yes, ai-input=yes, ai-train=yes
Allow: /
Allow: /api/files/products/
Allow: /api/v1/
Disallow: /*/admin
Disallow: /*/account
Disallow: /*/checkout
Disallow: /*/cart
Disallow: /*/track
Disallow: /*/favorites
Disallow: /*?*sort=
Disallow: /*?*material=
Disallow: /*?*color=
Disallow: /*?*q=
Disallow: /api/

Agentmap: ${abs(PATHS.aiCatalog)}
Host: ${SITE_URL}
Sitemap: ${SITE_URL}/sitemap.xml
`;
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
