import { routing } from "@/i18n/routing";
import { getSitemapProducts } from "@/db/queries";
import { SITE_URL } from "@/lib/seo";
import { LEGAL_UPDATED } from "../[locale]/legal/legal-layout";

// Sitemap écrit à la main plutôt que via la convention app/sitemap.ts : le
// générateur de Next place <lastmod> APRÈS les xhtml:link / image:image, alors
// que le schéma sitemaps.org impose loc → lastmod → extensions. Google tolère,
// des validateurs stricts non ; ici l'ordre est celui du XSD.
//
// Lu en direct depuis Postgres à chaque requête → le sitemap reflète toujours
// le catalogue réel (un nouveau produit y apparaît, un produit
// désactivé/supprimé en disparaît) sans régénération manuelle.
export const dynamic = "force-dynamic";

// Pages statiques indexables, sans préfixe de langue (ajouté par locale), avec
// leur date de mise à jour quand elle est connue avec certitude (un <lastmod>
// approximatif fait perdre sa confiance à Google, autant l'omettre).
const STATIC_PAGES: { path: string; lastModified?: string }[] = [
  { path: "" },
  { path: "/shop" },
  { path: "/custom" },
  { path: "/a-propos" },
  { path: "/contact" },
  { path: "/legal/terms", lastModified: LEGAL_UPDATED.terms },
  { path: "/legal/privacy", lastModified: LEGAL_UPDATED.privacy },
  { path: "/legal/shipping", lastModified: LEGAL_UPDATED.shipping },
];

const escapeXml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const abs = (url: string) =>
  url.startsWith("http") ? url : `${SITE_URL}${url}`;

// Une entrée PAR LANGUE (chaque version doit figurer en <loc>, sinon Ahrefs la
// signale « indexable mais absente du sitemap »), chacune listant le jeu
// complet de hreflang — elle-même comprise — plus x-default (repli français),
// à l'identique des <link rel="alternate"> du <head> (lib/seo.ts).
function urlEntries(
  path: string,
  {
    lastModified,
    images = [],
  }: { lastModified?: Date | string; images?: string[] },
): string[] {
  const alternates = [
    ...routing.locales.map((l) => [l, `${SITE_URL}/${l}${path}`]),
    ["x-default", `${SITE_URL}/${routing.defaultLocale}${path}`],
  ]
    .map(
      ([hreflang, href]) =>
        `<xhtml:link rel="alternate" hreflang="${hreflang}" href="${escapeXml(href)}"/>`,
    )
    .join("");
  const lastmod = lastModified
    ? `<lastmod>${new Date(lastModified).toISOString()}</lastmod>`
    : "";
  const imageTags = images
    .map(
      (src) =>
        `<image:image><image:loc>${escapeXml(abs(src))}</image:loc></image:image>`,
    )
    .join("");
  return routing.locales.map(
    (l) =>
      `<url><loc>${escapeXml(`${SITE_URL}/${l}${path}`)}</loc>${lastmod}${alternates}${imageTags}</url>`,
  );
}

export async function GET() {
  const items = await getSitemapProducts();
  // Catalogue et accueil changent quand un produit arrive : leur <lastmod>
  // suit le produit le plus récent.
  const newest = items[0]?.createdAt;
  const urls = [
    ...STATIC_PAGES.flatMap(({ path, lastModified }) =>
      urlEntries(path, {
        lastModified:
          lastModified ??
          (path === "" || path === "/shop" ? newest : undefined),
      }),
    ),
    ...items.flatMap((p) =>
      urlEntries(`/products/${p.slug}`, {
        lastModified: p.createdAt,
        images: p.images,
      }),
    ),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.join("\n")}
</urlset>
`;
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
