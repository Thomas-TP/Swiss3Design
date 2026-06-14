import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "./index";
import {
  products,
  productTranslations,
  productImages,
  productVariants,
  categories,
  categoryTranslations,
  productCategories,
  settings,
} from "./schema";
import type { Locale } from "@/i18n/routing";

export interface ProductListItem {
  id: string;
  slug: string;
  priceCents: number;
  saleType: "stock" | "on_demand";
  productionDays: number | null;
  material: string;
  multicolor: boolean;
  stock: number | null;
  name: string;
  description: string;
  imageUrl: string | null;
  imageAlt: string | null;
}

async function attachImages(
  db: Awaited<ReturnType<typeof getDb>>,
  rows: Omit<ProductListItem, "imageUrl" | "imageAlt">[],
): Promise<ProductListItem[]> {
  if (rows.length === 0) return [];
  const images = await db
    .select()
    .from(productImages)
    .where(inArray(productImages.productId, rows.map((r) => r.id)))
    .orderBy(asc(productImages.sortOrder));
  const firstImage = new Map<string, { url: string; alt: string | null }>();
  for (const img of images) {
    if (!firstImage.has(img.productId)) {
      firstImage.set(img.productId, { url: img.url, alt: img.alt });
    }
  }
  return rows.map((r) => ({
    ...r,
    imageUrl: firstImage.get(r.id)?.url ?? null,
    imageAlt: firstImage.get(r.id)?.alt ?? null,
  }));
}

export type ProductSort = "new" | "price_asc" | "price_desc";

export async function getProducts(
  locale: Locale,
  opts: {
    featuredOnly?: boolean;
    categorySlug?: string;
    material?: string;
    multicolor?: boolean;
    sort?: ProductSort;
  } = {},
): Promise<ProductListItem[]> {
  const db = await getDb();

  const conditions = [eq(products.active, true)];
  if (opts.featuredOnly) conditions.push(eq(products.featured, true));
  if (opts.material) conditions.push(eq(products.material, opts.material));
  if (opts.multicolor) conditions.push(eq(products.multicolor, true));

  let productIdsInCategory: string[] | null = null;
  if (opts.categorySlug) {
    const rows = await db
      .select({ productId: productCategories.productId })
      .from(productCategories)
      .innerJoin(categories, eq(categories.id, productCategories.categoryId))
      .where(eq(categories.slug, opts.categorySlug));
    productIdsInCategory = rows.map((r) => r.productId);
    if (productIdsInCategory.length === 0) return [];
    conditions.push(inArray(products.id, productIdsInCategory));
  }

  const rows = await db
    .select({
      id: products.id,
      slug: products.slug,
      priceCents: products.priceCents,
      saleType: products.saleType,
      productionDays: products.productionDays,
      material: products.material,
      multicolor: products.multicolor,
      stock: products.stock,
      name: productTranslations.name,
      description: productTranslations.description,
    })
    .from(products)
    .innerJoin(
      productTranslations,
      and(
        eq(productTranslations.productId, products.id),
        eq(productTranslations.locale, locale),
      ),
    )
    .where(and(...conditions))
    .orderBy(
      opts.sort === "price_asc"
        ? asc(products.priceCents)
        : opts.sort === "price_desc"
          ? desc(products.priceCents)
          : desc(products.createdAt),
    );

  return attachImages(db, rows);
}

// Filtres réellement utilisables : catégories ayant ≥1 produit actif et
// matières effectivement présentes dans le catalogue actif.
export async function getUsedFilters(locale: Locale): Promise<{
  categories: { id: string; slug: string; name: string }[];
  materials: string[];
}> {
  const db = await getDb();

  const cats = await db
    .selectDistinct({
      id: categories.id,
      slug: categories.slug,
      name: categoryTranslations.name,
      sortOrder: categories.sortOrder,
    })
    .from(categories)
    .innerJoin(
      categoryTranslations,
      and(
        eq(categoryTranslations.categoryId, categories.id),
        eq(categoryTranslations.locale, locale),
      ),
    )
    .innerJoin(productCategories, eq(productCategories.categoryId, categories.id))
    .innerJoin(
      products,
      and(
        eq(products.id, productCategories.productId),
        eq(products.active, true),
      ),
    )
    .orderBy(asc(categories.sortOrder));

  const mats = await db
    .selectDistinct({ material: products.material })
    .from(products)
    .where(eq(products.active, true))
    .orderBy(asc(products.material));

  return {
    categories: cats.map((c) => ({ id: c.id, slug: c.slug, name: c.name })),
    materials: mats.map((m) => m.material),
  };
}

export async function getProductBySlug(slug: string, locale: Locale) {
  const db = await getDb();
  const rows = await db
    .select({
      id: products.id,
      slug: products.slug,
      priceCents: products.priceCents,
      saleType: products.saleType,
      productionDays: products.productionDays,
      material: products.material,
      dimensionsMm: products.dimensionsMm,
      weightGrams: products.weightGrams,
      multicolor: products.multicolor,
      stock: products.stock,
      name: productTranslations.name,
      description: productTranslations.description,
    })
    .from(products)
    .innerJoin(
      productTranslations,
      and(
        eq(productTranslations.productId, products.id),
        eq(productTranslations.locale, locale),
      ),
    )
    .where(and(eq(products.slug, slug), eq(products.active, true)))
    .limit(1);

  const product = rows[0];
  if (!product) return null;

  const [images, variants] = await Promise.all([
    db
      .select()
      .from(productImages)
      .where(eq(productImages.productId, product.id))
      .orderBy(asc(productImages.sortOrder)),
    db
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, product.id)),
  ]);

  return { ...product, images, variants };
}

export async function getCategories(locale: Locale) {
  const db = await getDb();
  return db
    .select({
      id: categories.id,
      slug: categories.slug,
      name: categoryTranslations.name,
    })
    .from(categories)
    .innerJoin(
      categoryTranslations,
      and(
        eq(categoryTranslations.categoryId, categories.id),
        eq(categoryTranslations.locale, locale),
      ),
    )
    .orderBy(asc(categories.sortOrder));
}

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const rows = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  return rows[0]?.value ?? null;
}
