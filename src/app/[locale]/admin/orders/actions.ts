"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { orders } from "@/db/schema";
import { requireAdmin } from "@/lib/session";
import { sendEmail } from "@/lib/email";
import {
  orderShippedEmail,
  orderDeliveredEmail,
  orderCancelledEmail,
} from "@/lib/email-templates";
import { ORDER_STATUSES } from "../ui";

export async function updateOrderStatus(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "");
  if (!id || !(ORDER_STATUSES as readonly string[]).includes(status)) {
    revalidatePath("/", "layout");
    return;
  }

  const trackingNumber =
    String(formData.get("tracking") || "").trim().slice(0, 60) || null;

  const db = await getDb();
  const [previous] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, id))
    .limit(1);
  if (!previous) {
    revalidatePath("/", "layout");
    return;
  }

  await db
    .update(orders)
    .set({
      status: status as (typeof ORDER_STATUSES)[number],
      // Le suivi saisi remplace l'ancien ; un champ vidé le supprime
      trackingNumber,
    })
    .where(eq(orders.id, id));

  // E-mails de suivi du cycle de vie — envoyés une seule fois, au premier
  // passage dans le statut. Un échec d'envoi ne bloque jamais la mise à jour.
  try {
    if (status === "shipped" && previous.status !== "shipped") {
      await sendEmail(orderShippedEmail(previous, trackingNumber));
    } else if (status === "delivered" && previous.status !== "delivered") {
      await sendEmail(orderDeliveredEmail(previous));
    } else if (
      status === "cancelled" &&
      ["paid", "in_production", "shipped"].includes(previous.status)
    ) {
      // Annulation d'une commande déjà payée : le client est prévenu
      // (le remboursement se fait manuellement dans Stripe).
      await sendEmail(orderCancelledEmail(previous));
    }
  } catch (e) {
    console.error("[email statut commande]", e);
  }

  revalidatePath("/", "layout");
}

// Note interne (jamais visible par le client)
export async function updateOrderNote(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) return;
  const adminNote =
    String(formData.get("adminNote") || "").trim().slice(0, 2000) || null;
  const db = await getDb();
  await db.update(orders).set({ adminNote }).where(eq(orders.id, id));
  revalidatePath("/", "layout");
}
