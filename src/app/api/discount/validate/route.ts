import { z } from "zod";
import { getDb } from "@/db";
import { validateDiscount } from "@/lib/discounts";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

// Validation d'affichage d'un code promo (le checkout revalide de façon
// autoritaire avec le sous-total recalculé en base).
const bodySchema = z.object({
  code: z.string().min(1).max(40),
  subtotalCents: z.number().int().min(0).max(100_000_000),
});

export async function POST(request: Request) {
  if (!(await rateLimit(request, "discount", { limit: 30, windowS: 600 }))) {
    return tooManyRequests();
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ valid: false }, { status: 400 });
  }
  const db = await getDb();
  const result = await validateDiscount(
    db,
    parsed.data.code,
    parsed.data.subtotalCents,
  );
  if (!result) return Response.json({ valid: false });
  return Response.json({
    valid: true,
    code: result.code,
    discountCents: result.discountCents,
  });
}
