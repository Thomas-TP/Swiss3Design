"use server";

import { and, eq, inArray, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { getDb } from "@/db";
import {
  orders,
  orderItems,
  reviews,
  products,
  productVariants,
  productImages,
} from "@/db/schema";
import { findColorOption } from "@/lib/filament/shop";
import { loadProductColors } from "@/lib/filament/shop-db";
import { getServerSession } from "@/lib/session";

export interface ReviewState {
  success?: boolean;
  error?: string;
}

// Dépose un avis. Garde-fous (côté serveur, jamais la confiance au client) :
// la commande appartient à l'utilisateur, elle est LIVRÉE, et le produit y
// figure. L'unicité (orderId, productId) empêche le doublon.
export async function submitReview(
  _prev: ReviewState,
  formData: FormData,
): Promise<ReviewState> {
  const session = await getServerSession();
  if (!session) return { error: "unauthorized" };
  const { user } = session;

  const orderId = String(formData.get("orderId") ?? "");
  const productId = String(formData.get("productId") ?? "");
  const rating = Number(formData.get("rating") ?? 0);
  const body =
    String(formData.get("body") ?? "")
      .trim()
      .slice(0, 1000) || null;

  if (!orderId || !productId) return { error: "invalid" };
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { error: "invalid_rating" };
  }

  const db = await getDb();

  const [order] = await db
    .select({ id: orders.id, status: orders.status })
    .from(orders)
    .where(
      and(
        eq(orders.id, orderId),
        or(eq(orders.customerId, user.id), eq(orders.email, user.email)),
      ),
    )
    .limit(1);
  if (!order) return { error: "not_found" };
  if (order.status !== "delivered") return { error: "not_delivered" };

  const [item] = await db
    .select({ id: orderItems.id })
    .from(orderItems)
    .where(
      and(eq(orderItems.orderId, orderId), eq(orderItems.productId, productId)),
    )
    .limit(1);
  if (!item) return { error: "not_in_order" };

  try {
    await db.insert(reviews).values({
      productId,
      orderId,
      customerId: user.id,
      authorName: user.name,
      rating,
      body,
    });
  } catch {
    // Violation de l'unicité (orderId, productId) → déjà noté.
    return { error: "already_reviewed" };
  }

  revalidatePath(`/account/orders/${orderId}`);
  return { success: true };
}

import type { StudioCartItem } from "@/lib/cart-data";
import { buildStudioCartLine } from "@/lib/studio/cart-line";
import { readStudioOrderLine } from "@/lib/studio/order-line";
import {
  validateStudioLine,
  type StudioLineInput,
} from "@/lib/studio/purchase";

export interface ReorderItem {
  productId: string;
  variantId: string | null;
  variantName: string | null;
  /** Référence du stock de la couleur (les couleurs de la boutique sont celles du stock). */
  colorRef: string | null;
  colorName: string | null;
  colorHex: string | null;
  weightGrams: number | null;
  slug: string;
  name: string;
  priceCents: number;
  imageUrl: string | null;
  saleType: "stock" | "on_demand";
  quantity: number;
}

// Reconstruit les lignes d'une commande passée pour le rachat 1-clic. Relit
// les produits ACTUELS (prix/stock/slug du jour) : orderItems n'est qu'un
// snapshot figé de la commande, pas une source réutilisable pour un nouvel
// achat. Les lignes dont le produit/variante a disparu ou est en rupture
// sont silencieusement écartées (unavailableCount les compte pour affichage).
export async function getReorderItems(orderId: string): Promise<
  | {
      items: ReorderItem[];
      /** Objets du Studio de la commande, revalidés et repricés au barème du jour. */
      studioItems: StudioCartItem[];
      unavailableCount: number;
    }
  | { error: string }
