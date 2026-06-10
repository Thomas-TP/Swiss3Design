import { desc } from "drizzle-orm";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getDb } from "@/db";
import { orders } from "@/db/schema";
import { formatChf } from "@/lib/format";
import { ORDER_STATUS_FR, STATUS_STYLE } from "../ui";

export default async function AdminOrdersPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const db = await getDb();
  const rows = await db.select().from(orders).orderBy(desc(orders.createdAt));

  return (
    <div>
      <p className="mb-5 text-sm text-soft">
        {rows.length} commande{rows.length > 1 ? "s" : ""}
      </p>
      {rows.length === 0 ? (
        <p className="rounded-card border border-line bg-surface p-10 text-center text-soft">
          Aucune commande pour l&apos;instant.
        </p>
      ) : (
        <ul className="divide-y divide-line rounded-card border border-line bg-surface px-4">
          {rows.map((o) => (
            <li key={o.id} className="flex items-center gap-3 py-3.5">
              <Link
                href={`/admin/orders/${o.id}`}
                className="min-w-0 flex-1 hover:underline"
              >
                <p className="text-sm font-semibold">{o.orderNumber}</p>
                <p className="truncate text-xs text-soft">
                  {o.createdAt.toLocaleDateString("fr-CH")} · {o.email}
                </p>
              </Link>
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_STYLE[o.status]}`}
              >
                {ORDER_STATUS_FR[o.status]}
              </span>
              <span className="w-24 text-right text-sm font-semibold tabular-nums">
                {formatChf(o.totalCents, locale)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
