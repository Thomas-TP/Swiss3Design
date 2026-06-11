"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { orders } from "@/db/schema";
import { requireAdmin } from "@/lib/session";
import { sendEmail } from "@/lib/email";
import { orderShippedEmail } from "@/lib/email-templates";
import { ORDER_STATUSES } from "../ui";

export async function updateOrderStatus(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "");
  if (id && (ORDER_STATUSES as readonly string[]).includes(status)) {
    const db = await getDb();
    const [previous] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, id))
      .limit(1);
    await db
      .update(orders)
      .set({ status: status as (typeof ORDER_STATUSES)[number] })
      .where(eq(orders.id, id));

    // Notifie le client quand sa commande part à la Poste
    if (previous && status === "shipped" && previous.status !== "shipped") {
      try {
        await sendEmail(orderShippedEmail(previous));
      } catch (e) {
        console.error("[email expédition]", e);
      }
    }
  }
  revalidatePath("/", "layout");
}
