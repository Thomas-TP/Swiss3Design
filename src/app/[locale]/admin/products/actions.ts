"use server";

import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import {
  products,
  productTranslations,
  productImages,
  productVariants,
  productCategories,
  productFilamentExclusions,
  LOCALES,
} from "@/db/schema";
import { SHOP_MATERIAL } from "@/lib/filament/shop";
import { loadShopRefs } from "@/lib/filament/shop-db";
import { isMissingTable } from "@/lib/filament/stock-db";
import { requireFreshAdmin } from "@/lib/session";
import { notifyIndexNow } from "@/lib/indexnow";
import { pushCatalogChange } from "@/lib/commerce/stripe-catalog";

// Fiche(s) + catalogue à signaler à IndexNow après une modification : le
// catalogue liste les produits, il change donc avec eux.
const changedPaths = (...slugs: (string | null | undefined)[]) => [
  ...new Set(slugs.filter(Boolean).map((s) => `/products/${s}`)),
  "/shop",
];

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

const variantsSchema = z
  .array(
    z.object({
      name: z.string().max(80),
      sku: z.string().max(60).optional(),
      price: z.string().max(20).optional(),
      stock: z.string().max(10).optional(),
    }),
  )
  .max(20);

// Références du stock décochées pour l'article (ids de `filament_refs`).
const excludedRefsSchema = z.array(z.string().max(80)).max(200);

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
  await requireFreshAdmin();

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

  const parsedVariants = variantsSchema.safeParse(
    JSON.parse(String(formData.get("variants") || "[]")),
  );
  if (!parsedVariants.success) {
    return { error: "Variantes invalides." };
  }
  const variantRows = parsedVariants.data
    .filter((v) => v.name.trim())
    .map((v, i) => {
      const priceStr = v.price?.trim() ?? "";
      const stockStr = v.stock?.trim() ?? "";
      return {
        sku: (v.sku?.trim() || `${slug}-${i + 1}`).slice(0, 60),
        name: v.name.trim().slice(0, 80),
        // prix vide → hérite du produit ; stock vide → non suivi
        priceCents: priceStr ? parsePriceToCents(priceStr) : null,
        stock: stockStr
          ? Math.max(0, Number.parseInt(stockStr, 10) || 0)
          : null,
      };
    });

  const data = {
    slug,
    priceCents,
    saleType: saleType as "stock" | "on_demand",
    productionDays,
    // L'atelier n'imprime qu'en PLA : la matière n'est plus un choix de l'admin.
    material: SHOP_MATERIAL,
    dimensionsMm: String(formData.get("dimensionsMm") || "").trim() || null,
    weightGrams: weightRaw ? Number.parseInt(weightRaw, 10) || null : null,
    model3dUrl: String(formData.get("model3dUrl") || "").trim() || null,
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

  const parsedExclusions = excludedRefsSchema.safeParse(
    JSON.parse(String(formData.get("excludedRefs") || "[]")),
  );
  if (!parsedExclusions.success) {
    return { error: "Couleurs invalides." };
  }

  const db = await getDb();

  // Les couleurs sont celles du stock (actives, « sur mesure ») ; l'article n'en
  // garde que les EXCLUSIONS. On ne retient que des références réellement
  // proposées : le formulaire ne doit pas pouvoir injecter d'id arbitraire.
  const shopRefIds = (await loadShopRefs(db, { fresh: true })).map((r) => r.id);
  const exclusions = [...new Set(parsedExclusions.data)].filter((refId) =>
    shopRefIds.includes(refId),
  );

  // Ancien slug (renommage) : l'ancienne URL devient une 404 à signaler aussi.
  const previousSlug = id
    ? (
        await db
          .select({ slug: products.slug })
          .from(products)
          .where(eq(products.id, id))
          .limit(1)
      )[0]?.slug
    : undefined;

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
      await db.delete(productVariants).where(eq(productVariants.productId, id));
    } else {
      const [row] = await db
        .insert(products)
        .values(data)
        .returning({ id: products.id });
      productId = row.id;
    }

    await db
      .insert(productTranslations)
      .values(translations.map((tr) => ({ ...tr, productId })));
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
      await db
        .insert(productCategories)
        .values(categoryIds.map((categoryId) => ({ productId, categoryId })));
    }
    if (variantRows.length > 0) {
      await db
        .insert(productVariants)
        .values(variantRows.map((v) => ({ ...v, productId })));
    }
  } catch (e) {
    if (String(e).includes("UNIQUE")) {
      return { error: `Le slug « ${slug} » est déjà utilisé.` };
    }
    return { error: "Erreur lors de l'enregistrement." };
  }

  // Exclusions de couleurs : on remplace celles des références proposées (une
  // exclusion d'une référence désactivée entre-temps reste intacte, elle
  // reprendra effet si la référence revient). Migration 0011 absente : rien à
  // effacer ; une exclusion demandée ne peut alors pas être enregistrée.
  let exclusionsSaved = true;
  try {
    if (shopRefIds.length > 0)
      await db
        .delete(productFilamentExclusions)
        .where(
          and(
            eq(productFilamentExclusions.productId, productId),
            inArray(productFilamentExclusions.refId, shopRefIds),
          ),
        );
    if (exclusions.length > 0)
      await db
        .insert(productFilamentExclusions)
        .values(exclusions.map((refId) => ({ productId, refId })));
  } catch (e) {
    if (!isMissingTable(e)) {
      console.error("[admin] exclusions de couleurs", e);
      return { error: "Produit enregistré, mais pas ses couleurs décochées." };
    }
    exclusionsSaved = exclusions.length === 0;
  }

  revalidatePath("/", "layout");
  await notifyIndexNow(changedPaths(slug, previousSlug));
  // Catalogue des agents IA (Stripe) : fiche complète renvoyée.
  await pushCatalogChange(db, "product");
  if (!exclusionsSaved)
    return {
      error:
        "Produit enregistré, mais la migration 0011 (couleurs décochées) n'est pas appliquée : les couleurs décochées n'ont pas été prises en compte.",
    };
  return { success: true };
}

