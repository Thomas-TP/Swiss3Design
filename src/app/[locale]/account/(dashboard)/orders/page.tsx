import { Package } from "lucide-react";
import { desc, eq, or } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getDb } from "@/db";
import { orders } from "@/db/schema";
import { getServerSession } from "@/lib/session";
import { formatChf } from "@/lib/format";
import { statusStyle } from "../_ui";

export const dynamic = "force-dynamic";

export default async function OrdersTab({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const session = await getServerSession();
  const { user } = session!;

  const db = await getDb();
  const [myOrders, t] = await Promise.all([
    db
      .select()
      .from(orders)
      .where(or(eq(orders.customerId, user.id), eq(orders.email, user.email)))
      .orderBy(desc(orders.createdAt))
      .limit(100),
    getTranslations("account"),
  ]);

  return (
    <div>
      <h1 className="flex items-center gap-2 text-xl font-bold">
        <Package size={19} className="text-soft" />
        {t("myOrders")}
      </h1>

      {myOrders.length === 0 ? (
        <p className="mt-6 rounded-card border border-line bg-surface p-6 text-sm text-soft">
          {t("noOrders")}
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-line rounded-card border border-line bg-surface px-5">
          {myOrders.map((o) => (
            <li key={o.id}>
              <Link
                href={`/account/orders/${o.id}`}
                className="flex items-center justify-between gap-3 py-4 transition-opacity hover:opacity-70"
              >
                <div>
                  <p className="text-sm font-semibold">{o.orderNumber}</p>
                  <p className="text-xs text-soft">
                    {o.createdAt.toLocaleDateString(`${locale}-CH`)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusStyle[o.status] ?? "bg-line text-soft"}`}
                  >
                    {t(`status.${o.status}`)}
                  </span>
                  <span className="text-sm font-semibold tabular-nums">
                    {formatChf(o.totalCents, locale)}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
