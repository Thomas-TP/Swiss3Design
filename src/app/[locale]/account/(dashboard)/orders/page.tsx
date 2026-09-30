import { Package } from "lucide-react";
import { desc, eq, or } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getDb } from "@/db";
import { orders } from "@/db/schema";
import { getServerSession } from "@/lib/session";
import { formatChf } from "@/lib/format";
import { AccountTitle } from "../account-title";
import { card, rowLink, rowList, statusBadge } from "../_ui";

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
      <AccountTitle title={t("myOrders")} icon={Package} />

      {myOrders.length === 0 ? (
        <p className={`${card} text-sm text-soft`}>{t("noOrders")}</p>
      ) : (
        <ul className={rowList}>
          {myOrders.map((o) => (
            <li key={o.id}>
              <Link href={`/account/orders/${o.id}`} className={rowLink}>
                <div>
                  <p className="s3d-num text-sm font-semibold">
                    {o.orderNumber}
                  </p>
                  <p className="text-xs text-soft">
                    {o.createdAt.toLocaleDateString(`${locale}-CH`)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={statusBadge(o.status)}>
                    {t(`status.${o.status}`)}
                  </span>
                  <span className="s3d-num text-sm font-semibold">
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
