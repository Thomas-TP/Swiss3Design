import type { Metadata } from "next";
import { isValidElement, type ReactNode } from "react";
import { routing, type Locale } from "@/i18n/routing";

// URL canonique de production. Les `metadataBase` du layout résout déjà les
// chemins relatifs des métadonnées Open Graph ; on garde l'absolu ici pour le
// JSON-LD (qui exige des URL complètes) et le sitemap.
export const SITE_URL = "https://swiss3design.ch";
export const SITE_NAME = "Swiss3Design";
const CONTACT_EMAIL = "contact@swiss3design.ch";

// Identifiants stables des nœuds JSON-LD : chaque page référence la même
// entreprise / le même site par `@id` au lieu de les redéclarer, ce qui donne
// aux moteurs (Google, mais surtout les moteurs IA) une entité unique et nette.
const ORG_ID = `${SITE_URL}/#organization`;
const WEBSITE_ID = `${SITE_URL}/#website`;

// Image de partage par défaut (1200×630, ratio attendu par Open Graph/X).
const DEFAULT_OG_IMAGE = {
  url: "/brand/social/og-image.png",
  width: 1200,
  height: 630,
};

// og:locale au format langue_PAYS : boutique suisse, sauf l'anglais (en_GB,
// la variante que les réseaux sociaux reconnaissent de façon fiable).
const OG_LOCALE: Record<Locale, string> = {
  fr: "fr_CH",
  de: "de_CH",
  it: "it_CH",
  en: "en_GB",
};

// Ne pas indexer (pages privées, transactionnelles ou sans contenu propre),
// mais laisser suivre les liens : le robot repart vers les vraies pages.
export const NOINDEX: Metadata["robots"] = { index: false, follow: true };

/**
 * Construit les liens alternatifs hreflang pour une page donnée.
 *
 * Le `slug` produit et tous les chemins sont **identiques d'une langue à
 * l'autre** (seul le préfixe /fr /de /it /en change), donc une seule fonction
 * couvre toutes les pages. `x-default` pointe le repli français — une URL qui
 * répond 200, jamais la racine « / » qui redirige selon la langue (un hreflang
 * vers une redirection est une erreur pour Ahrefs comme pour Google).
 *
 * C'est la SEULE source de hreflang du site : l'en-tête HTTP `Link` que
 * next-intl ajoute par défaut est coupé (`alternateLinks: false` dans
 * i18n/routing.ts), sinon les deux jeux se contredisent (doublons, x-default
 * sans préfixe de langue en 307).
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

export interface OgImage {
  url: string;
  width?: number;
  height?: number;
  alt?: string;
}

/**
 * Métadonnées complètes d'une page indexable : titre, description, canonical,
 * hreflang, Open Graph (dont og:url) et carte X.
 *
 * Next fusionne les métadonnées des segments de façon SUPERFICIELLE : un
 * `openGraph` déclaré par une page remplace intégralement celui du layout.
 * D'où ce helper, qui redonne à chaque page un jeu Open Graph entier (image,
 * site_name, locale…) — une page qui ne poserait que `openGraph.title`
 * perdrait son image de partage (constaté en audit Ahrefs).
 *
 * @param title titre SANS la marque : le gabarit « %s · Swiss3Design » du
 *              layout l'ajoute (sauf `absoluteTitle`, réservé à l'accueil)
 */
export function pageMetadata({
  locale,
  path,
  title,
  description,
  images,
  imageAlt,
  absoluteTitle = false,
}: {
  locale: Locale;
  path: string;
  title: string;
  description: string;
  images?: OgImage[];
  imageAlt?: string;
  absoluteTitle?: boolean;
}): Metadata {
  const fullTitle = absoluteTitle ? title : `${title} · ${SITE_NAME}`;
  const ogImages =
    images && images.length > 0
      ? images
      : [{ ...DEFAULT_OG_IMAGE, alt: imageAlt ?? SITE_NAME }];
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: alternatesFor(locale, path),
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: OG_LOCALE[locale],
      alternateLocale: routing.locales
        .filter((l) => l !== locale)
        .map((l) => OG_LOCALE[l]),
      url: `/${locale}${path}`,
      title: fullTitle,
      description,
      images: ogImages,
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: ogImages.map((i) => i.url),
    },
  };
}

/**
 * Coupe un texte à `max` caractères sur une frontière de mot (+ « … »). Les
 * descriptions au-delà d'environ 160 caractères sont tronquées par Google de
 * toute façon ; Ahrefs les signale au-delà de 160 et en deçà de 110.
 */
