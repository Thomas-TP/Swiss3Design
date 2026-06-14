import { eq, sql } from "drizzle-orm";
import type { getDb } from "@/db";
import { discountCodes } from "@/db/schema";

type Db = Awaited<ReturnType<typeof getDb>>;

export interface DiscountResult {
  code: string;
  discountCents: number;
}

// Valide un code promo contre un sous-total et calcule la remise. Renvoie null
// si le code est inconnu, inactif, expiré, épuisé, ou si le minimum d'achat
// n'est pas atteint. La remise ne dépasse jamais le sous-total.
export async function validateDiscount(
  db: Db,
  rawCode: string,
  subtotalCents: number,
): Promise<DiscountResult | null> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return null;

  const [d] = await db
    .select()
    .from(discountCodes)
    .where(eq(discountCodes.code, code))
    .limit(1);
  if (!d || !d.active) return null;
  if (d.expiresAt && d.expiresAt.getTime() < Date.now()) return null;
  if (d.maxUses != null && d.usedCount >= d.maxUses) return null;
  if (d.minSubtotalCents != null && subtotalCents < d.minSubtotalCents) {
    return null;
  }

  const discountCents =
    d.type === "percent"
      ? Math.round((subtotalCents * Math.min(100, Math.max(0, d.value))) / 100)
      : Math.min(d.value, subtotalCents);
  if (discountCents <= 0) return null;

  return { code: d.code, discountCents };
}

// Incrémente le compteur d'utilisations à la vente (paiement confirmé)
export async function incrementDiscountUse(db: Db, code: string): Promise<void> {
  await db
    .update(discountCodes)
    .set({ usedCount: sql`${discountCodes.usedCount} + 1` })
    .where(eq(discountCodes.code, code));
}
