import {
  getCategories,
  getProductBySlug,
  getProducts,
  type ProductSort,
} from "@/db/queries";
import { routing, type Locale } from "@/i18n/routing";
import { SITE_URL, clampText } from "@/lib/seo";

// Catalogue vu par un agent : DTO publics, stables et auto-suffisants (prix
// en CHF décimal ET en centimes, disponibilité explicite, URL absolues).
// Partagé par le serveur MCP, l'agent A2A, l'API /api/v1 et le flux produits.

export type Availability = "in_stock" | "made_to_order" | "out_of_stock";

export interface AgentPrice {
  amount: string;
  currency: "CHF";
  cents: number;
}

export interface AgentProductSummary {
  slug: string;
  name: string;
  description: string;
  url: string;
  imageUrl: string | null;
  price: AgentPrice;
  availability: Availability;
  productionDays: number | null;
  material: string;
  multicolor: boolean;
  colors: string[];
}

export interface AgentProduct extends AgentProductSummary {
  // Identifiant interne : nécessaire pour composer une ligne de panier
  // (le checkout revalide tout côté serveur, prix compris).
  id: string;
  saleType: "stock" | "on_demand";
  dimensionsMm: string | null;
  weightGrams: number | null;
  images: { url: string; alt: string | null }[];
  variants: { id: string; name: string; price: AgentPrice }[];
  colorOptions: { name: string; hex: string }[];
}

export const price = (cents: number): AgentPrice => ({
  amount: (cents / 100).toFixed(2),
  currency: "CHF",
  cents,
});

export const absoluteUrl = (url: string | null): string | null =>
  url ? (url.startsWith("/") ? `${SITE_URL}${url}` : url) : null;

export const productUrl = (slug: string, locale: Locale) =>
  `${SITE_URL}/${locale}/products/${slug}`;

export function availability(p: {
  stock: number | null;
  saleType: "stock" | "on_demand";
}): Availability {
  if (p.stock != null && p.stock <= 0) return "out_of_stock";
  return p.saleType === "on_demand" ? "made_to_order" : "in_stock";
}

export function toLocale(value: unknown): Locale {
  return typeof value === "string" &&
    (routing.locales as readonly string[]).includes(value)
    ? (value as Locale)
    : "en";
}

export interface ProductSearch {
  query?: string;
  category?: string;
  material?: string;
  multicolor?: boolean;
  maxPriceChf?: number;
  sort?: ProductSort;
  limit?: number;
  locale: Locale;
}

export async function searchProducts(
  search: ProductSearch,
): Promise<AgentProductSummary[]> {
  const rows = await getProducts(search.locale, {
    q: search.query,
    categorySlug: search.category,
    material: search.material,
    multicolor: search.multicolor,
    sort: search.sort,
  });
  const maxCents =
    search.maxPriceChf != null ? Math.round(search.maxPriceChf * 100) : null;
  return rows
    .filter((p) => maxCents == null || p.priceCents <= maxCents)
    .slice(0, Math.min(Math.max(search.limit ?? 20, 1), 50))
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      description: clampText(p.description ?? "", 240),
      url: productUrl(p.slug, search.locale),
      imageUrl: absoluteUrl(p.imageUrl),
      price: price(p.priceCents),
      availability: availability(p),
      productionDays: p.productionDays,
      material: p.material,
      multicolor: p.multicolor,
      colors: p.colors.map((c) => c.name),
    }));
}

export async function getAgentProduct(
  slug: string,
  locale: Locale,
): Promise<AgentProduct | null> {
  const p = await getProductBySlug(slug, locale);
  if (!p) return null;
  return {
    id: p.id,
    saleType: p.saleType,
    slug: p.slug,
    name: p.name,
    description: p.description ?? "",
    url: productUrl(p.slug, locale),
    imageUrl: absoluteUrl(p.images[0]?.url ?? null),
    price: price(p.priceCents),
    availability: availability(p),
    productionDays: p.productionDays,
    material: p.material,
    multicolor: p.multicolor,
    colors: p.colors.map((c) => c.name),
    dimensionsMm: p.dimensionsMm,
    weightGrams: p.weightGrams,
    images: p.images.map((i) => ({ url: absoluteUrl(i.url)!, alt: i.alt })),
    variants: p.variants.map((v) => ({
      id: v.id,
      name: v.name,
      price: price(v.priceCents ?? p.priceCents),
    })),
    colorOptions: p.colors.map((c) => ({ name: c.name, hex: c.hex })),
  };
}

export async function listCategories(locale: Locale) {
  const rows = await getCategories(locale);
  return rows.map((c) => ({
    slug: c.slug,
    name: c.name,
    url: `${SITE_URL}/${locale}/shop?category=${encodeURIComponent(c.slug)}`,
  }));
}
