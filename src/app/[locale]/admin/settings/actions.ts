"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { settings } from "@/db/schema";
import { requireAdmin } from "@/lib/session";

export interface SettingsState {
  saved?: boolean;
  error?: string;
}

function chfToCents(raw: string): number | null {
  const value = Number.parseFloat(raw.replace(",", "."));
  if (!Number.isFinite(value) || value < 0 || value > 10000) return null;
  return Math.round(value * 100);
}

export async function saveSettings(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requireAdmin();

  const shipping = chfToCents(String(formData.get("shipping") || ""));
  const freeOver = chfToCents(String(formData.get("freeOver") || ""));
  if (shipping === null || freeOver === null) {
    return { error: "Valeurs invalides." };
  }

  const db = await getDb();
  const entries: [string, string][] = [
    ["shipping_cents", String(shipping)],
    ["free_shipping_over_cents", String(freeOver)],
  ];
  for (const [key, value] of entries) {
    await db
      .insert(settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: settings.key, set: { value } });
  }

  revalidatePath("/", "layout");
  return { saved: true };
}
