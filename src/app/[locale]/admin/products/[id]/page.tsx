import { notFound } from "next/navigation";
import { asc, and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  products,
  productTranslations,
  productImages,
  productCategories,
  categories,
  categoryTranslations,
} from "@/db/schema";
import { ProductForm, type ProductFormInitial } from "../product-form";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = await getDb();

  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, id))
    .limit(1);
  if (!product) notFound();

  const [translations, images, links, cats] = await Promise.all([
    db
      .select()
      .from(productTranslations)
      .where(eq(productTranslations.productId, id)),
    db
      .select()
      .from(productImages)
      .where(eq(productImages.productId, id))
      .orderBy(asc(productImages.sortOrder)),
    db
      .select()
      .from(productCategories)
      .where(eq(productCategories.productId, id)),
    db
      .select({ id: categories.id, name: categoryTranslations.name })
      .from(categories)
      .innerJoin(
        categoryTranslations,
        and(
          eq(categoryTranslations.categoryId, categories.id),
          eq(categoryTranslations.locale, "fr"),
        ),
      )
      .orderBy(asc(categories.sortOrder)),
  ]);

  const initial: ProductFormInitial = {
    id: product.id,
    slug: product.slug,
    priceCents: product.priceCents,
    saleType: product.saleType,
    productionDays: product.productionDays,
    material: product.material,
    dimensionsMm: product.dimensionsMm,
    weightGrams: product.weightGrams,
    stock: product.stock,
    multicolor: product.multicolor,
    featured: product.featured,
    active: product.active,
    translations: Object.fromEntries(
      translations.map((t) => [
        t.locale,
        { name: t.name, description: t.description },
      ]),
    ),
    images: images.map((i) => ({ url: i.url, alt: i.alt ?? undefined })),
    categoryIds: links.map((l) => l.categoryId),
  };

  return (
    <div>
      <h2 className="mb-5 text-xl font-bold">Modifier le produit</h2>
      <ProductForm categories={cats} initial={initial} />
    </div>
  );
}
