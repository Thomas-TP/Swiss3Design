"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { reviews } from "@/db/schema";
import { requireAdmin } from "@/lib/session";

const ALLOWED = ["published", "rejected", "pending"] as const;
type ReviewStatus = (typeof ALLOWED)[number];

// Modération d'un avis : publication / rejet / remise en attente.
export async function setReviewStatus(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !ALLOWED.includes(status as ReviewStatus)) return;

  const db = await getDb();
  await db
    .update(reviews)
    .set({ status: status as ReviewStatus })
    .where(eq(reviews.id, id));

  revalidatePath("/admin/reviews");
  // Rafraîchit aussi la fiche produit publique (note agrégée + liste d'avis).
  revalidatePath("/", "layout");
}
