"use server";

import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { customerAddresses } from "@/db/schema";
import { getServerSession } from "@/lib/session";

// Mêmes règles que le checkout (src/app/api/checkout/route.ts) : Suisse
// uniquement, jamais de confiance dans la saisie client sans revalidation.
const addressSchema = z.object({
  label: z.string().trim().max(40).optional(),
  name: z.string().trim().min(2).max(120),
  street: z.string().trim().min(3).max(200),
  npa: z.string().regex(/^\d{4}$/),
  city: z.string().trim().min(2).max(120),
  canton: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .or(z.literal(""))
    .default(""),
});
export type AddressInput = z.infer<typeof addressSchema>;

type ActionResult = { success: true } | { error: string };

export async function addAddress(input: AddressInput): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session) return { error: "unauthorized" };
  const parsed = addressSchema.safeParse(input);
  if (!parsed.success) return { error: "invalid" };

  const db = await getDb();
  // Première adresse du client : par défaut automatiquement.
  const [existing] = await db
    .select({ id: customerAddresses.id })
    .from(customerAddresses)
    .where(eq(customerAddresses.userId, session.user.id))
    .limit(1);

  await db.insert(customerAddresses).values({
    userId: session.user.id,
    isDefault: !existing,
    ...parsed.data,
    label: parsed.data.label || null,
  });

  revalidatePath("/account/addresses");
  return { success: true };
}

export async function updateAddress(
  id: string,
  input: AddressInput,
): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session) return { error: "unauthorized" };
  const parsed = addressSchema.safeParse(input);
  if (!parsed.success) return { error: "invalid" };

  const db = await getDb();
  const result = await db
    .update(customerAddresses)
    .set({
      ...parsed.data,
      label: parsed.data.label || null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(customerAddresses.id, id),
        eq(customerAddresses.userId, session.user.id),
      ),
    )
    .returning({ id: customerAddresses.id });
  if (result.length === 0) return { error: "not_found" };

  revalidatePath("/account/addresses");
  return { success: true };
}

export async function deleteAddress(id: string): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session) return { error: "unauthorized" };

  const db = await getDb();
  const [target] = await db
    .select({ isDefault: customerAddresses.isDefault })
    .from(customerAddresses)
    .where(
      and(
        eq(customerAddresses.id, id),
        eq(customerAddresses.userId, session.user.id),
      ),
    )
    .limit(1);
  if (!target) return { error: "not_found" };

  await db
    .delete(customerAddresses)
    .where(
      and(
        eq(customerAddresses.id, id),
        eq(customerAddresses.userId, session.user.id),
      ),
    );

  // L'adresse supprimée était la par défaut : en reporter une autre si possible.
  if (target.isDefault) {
    const [next] = await db
      .select({ id: customerAddresses.id })
      .from(customerAddresses)
      .where(eq(customerAddresses.userId, session.user.id))
      .limit(1);
    if (next) {
      await db
        .update(customerAddresses)
        .set({ isDefault: true })
        .where(eq(customerAddresses.id, next.id));
    }
  }

  revalidatePath("/account/addresses");
  return { success: true };
}

export async function setDefaultAddress(id: string): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session) return { error: "unauthorized" };

  const db = await getDb();
  const [target] = await db
    .select({ id: customerAddresses.id })
    .from(customerAddresses)
    .where(
      and(
        eq(customerAddresses.id, id),
        eq(customerAddresses.userId, session.user.id),
      ),
    )
    .limit(1);
  if (!target) return { error: "not_found" };

  // Une seule adresse par défaut : on retire l'ancienne avant de poser la nouvelle.
  await db
    .update(customerAddresses)
    .set({ isDefault: false })
    .where(
      and(
        eq(customerAddresses.userId, session.user.id),
        eq(customerAddresses.isDefault, true),
      ),
    );
  await db
    .update(customerAddresses)
    .set({ isDefault: true })
    .where(eq(customerAddresses.id, id));

  revalidatePath("/account/addresses");
  return { success: true };
}
