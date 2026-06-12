"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import {
  products,
  productTranslations,
  productImages,
  productCategories,
  LOCALES,
} from "@/db/schema";
import { requireAdmin } from "@/lib/session";

export interface ProductFormState {
  error?: string;
  // La navigation après succès se fait côté client (router.push) :
  // redirect() dans une action useActionState peut laisser l'UI figée
  // sur le runtime Cloudflare Workers.
  success?: boolean;
}

const imagesSchema = z
  .array(
    z.object({
      url: z
        .string()
        .max(500)
        .refine(
          (u) => u.startsWith("/api/files/") || u.startsWith("/products/"),
          "URL d'image invalide",
        ),
      alt: z.string().max(200).optional(),
    }),
  )
  .max(8);

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function parsePriceToCents(raw: string): number | null {
  const value = Number.parseFloat(raw.replace(",", "."));
  if (!Number.isFinite(value) || value <= 0 || value > 100000) return null;
  return Math.round(value * 100);
}

export async function saveProduct(
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  await requireAdmin();

  const id = String(formData.get("id") || "");
  const nameFr = String(formData.get("name_fr") || "").trim();
  const descFr = String(formData.get("desc_fr") || "").trim();
  if (nameFr.length < 2 || descFr.length < 2) {
    return { error: "Le nom et la description en français sont obligatoires." };
  }

  const priceCents = parsePriceToCents(String(formData.get("price") || ""));
  if (priceCents === null) {
    return { error: "Prix invalide." };
  }

  const slug = slugify(String(formData.get("slug") || "")) || slugify(nameFr);
  if (!slug) return { error: "Slug invalide." };

  const saleType =
    formData.get("saleType") === "on_demand" ? "on_demand" : "stock";
  const productionDaysRaw = Number.parseInt(
    String(formData.get("productionDays") || ""),
    10,
  );
  const productionDays =
    saleType === "on_demand"
      ? Number.isFinite(productionDaysRaw) && productionDaysRaw > 0
        ? productionDaysRaw
        : 3
      : null;

  const stockRaw = String(formData.get("stock") || "").trim();
  const stock =
    saleType === "stock" && stockRaw !== ""
      ? Math.max(0, Number.parseInt(stockRaw, 10) || 0)
      : null;

  const weightRaw = String(formData.get("weightGrams") || "").trim();

  const parsedImages = imagesSchema.safeParse(
    JSON.parse(String(formData.get("images") || "[]")),
  );
  if (!parsedImages.success) {
    return { error: "Images invalides." };
  }

  const data = {
    slug,
    priceCents,
    saleType: saleType as "stock" | "on_demand",
    productionDays,
    material: String(formData.get("material") || "PLA").trim() || "PLA",
    dimensionsMm: String(formData.get("dimensionsMm") || "").trim() || null,
    weightGrams: weightRaw ? Number.parseInt(weightRaw, 10) || null : null,
    multicolor: formData.get("multicolor") === "on",
    featured: formData.get("featured") === "on",
    active: formData.get("active") === "on",
    stock,
  };

  const translations = LOCALES.map((l) => ({
    locale: l,
    name: String(formData.get(`name_${l}`) || "").trim() || nameFr,
    description: String(formData.get(`desc_${l}`) || "").trim() || descFr,
  }));

  const categoryIds = formData.getAll("categories").map(String);

  const db = await getDb();
  let productId = id;
  try {
    if (id) {
      await db.update(products).set(data).where(eq(products.id, id));
      await db
        .delete(productTranslations)
        .where(eq(productTranslations.productId, id));
      await db.delete(productImages).where(eq(productImages.productId, id));
      await db
        .delete(productCategories)
        .where(eq(productCategories.productId, id));
    } else {
      const [row] = await db
        .insert(products)
        .values(data)
        .returning({ id: products.id });
      productId = row.id;
    }

    await db.insert(productTranslations).values(
      translations.map((tr) => ({ ...tr, productId })),
    );
    if (parsedImages.data.length > 0) {
      await db.insert(productImages).values(
        parsedImages.data.map((img, i) => ({
          productId,
          url: img.url,
          alt: img.alt ?? nameFr,
          sortOrder: i,
        })),
      );
    }
    if (categoryIds.length > 0) {
      await db.insert(productCategories).values(
        categoryIds.map((categoryId) => ({ productId, categoryId })),
      );
    }
  } catch (e) {
    if (String(e).includes("UNIQUE")) {
      return { error: `Le slug « ${slug} » est déjà utilisé.` };
    }
    return { error: "Erreur lors de l'enregistrement." };
  }

  revalidatePath("/", "layout");
  return { success: true };
}

// Appelée directement depuis le client (pas via <form>) : la navigation
// après suppression est gérée par l'appelant.
export async function deleteProduct(id: string): Promise<void> {
  await requireAdmin();
  if (id) {
    const db = await getDb();
    await db.delete(products).where(eq(products.id, id));
  }
  revalidatePath("/", "layout");
}

// Édition rapide du stock depuis la liste (réimpression terminée, recomptage…)
export async function updateProductStock(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  const raw = String(formData.get("stock") || "").trim();
  if (!id || raw === "") return;
  const stock = Number.parseInt(raw, 10);
  if (!Number.isFinite(stock) || stock < 0 || stock > 100000) return;

  const db = await getDb();
  const [row] = await db
    .select({ stock: products.stock, saleType: products.saleType })
    .from(products)
    .where(eq(products.id, id))
    .limit(1);
  // Uniquement pour les produits vendus sur stock (pas l'impression à la demande)
  if (!row || row.saleType !== "stock") return;

  await db.update(products).set({ stock }).where(eq(products.id, id));
  revalidatePath("/", "layout");
}

export async function toggleProductActive(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  if (id) {
    const db = await getDb();
    const [row] = await db
      .select({ active: products.active })
      .from(products)
      .where(eq(products.id, id))
      .limit(1);
    if (row) {
      await db
        .update(products)
        .set({ active: !row.active })
        .where(eq(products.id, id));
    }
  }
  revalidatePath("/", "layout");
}
