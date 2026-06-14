import { asc, and, eq, inArray } from "drizzle-orm";
import { Plus, Tags } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getDb } from "@/db";
import {
  categories,
  categoryTranslations,
  productCategories,
} from "@/db/schema";
import { requireAdmin } from "@/lib/session";
import { BTN_PRIMARY } from "../ui";

export default async function AdminCategoriesPage() {
  await requireAdmin();
  const db = await getDb();

  const rows = await db
    .select({
      id: categories.id,
      slug: categories.slug,
      sortOrder: categories.sortOrder,
      name: categoryTranslations.name,
    })
    .from(categories)
    .innerJoin(
      categoryTranslations,
      and(
        eq(categoryTranslations.categoryId, categories.id),
        eq(categoryTranslations.locale, "fr"),
      ),
    )
    .orderBy(asc(categories.sortOrder));

  const links = rows.length
    ? await db
        .select({ categoryId: productCategories.categoryId })
        .from(productCategories)
        .where(
          inArray(
            productCategories.categoryId,
            rows.map((r) => r.id),
          ),
        )
    : [];
  const countByCat = new Map<string, number>();
  for (const l of links) {
    countByCat.set(l.categoryId, (countByCat.get(l.categoryId) ?? 0) + 1);
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <p className="text-sm text-soft">
          {rows.length} catégorie{rows.length > 1 ? "s" : ""}
        </p>
        <Link href="/admin/categories/new" className={BTN_PRIMARY}>
          <Plus size={16} />
          Nouvelle catégorie
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-card border border-line bg-surface p-10 text-center text-soft">
          <p className="font-medium">Aucune catégorie pour l&apos;instant.</p>
          <p className="mt-1 text-sm">
            Créez-en une pour organiser le catalogue et les filtres.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-line rounded-card border border-line bg-surface px-4">
          {rows.map((c) => (
            <li key={c.id} className="flex items-center gap-3 py-3.5">
              <Tags size={16} className="shrink-0 text-soft" />
              <Link
                href={`/admin/categories/${c.id}`}
                className="min-w-0 flex-1 hover:underline"
              >
                <p className="text-sm font-semibold">{c.name}</p>
                <p className="text-xs text-soft">
                  /{c.slug} · {countByCat.get(c.id) ?? 0} produit(s) · ordre{" "}
                  {c.sortOrder}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
