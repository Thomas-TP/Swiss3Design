import { asc, and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { categories, categoryTranslations } from "@/db/schema";
import { getMaterials } from "@/db/queries";
import { requireAdmin } from "@/lib/session";
import { ProductForm } from "../product-form";

export default async function NewProductPage() {
  await requireAdmin();
  const db = await getDb();
  const [cats, materials] = await Promise.all([
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
    getMaterials(),
  ]);

  return (
    <div>
      <h2 className="mb-5 text-xl font-bold">Nouveau produit</h2>
      <ProductForm categories={cats} materials={materials} />
    </div>
  );
}
