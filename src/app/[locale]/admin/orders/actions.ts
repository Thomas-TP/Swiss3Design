"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { orders } from "@/db/schema";
import { requireAdmin } from "@/lib/session";
import { ORDER_STATUSES } from "../ui";

export async function updateOrderStatus(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "");
  if (id && (ORDER_STATUSES as readonly string[]).includes(status)) {
    const db = await getDb();
    await db
      .update(orders)
      .set({ status: status as (typeof ORDER_STATUSES)[number] })
      .where(eq(orders.id, id));
  }
  revalidatePath("/", "layout");
}
