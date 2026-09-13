import { z } from "zod";
import { and, eq, isNull, sql } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/db";
import { abandonedCarts } from "@/db/schema";
import { getServerSession } from "@/lib/session";
import { verifyEmailProof } from "@/lib/email-proof";
import { currentCartSnapshot } from "@/lib/cart-snapshot";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import type { Locale } from "@/i18n/routing";
export async function POST(request: Request) {
  if (!(await rateLimit(request, "cart-reminder", { limit: 5, windowS: 600 })))
    return tooManyRequests();
  const parsed = z
    .object({
      email: z.email().max(200),
      consent: z.literal(true),
      emailProof: z.string().optional(),
      items: z.unknown(),
      locale: z.enum(["fr", "de", "it", "en"]).catch("fr"),
    })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json({ error: "invalid" }, { status: 400 });
  const data = parsed.data;
  if (
    !data ||
    data.consent !== true ||
    typeof data.email !== "string" ||
    data.email.length > 200
  )
    return Response.json({ error: "invalid" }, { status: 400 });
  const email = data.email.trim().toLowerCase();
  const session = await getServerSession();
  const { env } = await getCloudflareContext({ async: true });
  const verified =
    (session?.user.emailVerified &&
      session.user.email.toLowerCase() === email) ||
    (typeof data.emailProof === "string" &&
      (await verifyEmailProof(email, data.emailProof, env.BETTER_AUTH_SECRET)));
  if (!verified)
    return Response.json({ error: "email_not_verified" }, { status: 403 });
  const locale: Locale = ["fr", "de", "it", "en"].includes(data.locale)
    ? data.locale
    : "fr";
  const items = await currentCartSnapshot(data.items, locale);
  if (!items.length) return Response.json({ error: "empty" }, { status: 400 });
  const db = await getDb();
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${"cart-reminder:" + email},0))`,
    );
    await tx
      .delete(abandonedCarts)
      .where(
        and(
          eq(abandonedCarts.email, email),
          isNull(abandonedCarts.reminderSentAt),
        ),
      );
    await tx.insert(abandonedCarts).values({
      email,
      token: crypto.randomUUID(),
      itemsJson: JSON.stringify(items),
      subtotalCents: items.reduce((s, i) => s + i.priceCents * i.quantity, 0),
      locale,
      consentAt: new Date(),
    });
  });
  return Response.json({ ok: true });
}
