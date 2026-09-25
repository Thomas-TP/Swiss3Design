import { z } from "zod";
import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { abandonedCarts } from "@/db/schema";
import { currentCartSnapshot } from "@/lib/cart-snapshot";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
export async function POST(request: Request) {
  if (!(await rateLimit(request, "cart-restore", { limit: 15, windowS: 600 })))
    return tooManyRequests();
  const parsed = z
    .object({ token: z.uuid() })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json({ error: "invalid" }, { status: 400 });
  const data = parsed.data;
  if (typeof data?.token !== "string" || !/^[0-9a-f-]{36}$/i.test(data.token))
    return Response.json({ error: "invalid" }, { status: 400 });
  const db = await getDb();
  const [cart] = await db
    .select()
    .from(abandonedCarts)
    .where(
      and(
        eq(abandonedCarts.token, data.token),
        gt(abandonedCarts.createdAt, new Date(Date.now() - 30 * 86400000)),
        isNull(abandonedCarts.unsubscribedAt),
      ),
    )
    .limit(1);
  if (!cart) return Response.json({ error: "expired" }, { status: 404 });
  const items = await currentCartSnapshot(
    JSON.parse(cart.itemsJson),
    cart.locale,
  );
  return Response.json(
    { items },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
