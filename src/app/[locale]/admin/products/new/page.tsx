import { asc, and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { categories, categoryTranslations } from "@/db/schema";
import { loadShopColors } from "@/lib/filament/shop-db";
import { requireAdmin } from "@/lib/session";
import { ProductForm } from "../product-form";

export default async function NewProductPage() {
  await requireAdmin();
  const db = await getDb();
  const [cats, colors] = await Promise.all([
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
    loadShopColors(db, "fr"),
  ]);

  return (
    <div>
      <h2 className="mb-5 text-xl font-bold">Nouveau produit</h2>
      <ProductForm categories={cats} colors={colors} />
    </div>
  );
}
