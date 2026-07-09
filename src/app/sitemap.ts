import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { getSitemapProducts } from "@/db/queries";
import { SITE_URL } from "@/lib/seo";

// Lu en direct depuis D1 à chaque requête → le sitemap reflète toujours le
// catalogue réel (un nouveau produit y apparaît, un produit désactivé/supprimé
// en disparaît) sans régénération manuelle.
export const dynamic = "force-dynamic";

// Pages statiques indexables, sans préfixe de langue (ajouté par locale).
const STATIC_PATHS = [
  "",
  "/shop",
  "/custom",
  "/a-propos",
  "/legal/terms",
  "/legal/privacy",
];

// Une entrée par page, avec ses variantes hreflang (fr/de/it/en). L'URL
// principale pointe le repli français ; `alternates.languages` liste les 4.
function entry(
  path: string,
  lastModified?: Date,
): MetadataRoute.Sitemap[number] {
  const languages: Record<string, string> = {};
  for (const l of routing.locales) languages[l] = `${SITE_URL}/${l}${path}`;
  return {
    url: `${SITE_URL}/${routing.defaultLocale}${path}`,
    lastModified,
    alternates: { languages },
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const items = await getSitemapProducts();
  return [
    ...STATIC_PATHS.map((p) => entry(p)),
    ...items.map((p) => entry(`/products/${p.slug}`, p.createdAt)),
  ];
}
