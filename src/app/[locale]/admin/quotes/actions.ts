"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { quoteRequests } from "@/db/schema";
import { requireAdmin } from "@/lib/session";
import { sendEmail } from "@/lib/email";
import { quoteReplyEmail } from "@/lib/email-templates";
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

  const adminMessage =
    String(formData.get("adminMessage") || "").trim() || null;
  const db = await getDb();
  const [previous] = await db
    .select()
    .from(quoteRequests)
    .where(eq(quoteRequests.id, id))
    .limit(1);
  await db
    .update(quoteRequests)
    .set({
      status: status as (typeof QUOTE_STATUSES)[number],
      quotedPriceCents,
      adminMessage,
    })
    .where(eq(quoteRequests.id, id));

  // Envoie le devis au client la première fois qu'il est chiffré
  if (
    previous &&
    status === "quoted" &&
    previous.status !== "quoted" &&
    quotedPriceCents != null
  ) {
    try {
      await sendEmail(
        quoteReplyEmail({
          email: previous.email,
          locale: previous.locale,
          quotedPriceCents,
          adminMessage,
        }),
      );
    } catch (e) {
      console.error("[email devis]", e);
    }
  }

  redirect(`/${uiLocale}/admin/quotes`);
}
