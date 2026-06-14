import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { discountCodes } from "@/db/schema";
import { requireAdmin } from "@/lib/session";
import { DiscountForm, type DiscountFormInitial } from "../discount-form";

export default async function EditDiscountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const db = await getDb();

  const [d] = await db
    .select()
    .from(discountCodes)
    .where(eq(discountCodes.id, id))
    .limit(1);
  if (!d) notFound();

  const initial: DiscountFormInitial = {
    id: d.id,
    code: d.code,
    type: d.type,
    value: d.value,
    minSubtotalCents: d.minSubtotalCents,
    maxUses: d.maxUses,
    expiresAt: d.expiresAt ? d.expiresAt.toISOString().slice(0, 10) : null,
    active: d.active,
  };

  return (
    <div>
      <h2 className="mb-5 text-xl font-bold">Modifier le code promo</h2>
      <DiscountForm initial={initial} />
    </div>
  );
}
