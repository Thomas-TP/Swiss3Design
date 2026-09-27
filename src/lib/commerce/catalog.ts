import { and, asc, avg, count, eq, inArray } from "drizzle-orm";
import type { getDb } from "@/db";
import {
  categories,
  categoryTranslations,
  filamentColors,
  productCategories,
  productColors,
  productImages,
  productTranslations,
  productVariants,
  products,
  reviews,
} from "@/db/schema";
import { SITE_URL } from "@/lib/seo";

type Db = Awaited<ReturnType<typeof getDb>>;

// Catalogue « vendable » tel que le voient Stripe (flux Agentic Commerce) et
// les agents acheteurs : une ligne par unité achetable — produit × variante ×
// couleur —, identifiée par un SKU stable. Les variantes sont recréées à
// chaque enregistrement de la fiche (nouveaux id) ; leur `sku` et le slug du
// produit, eux, ne bougent pas : SKU = sku de variante ou slug, suffixé de la
// couleur quand le produit en propose. Le flux est en français (langue qui
// fait foi) ; les agents traduisent pour l'acheteur.

export interface SellableSku {
  sku: string;
  productId: string;
  variantId: string | null;
  variantName: string | null;
  colorName: string | null;
  colorHex: string | null;
  slug: string;
  // item_group_id : regroupe variantes et couleurs d'une même fiche.
  groupId: string | null;
  productName: string;
  // Nom figé dans la commande (produit — variante), comme au checkout web.
  lineName: string;
  title: string;
  description: string;
  priceCents: number;
  // null = stock non suivi (impression à la demande).
  stock: number | null;
  // Seau de stock partagé : les couleurs d'un produit sans variante puisent
  // dans le même stock que la fiche.
  stockKey: string;
  saleType: "stock" | "on_demand";
  productionDays: number | null;
  material: string;
  weightGrams: number | null;
  dimensionsMm: string | null;
  model3dUrl: string | null;
  imageUrls: string[];
  category: string | null;
  reviewCount: number;
  reviewAverage: number | null;
}