// Appelée directement depuis le client (pas via <form>) : la navigation
// après suppression est gérée par l'appelant.
export async function deleteProduct(id: string): Promise<void> {
  await requireFreshAdmin();
  if (id) {
    const db = await getDb();
    const [deleted] = await db
      .delete(products)
      .where(eq(products.id, id))
      .returning({ slug: products.slug });
    await notifyIndexNow(changedPaths(deleted?.slug));
    await pushCatalogChange(db, "product");
  }
  revalidatePath("/", "layout");
}

// Édition rapide du stock depuis la liste (réimpression terminée, recomptage…)
export async function updateProductStock(formData: FormData) {
  await requireFreshAdmin();
  const id = String(formData.get("id") || "");
  const raw = String(formData.get("stock") || "").trim();
  if (!id || raw === "") return;
  const stock = Number.parseInt(raw, 10);
  if (!Number.isFinite(stock) || stock < 0 || stock > 100000) return;

  const db = await getDb();
  const [row] = await db
    .select({
      stock: products.stock,
      saleType: products.saleType,
      slug: products.slug,
    })
    .from(products)
    .where(eq(products.id, id))
    .limit(1);
  // Uniquement pour les produits vendus sur stock (pas l'impression à la demande)
  if (!row || row.saleType !== "stock") return;

  await db.update(products).set({ stock }).where(eq(products.id, id));
  revalidatePath("/", "layout");
  // Passage en rupture / retour en stock : la disponibilité du JSON-LD change.
  const wasAvailable = (row.stock ?? 0) > 0;
  if (wasAvailable !== stock > 0) await notifyIndexNow(changedPaths(row.slug));
  await pushCatalogChange(db, "stock");
}

export async function toggleProductActive(formData: FormData) {
  await requireFreshAdmin();
  const id = String(formData.get("id") || "");
  if (id) {
    const db = await getDb();
    const [row] = await db
      .select({ active: products.active, slug: products.slug })
      .from(products)
      .where(eq(products.id, id))
      .limit(1);
    if (row) {
      await db
        .update(products)
        .set({ active: !row.active })
        .where(eq(products.id, id));
      // Publiée ou retirée : la fiche apparaît ou devient une 404.
      await notifyIndexNow(changedPaths(row.slug));
      // Flux complet (mode replace) : une fiche retirée disparaît chez Stripe.
      await pushCatalogChange(db, "product");
    }
  }
  revalidatePath("/", "layout");
}
