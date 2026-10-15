import { alias } from "drizzle-orm/pg-core";
import {
  and,
  asc,
  desc,
  eq,
  exists,
  inArray,
  ilike,
  ne,
  notInArray,
  or,
  sql,
} from "drizzle-orm";
import { getDb } from "./index";
import {
  products,
  productTranslations,
  productImages,
  productVariants,
  productFilamentExclusions,
  categories,
  categoryTranslations,
  productCategories,
  settings,
  reviews,
} from "./schema";
import { loadProductColors } from "@/lib/filament/shop-db";
import { isMissingTable } from "@/lib/filament/stock-db";
import type { ShopColor } from "@/lib/filament/shop";
import type { Locale } from "@/i18n/routing";

const fallbackTranslation = alias(productTranslations, "fallback_translation");
const translatedName = sql<string>`coalesce(${productTranslations.name},${fallbackTranslation.name},${products.slug})`;
const translatedDescription = sql<string>`coalesce(${productTranslations.description},${fallbackTranslation.description},'')`;

// Couleur proposée par un article : une référence du stock (les mêmes que « Sur
// mesure », moins les exclusions de l'article). `id` = `filament_refs.id`.
export type ColorSwatch = Pick<ShopColor, "id" | "name" | "hex" | "hexes">;

const toSwatch = (c: ShopColor): ColorSwatch => ({
  id: c.id,
  name: c.name,
  hex: c.hex,
  hexes: c.hexes,
});

export interface ProductListItem {
  id: string;
  slug: string;
  priceCents: number;
  saleType: "stock" | "on_demand";
  productionDays: number | null;
  material: string;
  multicolor: boolean;
  stock: number | null;
  /** Poids d'UNE pièce (g) : le panier en tire le filament à réserver (articles à la demande). */
  weightGrams: number | null;
  name: string;
  description: string;
  imageUrl: string | null;
  imageAlt: string | null;
  colors: ColorSwatch[];
}

// Récupère, pour une liste de produits, la première image et les pastilles de
// couleur (les références du stock, moins les exclusions de chaque article) —
// lectures groupées plutôt qu'une par produit.
async function attachImagesAndColors(
  db: Awaited<ReturnType<typeof getDb>>,
  rows: Omit<ProductListItem, "imageUrl" | "imageAlt" | "colors">[],
  locale: Locale,
): Promise<ProductListItem[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const [images, colorsByProductId] = await Promise.all([
    db
      .select()
      .from(productImages)
      .where(inArray(productImages.productId, ids))
      .orderBy(asc(productImages.sortOrder)),
    loadProductColors(db, ids, locale),
  ]);

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
    colors: (colorsByProductId.get(r.id) ?? []).map(toSwatch),
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
    q?: string;
  } = {},
): Promise<ProductListItem[]> {
  const db = await getDb();

  const conditions = [eq(products.active, true)];
  if (opts.featuredOnly) conditions.push(eq(products.featured, true));
  if (opts.material) conditions.push(eq(products.material, opts.material));
  if (opts.multicolor) conditions.push(eq(products.multicolor, true));

  // Recherche plein-texte simple sur le nom + la description traduits. On
  // neutralise les jokers LIKE (% _) saisis par l'utilisateur. Insensible à la
  // casse avec ILIKE (Postgres).
  if (opts.q) {
    const term = opts.q.trim().replace(/[%_]/g, "");
    if (term) {
      const pattern = `%${term}%`;
      const match = or(
        ilike(translatedName, pattern),
        ilike(translatedDescription, pattern),
      );
      if (match) conditions.push(match);
    }
  }

  if (opts.categorySlug) {
    const rows = await db
      .select({ productId: productCategories.productId })
      .from(productCategories)
      .innerJoin(categories, eq(categories.id, productCategories.categoryId))
      .where(eq(categories.slug, opts.categorySlug));
    const ids = rows.map((r) => r.productId);
    if (ids.length === 0) return [];
    conditions.push(inArray(products.id, ids));
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
      weightGrams: products.weightGrams,
      name: translatedName,
      description: translatedDescription,
    })
    .from(products)
    .leftJoin(
      productTranslations,
      and(
        eq(productTranslations.productId, products.id),
        eq(productTranslations.locale, locale),
      ),
    )
    .leftJoin(
      fallbackTranslation,
      and(
        eq(fallbackTranslation.productId, products.id),
        eq(fallbackTranslation.locale, "fr"),
      ),
    )
    .where(and(...conditions))
    .orderBy(
      // La « Sélection du moment » suit l'ordre curé en admin (featuredOrder),
      // les listes boutique le tri demandé, à défaut les nouveautés.
      ...(opts.featuredOnly
        ? [asc(products.featuredOrder), desc(products.createdAt)]
        : opts.sort === "price_asc"
          ? [asc(products.priceCents)]
          : opts.sort === "price_desc"
            ? [desc(products.priceCents)]
            : [desc(products.createdAt)]),
    );

  return attachImagesAndColors(db, rows, locale);
}

