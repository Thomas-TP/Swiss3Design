"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { materials, filamentColors } from "@/db/schema";
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
// matière (texte) : le filtre boutique reste dérivé de l'usage réel. Les
// couleurs du filament partent en cascade (FK ON DELETE CASCADE).
export async function deleteMaterial(id: string): Promise<void> {
  await requireAdmin();
  if (id) {
    const db = await getDb();
    await db.delete(materials).where(eq(materials.id, id));
  }
  revalidatePath("/", "layout");
}

export interface ColorFormState {
  error?: string;
  success?: boolean;
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

// Ajoute une couleur (nom + hex) à la palette d'un filament.
export async function addColor(
  _prev: ColorFormState,
  formData: FormData,
): Promise<ColorFormState> {
  await requireAdmin();

  const materialId = String(formData.get("materialId") || "");
  const name = String(formData.get("name") || "")
    .trim()
    .slice(0, 40);
  const hex = String(formData.get("hex") || "").trim().toUpperCase();

  if (!materialId) return { error: "Filament introuvable." };
  if (name.length < 1) return { error: "Le nom de la couleur est obligatoire." };
  if (!HEX_RE.test(hex)) return { error: "Code couleur invalide (ex. #E5231C)." };

  const db = await getDb();
  // Place la nouvelle couleur en fin de palette.
  const existing = await db
    .select({ sortOrder: filamentColors.sortOrder })
    .from(filamentColors)
    .where(eq(filamentColors.materialId, materialId));
  const nextOrder = existing.reduce((max, r) => Math.max(max, r.sortOrder + 1), 0);

  try {
    await db
      .insert(filamentColors)
      .values({ materialId, name, hex, sortOrder: nextOrder });
  } catch (e) {
    if (String(e).includes("UNIQUE")) {
      return { error: `La couleur « ${name} » existe déjà pour ce filament.` };
    }
    return { error: "Erreur lors de l'ajout de la couleur." };
  }

  revalidatePath("/", "layout");
  return { success: true };
}

export async function deleteColor(id: string): Promise<void> {
  await requireAdmin();
  if (id) {
    const db = await getDb();
    await db.delete(filamentColors).where(eq(filamentColors.id, id));
  }
  revalidatePath("/", "layout");
}
