import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { categories, categoryTranslations } from "@/db/schema";
import { requireAdmin } from "@/lib/session";
import { CategoryForm, type CategoryFormInitial } from "../category-form";

export default async function EditCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const db = await getDb();

  const [cat] = await db
    .select()
    .from(categories)
    .where(eq(categories.id, id))
    .limit(1);
  if (!cat) notFound();

  const translations = await db
    .select()
    .from(categoryTranslations)
    .where(eq(categoryTranslations.categoryId, id));

  const initial: CategoryFormInitial = {
    id: cat.id,
    slug: cat.slug,
    sortOrder: cat.sortOrder,
    translations: Object.fromEntries(
      translations.map((t) => [t.locale, t.name]),
    ),
  };

  return (
    <div>
      <h2 className="mb-5 text-xl font-bold">Modifier la catégorie</h2>
      <CategoryForm initial={initial} />
    </div>
  );
}