// Filtres réellement utilisables : catégories ayant ≥1 produit actif,
// matières effectivement présentes dans le catalogue actif, et le filtre
// multicolore seulement si au moins un produit actif l'est. Plus de filtre
// couleur : tous les articles proposent les mêmes couleurs (moins leurs
// exclusions), il ne départagerait plus rien.
export async function getUsedFilters(locale: Locale): Promise<{
  categories: { id: string; slug: string; name: string }[];
  materials: string[];
  multicolor: boolean;
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
    .innerJoin(
      productCategories,
      eq(productCategories.categoryId, categories.id),
    )
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

  const multicolorRow = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.active, true), eq(products.multicolor, true)))
    .limit(1);

  return {
    categories: cats.map((c) => ({ id: c.id, slug: c.slug, name: c.name })),
    materials: mats.map((m) => m.material),
    multicolor: multicolorRow.length > 0,
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
      model3dUrl: products.model3dUrl,
      multicolor: products.multicolor,
      stock: products.stock,
      name: translatedName,
      description: translatedDescription,
    })
    .from(products)
    .leftJoin(
      productTranslations,
      and(
        eq(productTranslations.productId, products.id),
        eq(productTranslations.locale, locale),
      ),
    )
    .leftJoin(
      fallbackTranslation,
      and(
        eq(fallbackTranslation.productId, products.id),
        eq(fallbackTranslation.locale, "fr"),
      ),
    )
    .where(and(eq(products.slug, slug), eq(products.active, true)))
    .limit(1);

  const product = rows[0];
  if (!product) return null;

  const [images, variants, colorsByProductId] = await Promise.all([
    db
      .select()
      .from(productImages)
      .where(eq(productImages.productId, product.id))
      .orderBy(asc(productImages.sortOrder)),
    db
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, product.id)),
    loadProductColors(db, [product.id], locale),
  ]);

  return {
    ...product,
    images,
    variants,
    // Les couleurs de la fiche : toutes celles du stock proposées en « Sur mesure »,
    // moins les exclusions de l'article, dans la langue de la page.
    colors: colorsByProductId.get(product.id) ?? [],
  };
}

// Produits « Vous aimerez aussi » : d'abord ceux partageant une catégorie avec
// le produit courant (hors lui-même), complétés par les nouveautés si besoin.
export async function getRelatedProducts(
  productId: string,
  locale: Locale,
  limit = 4,
): Promise<ProductListItem[]> {
  const db = await getDb();

  const cols = {
    id: products.id,
    slug: products.slug,
    priceCents: products.priceCents,
    saleType: products.saleType,
    productionDays: products.productionDays,
    material: products.material,
    multicolor: products.multicolor,
    stock: products.stock,
    weightGrams: products.weightGrams,
    name: translatedName,
    description: translatedDescription,
  };
  const withTranslation = and(
    eq(productTranslations.productId, products.id),
    eq(productTranslations.locale, locale),
  );

  const catRows = await db
    .select({ categoryId: productCategories.categoryId })
    .from(productCategories)
    .where(eq(productCategories.productId, productId));
  const catIds = catRows.map((c) => c.categoryId);

  let rows: Omit<ProductListItem, "imageUrl" | "imageAlt" | "colors">[] = [];

  if (catIds.length > 0) {
    rows = await db
      .select(cols)
      .from(products)
      .leftJoin(productTranslations, withTranslation)
      .leftJoin(
        fallbackTranslation,
        and(
          eq(fallbackTranslation.productId, products.id),
          eq(fallbackTranslation.locale, "fr"),
        ),
      )
      .where(
        and(
          eq(products.active, true),
          ne(products.id, productId),
          exists(
            db
              .select({ n: sql`1` })
              .from(productCategories)
              .where(
                and(
                  eq(productCategories.productId, products.id),
                  inArray(productCategories.categoryId, catIds),
                ),
              ),
          ),
        ),
      )
      .orderBy(desc(products.createdAt))
      .limit(limit);
  }

  // Complète avec les nouveautés (hors produit courant et déjà sélectionnés).
  if (rows.length < limit) {
    const exclude = [productId, ...rows.map((r) => r.id)];
    const fillers = await db
      .select(cols)
      .from(products)
      .leftJoin(productTranslations, withTranslation)
      .leftJoin(
        fallbackTranslation,
        and(
          eq(fallbackTranslation.productId, products.id),
          eq(fallbackTranslation.locale, "fr"),
        ),
      )
      .where(and(eq(products.active, true), notInArray(products.id, exclude)))
      .orderBy(desc(products.createdAt))
      .limit(limit - rows.length);
    rows = [...rows, ...fillers];
  }

  return attachImagesAndColors(db, rows, locale);
}