> {
  const session = await getServerSession();
  if (!session) return { error: "unauthorized" };
  const { user } = session;

  const db = await getDb();
  const [order] = await db
    .select({ id: orders.id, locale: orders.locale })
    .from(orders)
    .where(
      and(
        eq(orders.id, orderId),
        or(eq(orders.customerId, user.id), eq(orders.email, user.email)),
      ),
    )
    .limit(1);
  if (!order) return { error: "not_found" };

  const lines = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  const productIds = [
    ...new Set(
      lines.map((l) => l.productId).filter((id): id is string => !!id),
    ),
  ];
  const variantIds = [
    ...new Set(
      lines.map((l) => l.variantId).filter((id): id is string => !!id),
    ),
  ];

  const [dbProducts, dbVariants, dbImages] = await Promise.all([
    productIds.length
      ? db.select().from(products).where(inArray(products.id, productIds))
      : Promise.resolve([] as (typeof products.$inferSelect)[]),
    variantIds.length
      ? db
          .select()
          .from(productVariants)
          .where(inArray(productVariants.id, variantIds))
      : Promise.resolve([] as (typeof productVariants.$inferSelect)[]),
    productIds.length
      ? db
          .select()
          .from(productImages)
          .where(inArray(productImages.productId, productIds))
          .orderBy(productImages.sortOrder)
      : Promise.resolve([] as (typeof productImages.$inferSelect)[]),
  ]);
  const productById = new Map(dbProducts.map((p) => [p.id, p]));
  const variantById = new Map(dbVariants.map((v) => [v.id, v]));
  // Couleurs actuelles de chaque article. La ligne de la commande ne garde que le
  // NOM affiché dans la langue de la commande : on le retrouve dans cette langue,
  // puis on l'affiche dans celle du client.
  const currentLocale = await getLocale();
  const orderLocale = order.locale || currentLocale;
  const [orderPalettes, currentPalettes] = await Promise.all([
    loadProductColors(db, productIds, orderLocale),
    orderLocale === currentLocale
      ? null
      : loadProductColors(db, productIds, currentLocale),
  ]);
  const firstImageByProduct = new Map<string, string>();
  for (const img of dbImages) {
    if (!firstImageByProduct.has(img.productId)) {
      firstImageByProduct.set(img.productId, img.url);
    }
  }

  const items: ReorderItem[] = [];
  const studioItems: StudioCartItem[] = [];
  let unavailableCount = 0;

  for (const line of lines) {
    // Objet du Studio : la configuration gardée est revalidée (schéma strict,
    // imprimable) puis repricée au barème du jour, comme à un nouvel achat.
    const studio = readStudioOrderLine(line.studio);
    if (studio) {
      const checked = validateStudioLine({
        kind: "studio",
        object: studio.object,
        config: studio.config as unknown as Record<string, unknown>,
        texts: studio.texts,
        locale: studio.locale,
        quantity: Math.min(20, Math.max(1, line.quantity)),
      } satisfies StudioLineInput);
      if (!checked.ok) {
        unavailableCount++;
        continue;
      }
      studioItems.push(
        buildStudioCartLine({
          config: checked.line.config,
          texts: checked.line.texts,
          locale: studio.locale,
          quantity: checked.line.quantity,
        }),
      );
      continue;
    }
    const product = line.productId
      ? productById.get(line.productId)
      : undefined;
    if (!product || !product.active) {
      unavailableCount++;
      continue;
    }

    let priceCents = product.priceCents;
    let stock = product.stock;
    let variantName: string | null = null;
    if (line.variantId) {
      const variant = variantById.get(line.variantId);
      if (!variant) {
        unavailableCount++;
        continue;
      }
      priceCents = variant.priceCents ?? product.priceCents;
      stock = variant.stock;
      variantName = variant.name;
    }
    if (stock !== null && stock < 1) {
      unavailableCount++;
      continue;
    }

    // Un article qui propose des couleurs exige celle de la commande ; si elle ne
    // l'est plus (décochée, retirée du stock), la ligne est écartée comme un article
    // retiré. Sans palette (stock non suivi), pas de couleur.
    const palette = orderPalettes.get(product.id) ?? [];
    const matched = palette.length
      ? findColorOption(palette, line.colorName)
      : undefined;
    if (palette.length && !matched) {
      unavailableCount++;
      continue;
    }
    const color = matched
      ? ((currentPalettes ?? orderPalettes)
          .get(product.id)
          ?.find((c) => c.id === matched.id) ?? matched)
      : null;

    items.push({
      productId: product.id,
      variantId: line.variantId,
      variantName,
      colorRef: color?.id ?? null,
      colorName: color?.name ?? null,
      colorHex: color?.hex ?? null,
      weightGrams: product.weightGrams,
      slug: product.slug,
      name: line.nameSnapshot,
      priceCents,
      imageUrl: firstImageByProduct.get(product.id) ?? null,
      saleType: product.saleType,
      quantity: line.quantity,
    });
  }

  return { items, studioItems, unavailableCount };
}
