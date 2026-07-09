"use server";

import { z } from "zod";
import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { products } from "@/db/schema";
import { requireAdmin } from "@/lib/session";

const selectionSchema = z.array(z.string().min(1).max(64)).max(48);

// Enregistre la « Sélection du moment » de la page d'accueil. Le client envoie
// la liste complète et ordonnée des produits retenus : on remet tout le
// catalogue à plat (featured = false), puis on (re)marque les sélectionnés
// dans l'ordre reçu. Source de vérité unique, pas de désynchronisation.
export async function saveFeaturedSelection(
  orderedIds: string[],
): Promise<void> {
  await requireAdmin();

  const parsed = selectionSchema.safeParse(orderedIds);
  if (!parsed.success) return;

  const db = await getDb();

  // On ne garde que des ids de produits réels (le formulaire ne doit pas
  // pouvoir marquer un id arbitraire), tout en préservant l'ordre demandé.
  const ids = parsed.data;
  let valid: string[] = [];
  if (ids.length > 0) {
    const rows = await db
      .select({ id: products.id })
      .from(products)
      .where(inArray(products.id, ids));
    const real = new Set(rows.map((r) => r.id));
    valid = ids.filter((id) => real.has(id));
  }

  // Remise à zéro globale, puis application de la sélection ordonnée.
  await db.update(products).set({ featured: false, featuredOrder: 0 });
  for (let i = 0; i < valid.length; i++) {
    await db
      .update(products)
      .set({ featured: true, featuredOrder: i })
      .where(eq(products.id, valid[i]));
  }

  revalidatePath("/", "layout");
}