export function clampText(text: string, max = 158): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > 80 ? cut.slice(0, space) : cut).replace(/[\s,;:.—-]+$/, "")}…`;
}

/** Texte brut d'un nœud React (réponses de FAQ en JSX → JSON-LD). */
export function nodeText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join("");
  if (isValidElement<{ children?: ReactNode }>(node))
    return nodeText(node.props.children);
  return "";
}

const abs = (url: string) =>
  url.startsWith("http") ? url : `${SITE_URL}${url}`;

// Politique de retour (miroir de /legal/shipping) : articles de catalogue
// neufs retournables 14 jours, renvoi par la Poste à la charge du client, prix
// de l'article remboursé. Déclarée au niveau de l'entreprise ET de chaque offre
// (Google privilégie l'offre). Propriétés : doc « return policy » de Google.
function returnPolicy(locale: Locale) {
  return {
    "@type": "MerchantReturnPolicy",
    applicableCountry: "CH",
    returnPolicyCountry: "CH",
    returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
    merchantReturnDays: 14,
    returnMethod: "https://schema.org/ReturnByMail",
    returnFees: "https://schema.org/ReturnFeesCustomerResponsibility",
    returnLabelSource: "https://schema.org/ReturnLabelCustomerResponsibility",
    refundType: "https://schema.org/FullRefund",
    itemCondition: "https://schema.org/NewCondition",
    merchantReturnLink: `${SITE_URL}/${locale}/legal/shipping`,
  };
}

/**
 * Entreprise + site (un seul bloc `@graph`, posé une fois dans le layout).
 *
 * `OnlineStore` (sous-type d'Organization) n'accepte PAS les propriétés de
 * LocalBusiness (`currenciesAccepted`, `priceRange`, `openingHours`…) : les
 * y mettre déclenche une erreur de validation schema.org sur toutes les pages.
 */
export function siteJsonLd(locale: Locale, description: string) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "OnlineStore",
        "@id": ORG_ID,
        name: SITE_NAME,
        url: SITE_URL,
        description,
        logo: {
          "@type": "ImageObject",
          url: `${SITE_URL}/brand/logo.png`,
          width: 512,
          height: 512,
        },
        image: `${SITE_URL}${DEFAULT_OG_IMAGE.url}`,
        email: CONTACT_EMAIL,
        address: {
          "@type": "PostalAddress",
          addressLocality: "Gland",
          addressRegion: "VD",
          addressCountry: "CH",
        },
        areaServed: { "@type": "Country", name: "Switzerland" },
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "customer service",
          email: CONTACT_EMAIL,
          areaServed: "CH",
          availableLanguage: ["fr", "de", "it", "en"],
        },
        knowsAbout: [
          "3D printing",
          "Multicolor 3D printing",
          "PLA",
          "PETG",
          "Custom 3D printing",
        ],
        hasMerchantReturnPolicy: returnPolicy(locale),
      },
      {
        "@type": "WebSite",
        "@id": WEBSITE_ID,
        url: SITE_URL,
        name: SITE_NAME,
        inLanguage: routing.locales,
        publisher: { "@id": ORG_ID },
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${SITE_URL}/${locale}/shop?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };
}

/** Fil d'Ariane (BreadcrumbList) — `items` du plus général au plus précis. */
export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  };
}

/**
 * Page de collection (catalogue) + liste de ses produits (ItemList) : aide les
 * moteurs à relier la page aux fiches qu'elle présente.
 */
export function collectionJsonLd({
  locale,
  name,
  description,
  products,
}: {
  locale: Locale;
  name: string;
  description: string;
  products: { slug: string; name: string }[];
}) {
  const url = `${SITE_URL}/${locale}/shop`;
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${url}#webpage`,
    url,
    name,
    description,
    inLanguage: locale,
    isPartOf: { "@id": WEBSITE_ID },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: products.length,
      itemListElement: products.map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${SITE_URL}/${locale}/products/${p.slug}`,
        name: p.name,
      })),
    },
  };
}

/** Page « À propos » / « Contact » rattachée à l'entreprise (entité claire). */
export function webPageJsonLd({
  type,
  locale,
  path,
  name,
  description,
}: {
  type: "AboutPage" | "ContactPage" | "WebPage";
  locale: Locale;
  path: string;
  name: string;
  description: string;
}) {
  const url = `${SITE_URL}/${locale}${path}`;
  return {
    "@context": "https://schema.org",
    "@type": type,
    "@id": `${url}#webpage`,
    url,
    name,
    description,
    inLanguage: locale,
    isPartOf: { "@id": WEBSITE_ID },
    about: { "@id": ORG_ID },
  };
}

