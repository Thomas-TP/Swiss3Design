import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "./index";
import {
  products,
  productTranslations,
  productImages,
  productVariants,
  productColors,
  filamentColors,
  categories,
  categoryTranslations,
  productCategories,
  materials,
  settings,
} from "./schema";
import type { Locale } from "@/i18n/routing";

export interface ColorSwatch {
  name: string;
  hex: string;
}

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
  colors: ColorSwatch[];
}

// Récupère, pour une liste de produits, la première image et les pastilles de
// couleur (palette du filament) — deux lectures groupées plutôt qu'une par produit.
async function attachImagesAndColors(
  db: Awaited<ReturnType<typeof getDb>>,
  rows: Omit<ProductListItem, "imageUrl" | "imageAlt" | "colors">[],
): Promise<ProductListItem[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const [images, colorRows] = await Promise.all([
    db
      .select()
      .from(productImages)
      .where(inArray(productImages.productId, ids))
      .orderBy(asc(productImages.sortOrder)),
    db
      .select({
        productId: productColors.productId,
        name: filamentColors.name,
        hex: filamentColors.hex,
        sortOrder: productColors.sortOrder,
      })
      .from(productColors)
      .innerJoin(filamentColors, eq(filamentColors.id, productColors.colorId))
      .where(inArray(productColors.productId, ids))
      .orderBy(asc(productColors.sortOrder)),
  ]);

  const firstImage = new Map<string, { url: string; alt: string | null }>();
  for (const img of images) {
    if (!firstImage.has(img.productId)) {
      firstImage.set(img.productId, { url: img.url, alt: img.alt });
    }
  }
  const colorsByProduct = new Map<string, ColorSwatch[]>();
  for (const c of colorRows) {
    const list = colorsByProduct.get(c.productId) ?? [];
    list.push({ name: c.name, hex: c.hex });
    colorsByProduct.set(c.productId, list);
  }

  return rows.map((r) => ({
    ...r,
    imageUrl: firstImage.get(r.id)?.url ?? null,
    imageAlt: firstImage.get(r.id)?.alt ?? null,
    colors: colorsByProduct.get(r.id) ?? [],
  }));
}

export type ProductSort = "new" | "price_asc" | "price_desc";

export async function getProducts(
  locale: Locale,
  opts: {
    featuredOnly?: boolean;
    categorySlug?: string;
    material?: string;
    color?: string;
    multicolor?: boolean;
    sort?: ProductSort;
  } = {},
): Promise<ProductListItem[]> {
  const db = await getDb();

  const conditions = [eq(products.active, true)];
  if (opts.featuredOnly) conditions.push(eq(products.featured, true));
  if (opts.material) conditions.push(eq(products.material, opts.material));
  if (opts.multicolor) conditions.push(eq(products.multicolor, true));

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

  if (opts.color) {
    const rows = await db
      .selectDistinct({ productId: productColors.productId })
      .from(productColors)
      .innerJoin(filamentColors, eq(filamentColors.id, productColors.colorId))
      .where(eq(filamentColors.name, opts.color));
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

  return attachImagesAndColors(db, rows);
}

// Palette de filaments éditable en admin (proposée à la création produit).
export async function getMaterials(): Promise<string[]> {
  const db = await getDb();
  const rows = await db
    .select({ name: materials.name })
    .from(materials)
    .orderBy(asc(materials.name));
  return rows.map((r) => r.name);
}

export interface MaterialWithColors {
  id: string;
  name: string;
  colors: { id: string; name: string; hex: string }[];
}

// Filaments avec leur palette de couleurs — pour l'admin (gestion + formulaire
// produit). Les couleurs sont rattachées en mémoire après deux lectures.
export async function getMaterialsWithColors(): Promise<MaterialWithColors[]> {
  const db = await getDb();
  const [mats, colors] = await Promise.all([
    db
      .select({ id: materials.id, name: materials.name })
      .from(materials)
      .orderBy(asc(materials.name)),
    db
      .select({
        id: filamentColors.id,
        materialId: filamentColors.materialId,
        name: filamentColors.name,
        hex: filamentColors.hex,
      })
      .from(filamentColors)
      .orderBy(asc(filamentColors.sortOrder), asc(filamentColors.name)),
  ]);
  const byMaterial = new Map<string, { id: string; name: string; hex: string }[]>();
  for (const c of colors) {
    const list = byMaterial.get(c.materialId) ?? [];
    list.push({ id: c.id, name: c.name, hex: c.hex });
    byMaterial.set(c.materialId, list);
  }
  return mats.map((m) => ({
    id: m.id,
    name: m.name,
    colors: byMaterial.get(m.id) ?? [],
  }));
}

// Filtres réellement utilisables : catégories ayant ≥1 produit actif,
// matières effectivement présentes dans le catalogue actif, et le filtre
// multicolore seulement si au moins un produit actif l'est.
export async function getUsedFilters(locale: Locale): Promise<{
  categories: { id: string; slug: string; name: string }[];
  materials: string[];
  colors: ColorSwatch[];
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

  const multicolorRow = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.active, true), eq(products.multicolor, true)))
    .limit(1);

  // Couleurs réellement proposées par des produits actifs. On dédoublonne par
  // nom (deux filaments peuvent partager « Rouge ») en gardant le premier hex.
  const colorRows = await db
    .selectDistinct({ name: filamentColors.name, hex: filamentColors.hex })
    .from(productColors)
    .innerJoin(filamentColors, eq(filamentColors.id, productColors.colorId))
    .innerJoin(
      products,
      and(eq(products.id, productColors.productId), eq(products.active, true)),
    )
    .orderBy(asc(filamentColors.name));
  const seenColor = new Set<string>();
  const colors: ColorSwatch[] = [];
  for (const c of colorRows) {
    if (seenColor.has(c.name)) continue;
    seenColor.add(c.name);
    colors.push({ name: c.name, hex: c.hex });
  }

  return {
    categories: cats.map((c) => ({ id: c.id, slug: c.slug, name: c.name })),
    materials: mats.map((m) => m.material),
    colors,
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

  const [images, variants, colors] = await Promise.all([
    db
      .select()
      .from(productImages)
      .where(eq(productImages.productId, product.id))
      .orderBy(asc(productImages.sortOrder)),
    db
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, product.id)),
    db
      .select({
        id: filamentColors.id,
        name: filamentColors.name,
        hex: filamentColors.hex,
      })
      .from(productColors)
      .innerJoin(filamentColors, eq(filamentColors.id, productColors.colorId))
      .where(eq(productColors.productId, product.id))
      .orderBy(asc(productColors.sortOrder)),
  ]);

  return { ...product, images, variants, colors };
}

// IDs des couleurs cochées pour un produit (pré-remplissage du formulaire admin).
export async function getProductColorIds(productId: string): Promise<string[]> {
  const db = await getDb();
  const rows = await db
    .select({ colorId: productColors.colorId })
    .from(productColors)
    .where(eq(productColors.productId, productId))
    .orderBy(asc(productColors.sortOrder));
  return rows.map((r) => r.colorId);
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
