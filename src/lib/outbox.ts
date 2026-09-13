import { and, eq, isNull, lt, lte, or, sql } from "drizzle-orm";
import type { getDb } from "@/db";
import { emailOutbox, abandonedCarts } from "@/db/schema";
import { sendEmail, type EmailMessage } from "./email";
type Db = Awaited<ReturnType<typeof getDb>>;
export type Transaction = Parameters<Parameters<Db["transaction"]>[0]>[0];
export async function queueEmail(
  db: Pick<Db, "insert">,
  key: string,
  message: EmailMessage,
) {
  await db
    .insert(emailOutbox)
    .values({ key, messageJson: JSON.stringify(message) })
    .onConflictDoNothing();
}
export async function drainEmailOutbox(db: Db, limit = 10) {
  const now = new Date();
  const available = and(
    isNull(emailOutbox.sentAt),
    lte(emailOutbox.availableAt, now),
    or(
      isNull(emailOutbox.lockedAt),
      lt(emailOutbox.lockedAt, new Date(now.getTime() - 120000)),
    ),
  );
  const rows = await db
    .select()
    .from(emailOutbox)
    .where(available)
    .limit(limit);
  let sent = 0;
  for (const row of rows) {
    // Resend déduplique pendant 24 h : au-delà, revue humaine plutôt qu'un doublon incertain.
    if (
      row.attempts >= 8 ||
      (row.attempts > 0 &&
        now.getTime() - row.createdAt.getTime() > 23 * 3600000)
    ) {
      console.error("[outbox] intervention nécessaire", {
        key: row.key,
        attempts: row.attempts,
      });
      // Écarter les messages à examiner pour qu'ils ne bloquent pas la file.
      await db
        .update(emailOutbox)
        .set({ availableAt: new Date(now.getTime() + 365 * 86400000) })
        .where(eq(emailOutbox.key, row.key));
      continue;
    }
    const [claim] = await db
      .update(emailOutbox)
      .set({ lockedAt: now, attempts: sql`${emailOutbox.attempts}+1` })
      .where(and(eq(emailOutbox.key, row.key), available))
      .returning();
    if (!claim) continue;
    try {
      if (row.key.startsWith("cart-reminder:")) {
        const [cart] = await db
          .select()
          .from(abandonedCarts)
          .where(eq(abandonedCarts.id, row.key.slice("cart-reminder:".length)));
        // Une relance en attente ne survit ni à un achat ni au retrait du consentement.
        if (
          !cart ||
          cart.recoveredAt ||
          cart.unsubscribedAt ||
          cart.reminderSentAt
        ) {
          await db.delete(emailOutbox).where(eq(emailOutbox.key, row.key));
          continue;
        }
      }
      const ok = await sendEmail(
        JSON.parse(row.messageJson) as EmailMessage,
        row.key,
      );
      if (!ok) throw new Error("email_delivery_failed");
      await db
        .update(emailOutbox)
        .set({ sentAt: new Date(), lockedAt: null })
        .where(eq(emailOutbox.key, row.key));
      if (row.key.startsWith("cart-reminder:"))
        await db
          .update(abandonedCarts)
          .set({ reminderSentAt: new Date() })
          .where(eq(abandonedCarts.id, row.key.slice("cart-reminder:".length)));
      sent++;
    } catch {
      await db
        .update(emailOutbox)
        .set({
          lockedAt: null,
          availableAt: new Date(
            Date.now() + Math.min(3600, 60 * 2 ** row.attempts) * 1000,
          ),
        })
        .where(eq(emailOutbox.key, row.key));
    }
  }
  return sent;
}
