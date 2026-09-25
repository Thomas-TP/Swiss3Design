"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { canTransitionOrder } from "@/lib/payment-state";
import { getDb } from "@/db";
import { orders } from "@/db/schema";
import { requireFreshAdmin } from "@/lib/session";
import { queueEmail, drainEmailOutbox } from "@/lib/outbox";
import {
  orderShippedEmail,
  orderDeliveredEmail,
  orderCancelledEmail,
} from "@/lib/email-templates";
import { ORDER_STATUSES } from "../ui";
import { recordStatusTransition } from "@/lib/status-history";

export async function updateOrderStatus(formData: FormData) {
  const session = await requireFreshAdmin();
  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "");
  if (!id || !(ORDER_STATUSES as readonly string[]).includes(status)) {
    revalidatePath("/", "layout");
    return;
  }

  const trackingNumber =
    String(formData.get("tracking") || "")
      .trim()
      .slice(0, 60) || null;

  const db = await getDb();
  await db.transaction(async (db) => {
    const [previous] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, id))
      .limit(1)
      .for("update");
    if (!previous) {
      revalidatePath("/", "layout");
      return;
    }

    if (!canTransitionOrder(previous.status, status)) return;
    const changed = await db
      .update(orders)
      .set({
        status: status as (typeof ORDER_STATUSES)[number],
        // Le suivi saisi remplace l'ancien ; un champ vidé le supprime
        trackingNumber,
      })
      .where(and(eq(orders.id, id), eq(orders.status, previous.status)))
      .returning({ id: orders.id });
    if (!changed.length) return;
    await recordStatusTransition(db, {
      entityType: "order",
      entityId: id,
      fromStatus: previous.status,
      toStatus: status,
      source: "admin",
      actorId: session.user.id,
    });

    // E-mails de suivi du cycle de vie — envoyés une seule fois, au premier
    // passage dans le statut. Un échec d'envoi ne bloque jamais la mise à jour.
    if (status === "shipped" && previous.status !== "shipped") {
      await queueEmail(
        db,
        "order-shipped:" + id,
        orderShippedEmail(previous, trackingNumber),
      );
    } else if (status === "delivered" && previous.status !== "delivered") {
      await queueEmail(
        db,
        "order-delivered:" + id,
        orderDeliveredEmail(previous),
      );
    } else if (
      status === "cancelled" &&
      ["paid", "in_production", "shipped"].includes(previous.status)
    ) {
      // Annulation d'une commande déjà payée : le client est prévenu
      // (le remboursement se fait manuellement dans Stripe).
      await queueEmail(
        db,
        "order-cancelled:" + id,
        orderCancelledEmail(previous),
      );
    }
  });
  try {
    await drainEmailOutbox(db);
  } catch {
    console.error("[outbox] reprise par maintenance");
  }

  revalidatePath("/", "layout");
}

// Note interne (jamais visible par le client)
export async function updateOrderNote(formData: FormData) {
  await requireFreshAdmin();
  const id = String(formData.get("id") || "");
  if (!id) return;
  const adminNote =
    String(formData.get("adminNote") || "")
      .trim()
      .slice(0, 2000) || null;
  const db = await getDb();
  await db.update(orders).set({ adminNote }).where(eq(orders.id, id));
  revalidatePath("/", "layout");
}
