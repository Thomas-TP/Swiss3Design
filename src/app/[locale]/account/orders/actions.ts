"use server";

import { and, eq, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { orders, orderItems, reviews } from "@/db/schema";
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
