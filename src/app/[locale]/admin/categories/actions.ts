"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { categories, categoryTranslations, LOCALES } from "@/db/schema";
import { requireAdmin } from "@/lib/session";

export interface CategoryFormState {
  error?: string;
  // Navigation après succès côté client (router.push) — voir produits.
  success?: boolean;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function saveCategory(
  _prev: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  await requireAdmin();

  const id = String(formData.get("id") || "");
  const nameFr = String(formData.get("name_fr") || "").trim();
  if (nameFr.length < 2) {
    return { error: "Le nom en français est obligatoire." };
  }
  const slug =
    slugify(String(formData.get("slug") || "")) || slugify(nameFr);
  if (!slug) return { error: "Slug invalide." };

  const sortOrderRaw = Number.parseInt(
    String(formData.get("sortOrder") || "0"),
    10,
  );
  const sortOrder = Number.isFinite(sortOrderRaw) ? sortOrderRaw : 0;

  const translations = LOCALES.map((l) => ({
    locale: l,
    name: String(formData.get(`name_${l}`) || "").trim() || nameFr,
  }));

  const db = await getDb();
  let categoryId = id;
  try {
    if (id) {
      await db
        .update(categories)
        .set({ slug, sortOrder })
        .where(eq(categories.id, id));
      await db
        .delete(categoryTranslations)
        .where(eq(categoryTranslations.categoryId, id));
    } else {
      const [row] = await db
        .insert(categories)
        .values({ slug, sortOrder })
        .returning({ id: categories.id });
      categoryId = row.id;
    }
    await db
      .insert(categoryTranslations)
      .values(translations.map((tr) => ({ ...tr, categoryId })));
  } catch (e) {
    if (String(e).includes("UNIQUE")) {
      return { error: `Le slug « ${slug} » est déjà utilisé.` };
    }
    return { error: "Erreur lors de l'enregistrement." };
  }

  revalidatePath("/", "layout");
  return { success: true };
}

export async function deleteCategory(id: string): Promise<void> {
  await requireAdmin();
  if (id) {
    const db = await getDb();
    // Les liens produit↔catégorie sont supprimés par cascade (FK)
    await db.delete(categories).where(eq(categories.id, id));
  }
  revalidatePath("/", "layout");
}
