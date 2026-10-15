"use server";

import { and, eq, isNotNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { canTransitionOrder } from "@/lib/payment-state";
import { getDb } from "@/db";
import { uncached } from "@/db/fresh";
import { orderItems, orders } from "@/db/schema";
import { readStudioOrderLine } from "@/lib/studio/order-line";
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
    // Objets du Studio : un humain relit chaque texte AVANT l'impression (CGV).
    // Sans relecture posée, la commande ne passe ni en production ni plus loin
    // (l'écran ne propose même pas ces statuts : ceci est la garde du serveur).
    if (["in_production", "shipped", "delivered"].includes(status)) {
      const studio = await db
        .select({ studio: orderItems.studio })
        .from(orderItems)
        .where(
          and(
            eq(orderItems.orderId, id),
            isNotNull(orderItems.studio),
            uncached,
          ),
        );
      const unreviewed = studio.some((row) => {
        const line = readStudioOrderLine(row.studio);
        return line !== null && !line.reviewedAt;
      });
      if (unreviewed) return;
    }
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

// Textes du Studio relus par l'atelier : pose `reviewedAt` (et `reviewedBy`) sur
// les lignes du Studio de la commande. Condition pour passer en production.
export async function markStudioReviewed(formData: FormData) {
  const session = await requireFreshAdmin();
  const id = String(formData.get("id") || "");
  if (!id) return;
  const db = await getDb();
  await db
    .update(orderItems)
    .set({
      studio: sql`${orderItems.studio} || jsonb_build_object('reviewedAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'reviewedBy', ${session.user.id}::text)`,
    })
    .where(
      and(
        eq(orderItems.orderId, id),
        isNotNull(orderItems.studio),
        sql`${orderItems.studio}->>'reviewedAt' is null`,
      ),
    );
  revalidatePath("/", "layout");
}

// Texte du Studio refusé (marque de tiers, injure, contenu illicite) : la
// commande est ANNULÉE et le client prévenu par un e-mail dédié. Le
// remboursement intégral se fait à la main dans Stripe (procédure : runbook) ;
// aucun bouton ne rembourse en LIVE.
export async function refuseStudioTexts(formData: FormData) {
  const session = await requireFreshAdmin();
  const id = String(formData.get("id") || "");
  if (!id) return;
  const db = await getDb();
  await db.transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, id))
      .limit(1)
      .for("update");
    if (!order || !["paid", "in_production"].includes(order.status)) return;
    const stamp = new Date().toLocaleDateString("fr-CH");
    const note = `Texte du Studio refusé le ${stamp} : commande annulée, à REMBOURSER intégralement dans Stripe.`;
    const changed = await tx
      .update(orders)
      .set({
        status: "cancelled",
        adminNote: order.adminNote ? `${order.adminNote}\n${note}` : note,
      })
      .where(and(eq(orders.id, id), eq(orders.status, order.status)))
      .returning({ id: orders.id });
    if (!changed.length) return;
    await recordStatusTransition(tx, {
      entityType: "order",
      entityId: id,
      fromStatus: order.status,
      toStatus: "cancelled",
      source: "admin",
      actorId: session.user.id,
    });
    await queueEmail(
      tx,
      "order-cancelled:" + id,
      orderCancelledEmail(order, "studio-text"),
    );
  });
  try {
    await drainEmailOutbox(db);
  } catch {
    console.error("[outbox] reprise par maintenance");
  }
  revalidatePath("/", "layout");
}