// Même normalisation que les slugs de l'admin : accents retirés, minuscules,
// tout le reste en tirets.
export function colorKey(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const SKU_MAX = 100;

export function feedSkuId(base: string, colorName: string | null): string {
  if (!colorName) return base.slice(0, SKU_MAX);
  const suffix = "--" + colorKey(colorName);
  return base.slice(0, SKU_MAX - suffix.length) + suffix;
}

// Texte brut pour les agents : ni balise ni mise en forme Markdown.
export function plainText(value: string, max: number): string {
  const text = value
    .replace(/<[^>]*>/g, " ")
    .replace(/[*_`#>]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? text.slice(0, max - 1).trimEnd() + "…" : text;
}

export interface CatalogRows {
  products: {
    id: string;
    slug: string;
    priceCents: number;
    saleType: "stock" | "on_demand";
    productionDays: number | null;
    material: string;
    dimensionsMm: string | null;
    weightGrams: number | null;
    model3dUrl: string | null;
    stock: number | null;
  }[];
  translations: {
    productId: string;
    locale: string;
    name: string;
    description: string;
  }[];
  images: { productId: string; url: string }[];
  variants: {
    id: string;
    productId: string;
    sku: string;
    name: string;
    priceCents: number | null;
    stock: number | null;
  }[];
  colors: { productId: string; name: string; hex: string }[];
  categories: { productId: string; name: string }[];
  ratings: { productId: string; count: number; average: number | null }[];
}

const byProduct = <T extends { productId: string }>(rows: T[]) => {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const list = map.get(row.productId) ?? [];
    list.push(row);
    map.set(row.productId, list);
  }
  return map;
};

// Construction pure (testable) : les lignes arrivent déjà triées.
export function buildSellableSkus(rows: CatalogRows): SellableSku[] {
  const translations = byProduct(rows.translations);
  const images = byProduct(rows.images);
  const variants = byProduct(rows.variants);
  const colors = byProduct(rows.colors);
  const productCategory = byProduct(rows.categories);
  const ratings = new Map(rows.ratings.map((r) => [r.productId, r]));
  const out: SellableSku[] = [];
  const seen = new Set<string>();

  for (const p of rows.products) {
    const tr = translations.get(p.id) ?? [];
    const fr = tr.find((t) => t.locale === "fr") ?? tr[0];
    const productName = fr?.name ?? p.slug;
    const description = plainText(fr?.description ?? productName, 5000);
    const productVariants = variants.get(p.id) ?? [];
    const productColors = colors.get(p.id) ?? [];
    const options = productVariants.length
      ? productVariants.map((v) => ({
          base: v.sku,
          variantId: v.id as string | null,
          variantName: v.name as string | null,
          priceCents: v.priceCents ?? p.priceCents,
          stock: v.stock,
          stockKey: "v:" + v.id,
        }))
      : [
          {
            base: p.slug,
            variantId: null,
            variantName: null,
            priceCents: p.priceCents,
            stock: p.stock,
            stockKey: "p:" + p.id,
          },
        ];
    const shades = productColors.length
      ? productColors.map((c) => ({ name: c.name, hex: c.hex }))
      : [{ name: null, hex: null }];
    const grouped = options.length * shades.length > 1;
    const rating = ratings.get(p.id);

    for (const option of options) {
      for (const shade of shades) {
        const sku = feedSkuId(option.base, shade.name);
        // Deux couleurs au même nom normalisé : on garde la première plutôt
        // que de publier deux fois le même identifiant.
        if (seen.has(sku)) continue;
        seen.add(sku);
        const lineName = option.variantName
          ? `${productName} — ${option.variantName}`
          : productName;
        out.push({
          sku,
          productId: p.id,
          variantId: option.variantId,
          variantName: option.variantName,
          colorName: shade.name,
          colorHex: shade.hex,
          slug: p.slug,
          groupId: grouped ? p.slug : null,
          productName,
          lineName,
          title: plainText(
            shade.name ? `${lineName} — ${shade.name}` : lineName,
            150,
          ),
          description,
          priceCents: option.priceCents,
          stock: option.stock,
          stockKey: option.stockKey,
          saleType: p.saleType,
          productionDays: p.productionDays,
          material: p.material,
          weightGrams: p.weightGrams,
          dimensionsMm: p.dimensionsMm,
          model3dUrl: p.model3dUrl,
          imageUrls: (images.get(p.id) ?? []).map((i) => i.url),
          category: productCategory.get(p.id)?.[0]?.name ?? null,
          reviewCount: rating?.count ?? 0,
          reviewAverage: rating?.average ?? null,
        });
      }
    }
  }
  return out;
}

export async function loadSellableSkus(db: Db): Promise<SellableSku[]> {
  const productRows = await db
    .select({
      id: products.id,
      slug: products.slug,
      priceCents: products.priceCents,
      saleType: products.saleType,
      productionDays: products.productionDays,
      material: products.material,
      dimensionsMm: products.dimensionsMm,
      weightGrams: products.weightGrams,
      model3dUrl: products.model3dUrl,
      stock: products.stock,
    })
    .from(products)
    .where(eq(products.active, true))
    .orderBy(asc(products.slug));
  const ids = productRows.map((p) => p.id);
  if (!ids.length) return [];
  // Lectures indépendantes → en parallèle (pool pg du Worker).
  const [translations, images, variants, colors, cats, ratings] =
    await Promise.all([
      db
        .select({
          productId: productTranslations.productId,
          locale: productTranslations.locale,
          name: productTranslations.name,
          description: productTranslations.description,
        })
        .from(productTranslations)
        .where(inArray(productTranslations.productId, ids)),
      db
        .select({ productId: productImages.productId, url: productImages.url })
        .from(productImages)
        .where(inArray(productImages.productId, ids))
        .orderBy(asc(productImages.productId), asc(productImages.sortOrder)),
      db
        .select({
          id: productVariants.id,
          productId: productVariants.productId,
          sku: productVariants.sku,
          name: productVariants.name,
          priceCents: productVariants.priceCents,
          stock: productVariants.stock,
        })
        .from(productVariants)
        .where(inArray(productVariants.productId, ids))
        .orderBy(asc(productVariants.sku)),
      db
        .select({
          productId: productColors.productId,
          name: filamentColors.name,
          hex: filamentColors.hex,
        })
        .from(productColors)
        .innerJoin(filamentColors, eq(filamentColors.id, productColors.colorId))
        .where(inArray(productColors.productId, ids))
        .orderBy(asc(productColors.productId), asc(productColors.sortOrder)),
      db
        .select({
          productId: productCategories.productId,
          name: categoryTranslations.name,
        })
        .from(productCategories)
        .innerJoin(categories, eq(categories.id, productCategories.categoryId))
        .innerJoin(
          categoryTranslations,
          and(
            eq(categoryTranslations.categoryId, categories.id),
            eq(categoryTranslations.locale, "fr"),
          ),
        )
        .where(inArray(productCategories.productId, ids))
        .orderBy(asc(categories.sortOrder)),
      db
        .select({
          productId: reviews.productId,
          count: count(),
          average: avg(reviews.rating),
        })
        .from(reviews)
        .where(
          and(inArray(reviews.productId, ids), eq(reviews.status, "published")),
        )
        .groupBy(reviews.productId),
    ]);
  return buildSellableSkus({
    products: productRows,
    translations,
    images,
    variants,
    colors,
    categories: cats,
    ratings: ratings.map((r) => ({
      productId: r.productId,
      count: Number(r.count),
      average: r.average == null ? null : Number(r.average),
    })),
  });
}

export function skuIndex(skus: SellableSku[]) {
  return new Map(skus.map((s) => [s.sku, s]));
}

// Photo servie en JPEG (exigence du flux Stripe) par la transformation
// d'images Cloudflare du domaine, à partir du WebP stocké dans R2.
export function feedImageUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${SITE_URL}/cdn-cgi/image/format=jpeg,width=1200,fit=scale-down,quality=85${path.startsWith("/") ? "" : "/"}${path}`;
}

export const productPageUrl = (slug: string) =>
  `${SITE_URL}/fr/products/${slug}`;
