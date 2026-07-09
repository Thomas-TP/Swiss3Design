import { routing, type Locale } from "@/i18n/routing";

// URL canonique de production. Les `metadataBase` du layout résout déjà les
// chemins relatifs des métadonnées Open Graph ; on garde l'absolu ici pour le
// JSON-LD (qui exige des URL complètes) et le sitemap.
export const SITE_URL = "https://swiss3design.ch";

/**
 * Construit les liens alternatifs hreflang pour une page donnée.
 *
 * Le `slug` produit et tous les chemins sont **identiques d'une langue à
 * l'autre** (seul le préfixe /fr /de /it /en change), donc une seule fonction
 * couvre toutes les pages. `x-default` pointe le repli français.
 *
 * @param locale langue de la page courante (pour le canonical)
 * @param path   chemin SANS préfixe de langue, ex. "" (accueil), "/shop",
 *               "/products/mon-slug"
 */
export function alternatesFor(locale: Locale, path = "") {
  const languages: Record<string, string> = {};
  for (const l of routing.locales) languages[l] = `/${l}${path}`;
  languages["x-default"] = `/${routing.defaultLocale}${path}`;
  return { canonical: `/${locale}${path}`, languages };
}

// Données structurées de l'entreprise (rich results Google : nom, logo, zone
// desservie, adresse Gland VD). Posé une fois dans le layout localisé.
export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "OnlineStore",
    name: "Swiss3Design",
    url: SITE_URL,
    logo: `${SITE_URL}/brand/logo.png`,
    image: `${SITE_URL}/brand/social/og-image.png`,
    email: "contact@swiss3design.ch",
    areaServed: { "@type": "Country", name: "Switzerland" },
    address: {
      "@type": "PostalAddress",
      addressLocality: "Gland",
      addressRegion: "VD",
      addressCountry: "CH",
    },
    currenciesAccepted: "CHF",
  };
}

export interface ProductJsonLdInput {
  slug: string;
  name: string;
  description: string;
  priceCents: number;
  saleType: "stock" | "on_demand";
  stock: number | null;
  material: string;
  imageUrls: string[]; // chemins relatifs (/api/files/…) ou absolus
}

// Données structurées d'un produit (prix, devise, disponibilité) → éligibilité
// aux résultats enrichis « produit » de Google. Les disponibilités suivent le
// modèle de vente : rupture > impression à la demande > en stock.
export function productJsonLd(
  p: ProductJsonLdInput,
  locale: Locale,
  rating?: { count: number; average: number },
) {
  const availability =
    p.stock != null && p.stock <= 0
      ? "https://schema.org/OutOfStock"
      : p.saleType === "on_demand"
        ? "https://schema.org/MadeToOrder"
        : "https://schema.org/InStock";

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description: p.description,
    image: p.imageUrls.map((u) =>
      u.startsWith("http") ? u : `${SITE_URL}${u}`,
    ),
    material: p.material,
    brand: { "@type": "Brand", name: "Swiss3Design" },
    // Note agrégée (avis publiés) → étoiles dans les résultats Google.
    ...(rating && rating.count > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: rating.average.toFixed(1),
            reviewCount: rating.count,
          },
        }
      : {}),
    offers: {
      "@type": "Offer",
      url: `${SITE_URL}/${locale}/products/${p.slug}`,
      price: (p.priceCents / 100).toFixed(2),
      priceCurrency: "CHF",
      availability,
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@type": "Organization", name: "Swiss3Design" },
    },
  };
}