// Références décochées pour un produit (pré-remplissage du formulaire admin).
// Migration 0011 absente : aucune exclusion.
export async function getProductExcludedRefIds(
  productId: string,
): Promise<string[]> {
  const db = await getDb();
  try {
    const rows = await db
      .select({ refId: productFilamentExclusions.refId })
      .from(productFilamentExclusions)
      .where(eq(productFilamentExclusions.productId, productId));
    return rows.map((r) => r.refId);
  } catch (error) {
    if (!isMissingTable(error)) throw error;
    return [];
  }
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

// Produits actifs pour le sitemap : slug, date et URL des images (sitemap
// images → Google Images), sans traduction. Relue à chaque requête du sitemap
// (route force-dynamic), donc toujours à jour à la création/suppression d'un
// produit. Deux lectures groupées, jamais une par produit.
export async function getSitemapProducts(): Promise<
  { slug: string; createdAt: Date; images: string[] }[]
> {
  const db = await getDb();
  const rows = await db
    .select({
      id: products.id,
      slug: products.slug,
      createdAt: products.createdAt,
    })
    .from(products)
    .where(eq(products.active, true))
    .orderBy(desc(products.createdAt));
  if (rows.length === 0) return [];

  const images = await db
    .select({ productId: productImages.productId, url: productImages.url })
    .from(productImages)
    .where(
      inArray(
        productImages.productId,
        rows.map((r) => r.id),
      ),
    )
    .orderBy(asc(productImages.sortOrder));
  const byProduct = new Map<string, string[]>();
  for (const img of images) {
    const list = byProduct.get(img.productId) ?? [];
    list.push(img.url);
    byProduct.set(img.productId, list);
  }

  return rows.map((r) => ({
    slug: r.slug,
    createdAt: r.createdAt,
    images: byProduct.get(r.id) ?? [],
  }));
}

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(settings)
    .where(eq(settings.key, key))
    .limit(1);
  return rows[0]?.value ?? null;
}

// ── Avis produits ────────────────────────────────────────────────────────────

export interface ReviewItem {
  id: string;
  authorName: string;
  rating: number;
  body: string | null;
  createdAt: Date;
}

// Avis publiés d'un produit (les plus récents d'abord).
export async function getPublishedReviews(
  productId: string,
): Promise<ReviewItem[]> {
  const db = await getDb();
  return db
    .select({
      id: reviews.id,
      authorName: reviews.authorName,
      rating: reviews.rating,
      body: reviews.body,
      createdAt: reviews.createdAt,
    })
    .from(reviews)
    .where(
      and(eq(reviews.productId, productId), eq(reviews.status, "published")),
    )
    .orderBy(desc(reviews.createdAt));
}

// Synthèse de notation (avis publiés) pour l'affichage + le JSON-LD AggregateRating.
export async function getRatingSummary(
  productId: string,
): Promise<{ count: number; average: number }> {
  const db = await getDb();
  const [row] = await db
    .select({
      count: sql<number>`count(*)`,
      average: sql<number>`avg(${reviews.rating})`,
    })
    .from(reviews)
    .where(
      and(eq(reviews.productId, productId), eq(reviews.status, "published")),
    );
  const count = Number(row?.count ?? 0);
  return { count, average: count > 0 ? Number(row?.average ?? 0) : 0 };
}

// IDs des produits déjà notés pour une commande (tout statut) : masque le
// formulaire d'avis une fois soumis.
export async function getReviewedProductIds(
  orderId: string,
): Promise<string[]> {
  const db = await getDb();
  const rows = await db
    .select({ productId: reviews.productId })
    .from(reviews)
    .where(eq(reviews.orderId, orderId));
  return rows.map((r) => r.productId);
}