/** FAQ visible sur la page → FAQPage (réponses en texte brut). */
export function faqJsonLd(faq: { q: string; a: ReactNode }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: nodeText(item.a).replace(/\s+/g, " ").trim(),
      },
    })),
  };
}

/** Service d'impression 3D sur mesure (page devis). */
export function customServiceJsonLd({
  locale,
  name,
  description,
}: {
  locale: Locale;
  name: string;
  description: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${SITE_URL}/${locale}/custom#service`,
    url: `${SITE_URL}/${locale}/custom`,
    name,
    description,
    serviceType: "Custom 3D printing",
    provider: { "@id": ORG_ID },
    areaServed: { "@type": "Country", name: "Switzerland" },
  };
}

export interface ProductJsonLdInput {
  slug: string;
  name: string;
  description: string;
  priceCents: number;
  saleType: "stock" | "on_demand";
  productionDays: number | null;
  stock: number | null;
  material: string;
  weightGrams: number | null;
  dimensionsMm: string | null;
  colors: string[];
  imageUrls: string[]; // chemins relatifs (/api/files/…) ou absolus
  sku?: string;
}

// Données structurées d'un produit (prix, devise, disponibilité, livraison,
// retours) → éligibilité aux résultats enrichis « produit » et fiches
// marchandes de Google. Une pièce imprimée à la demande est « InStock » avec
// un délai de préparation allongé : `MadeToOrder` existe dans schema.org mais
// ne fait PAS partie des valeurs acceptées par Google pour les fiches
// marchandes (ni par Merchant Center). Seule une vraie rupture l'exclut.
export function productJsonLd(
  p: ProductJsonLdInput,
  locale: Locale,
  shipping: { shippingCents: number; freeOverCents: number },
  rating?: { count: number; average: number },
) {
  const url = `${SITE_URL}/${locale}/products/${p.slug}`;
  const availability =
    p.stock != null && p.stock <= 0
      ? "https://schema.org/OutOfStock"
      : "https://schema.org/InStock";
  // Délai de préparation : 1–3 jours ouvrés en stock (cf. /legal/shipping),
  // délai de production de la fiche pour une pièce imprimée à la demande.
  const production = p.saleType === "on_demand" ? (p.productionDays ?? 3) : 1;
  const shippingCents =
    p.priceCents >= shipping.freeOverCents ? 0 : shipping.shippingCents;

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${url}#product`,
    url,
    name: p.name,
    description: p.description,
    image: p.imageUrls.map(abs),
    sku: p.sku ?? p.slug,
    material: p.material,
    ...(p.colors.length > 0 ? { color: p.colors.join(", ") } : {}),
    ...(p.weightGrams
      ? {
          weight: {
            "@type": "QuantitativeValue",
            value: p.weightGrams,
            unitCode: "GRM",
          },
        }
      : {}),
    ...(p.dimensionsMm
      ? {
          additionalProperty: {
            "@type": "PropertyValue",
            name: "Dimensions (mm)",
            value: p.dimensionsMm,
          },
        }
      : {}),
    brand: { "@type": "Brand", name: SITE_NAME },
    manufacturer: { "@id": ORG_ID },
    // Note agrégée (avis publiés) → étoiles dans les résultats Google.
    ...(rating && rating.count > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: rating.average.toFixed(1),
            reviewCount: rating.count,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
    offers: {
      "@type": "Offer",
      url,
      price: (p.priceCents / 100).toFixed(2),
      priceCurrency: "CHF",
      availability,
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@id": ORG_ID },
      shippingDetails: {
        "@type": "OfferShippingDetails",
        shippingRate: {
          "@type": "MonetaryAmount",
          value: (shippingCents / 100).toFixed(2),
          currency: "CHF",
        },
        shippingDestination: {
          "@type": "DefinedRegion",
          addressCountry: "CH",
        },
        deliveryTime: {
          "@type": "ShippingDeliveryTime",
          handlingTime: {
            "@type": "QuantitativeValue",
            minValue: production,
            maxValue: production + 2,
            unitCode: "DAY",
          },
          transitTime: {
            "@type": "QuantitativeValue",
            minValue: 1,
            maxValue: 3,
            unitCode: "DAY",
          },
        },
      },
      hasMerchantReturnPolicy: returnPolicy(locale),
    },
  };
}
