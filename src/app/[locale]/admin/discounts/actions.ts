"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { discountCodes } from "@/db/schema";
import { requireAdmin } from "@/lib/session";

export interface DiscountFormState {
  error?: string;
  success?: boolean;
}

function chfToCents(raw: string): number | null {
  const v = Number.parseFloat(raw.replace(",", "."));
  if (!Number.isFinite(v) || v < 0) return null;
  return Math.round(v * 100);
}

export async function saveDiscount(
  _prev: DiscountFormState,
  formData: FormData,
): Promise<DiscountFormState> {
  await requireAdmin();

  const id = String(formData.get("id") || "");
  const code = String(formData.get("code") || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  if (code.length < 2) return { error: "Code requis (2 caractères min)." };

  const type = formData.get("type") === "fixed" ? "fixed" : "percent";
  const rawValue = String(formData.get("value") || "").trim();
  let value: number | null = null;
  if (type === "percent") {
    const p = Number.parseInt(rawValue, 10);
    value = Number.isFinite(p) && p > 0 && p <= 100 ? p : null;
  } else {
    const cents = chfToCents(rawValue);
    value = cents && cents > 0 ? cents : null;
  }
  if (value === null) {
    return {
      error:
        type === "percent"
          ? "Pourcentage invalide (1 à 100)."
          : "Montant invalide.",
    };
  }

  const minRaw = String(formData.get("minSubtotal") || "").trim();
  const minSubtotalCents = minRaw ? chfToCents(minRaw) : null;
  const maxRaw = String(formData.get("maxUses") || "").trim();
  const maxUses = maxRaw ? Math.max(1, Number.parseInt(maxRaw, 10) || 0) || null : null;
  const expiresRaw = String(formData.get("expiresAt") || "").trim();
  const expiresAt = expiresRaw ? new Date(expiresRaw) : null;
  if (expiresAt && Number.isNaN(expiresAt.getTime())) {
    return { error: "Date d'expiration invalide." };
  }
  const active = formData.get("active") === "on";

  const data = {
    code,
    type: type as "percent" | "fixed",
    value,
    minSubtotalCents,
    maxUses,
    expiresAt,
    active,
  };

  const db = await getDb();
  try {
    if (id) {
      // usedCount n'est pas dans data → préservé
      await db.update(discountCodes).set(data).where(eq(discountCodes.id, id));
    } else {
      await db.insert(discountCodes).values(data);
    }
  } catch (e) {
    if (String(e).includes("UNIQUE")) {
      return { error: `Le code « ${code} » existe déjà.` };
    }
    return { error: "Erreur lors de l'enregistrement." };
  }

  revalidatePath("/", "layout");
  return { success: true };
}

export async function deleteDiscount(id: string): Promise<void> {
  await requireAdmin();
  if (id) {
    const db = await getDb();
    await db.delete(discountCodes).where(eq(discountCodes.id, id));
  }
  revalidatePath("/", "layout");
}
