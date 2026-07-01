"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { notificationPreferences } from "@/db/schema";
import { getServerSession } from "@/lib/session";

export async function updatePreferences(input: {
  newsletter: boolean;
  productNews: boolean;
}): Promise<{ success: true } | { error: string }> {
  const session = await getServerSession();
  if (!session) return { error: "unauthorized" };

  const db = await getDb();
  await db
    .insert(notificationPreferences)
    .values({ userId: session.user.id, ...input })
    .onConflictDoUpdate({
      target: notificationPreferences.userId,
      set: { ...input, updatedAt: new Date() },
    });

  revalidatePath("/account/notifications");
  return { success: true };
}
