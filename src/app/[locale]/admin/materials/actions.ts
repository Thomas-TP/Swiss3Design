"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { materials } from "@/db/schema";
import { requireAdmin } from "@/lib/session";

export interface MaterialFormState {
  error?: string;
  success?: boolean;
}

export async function addMaterial(
  _prev: MaterialFormState,
  formData: FormData,
): Promise<MaterialFormState> {
  await requireAdmin();

  const name = String(formData.get("name") || "")
    .trim()
    .slice(0, 60);
  if (name.length < 1) {
    return { error: "Le nom du filament est obligatoire." };
  }

  const db = await getDb();
  try {
    await db.insert(materials).values({ name });
  } catch (e) {
    if (String(e).includes("UNIQUE")) {
      return { error: `Le filament « ${name} » existe déjà.` };
    }
    return { error: "Erreur lors de l'ajout." };
  }

  revalidatePath("/", "layout");
  return { success: true };
}

// Retire le filament de la palette. Les produits qui l'utilisent gardent leur
// matière (texte) : le filtre boutique reste dérivé de l'usage réel.
export async function deleteMaterial(id: string): Promise<void> {
  await requireAdmin();
  if (id) {
    const db = await getDb();
    await db.delete(materials).where(eq(materials.id, id));
  }
  revalidatePath("/", "layout");
}
