"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { quoteRequests } from "@/db/schema";
import { requireAdmin } from "@/lib/session";
import { QUOTE_STATUSES } from "../ui";

export async function updateQuote(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  const uiLocale = String(formData.get("ui_locale") || "fr");
  const status = String(formData.get("status") || "");
  if (!id || !(QUOTE_STATUSES as readonly string[]).includes(status)) {
    revalidatePath("/", "layout");
    return;
  }

  const priceRaw = String(formData.get("price") || "").trim();
  let quotedPriceCents: number | null = null;
  if (priceRaw) {
    const value = Number.parseFloat(priceRaw.replace(",", "."));
    if (Number.isFinite(value) && value > 0) {
      quotedPriceCents = Math.round(value * 100);
    }
  }

  const db = await getDb();
  await db
    .update(quoteRequests)
    .set({
      status: status as (typeof QUOTE_STATUSES)[number],
      quotedPriceCents,
      adminMessage: String(formData.get("adminMessage") || "").trim() || null,
    })
    .where(eq(quoteRequests.id, id));

  redirect(`/${uiLocale}/admin/quotes`);
}
