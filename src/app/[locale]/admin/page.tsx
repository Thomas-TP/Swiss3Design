import { desc, eq, and, isNotNull, lte } from "drizzle-orm";
import { TrendingUp, ShoppingCart, FileText, AlertTriangle } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getDb } from "@/db";
import { orders, quoteRequests, products, productTranslations } from "@/db/schema";
import { formatChf } from "@/lib/format";
import { ORDER_STATUS_FR, STATUS_STYLE } from "./ui";

export default async function AdminDashboard({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const db = await getDb();

  const [allOrders, pendingQuotes, lowStock] = await Promise.all([
    db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        email: orders.email,
        status: orders.status,
        totalCents: orders.totalCents,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .orderBy(desc(orders.createdAt)),
    db
      .select({ id: quoteRequests.id })
      .from(quoteRequests)
      .where(eq(quoteRequests.status, "received")),
    db
      .select({
        id: products.id,
        stock: products.stock,
        name: productTranslations.name,
      })
      .from(products)
      .innerJoin(
        productTranslations,
        and(
          eq(productTranslations.productId, products.id),
          eq(productTranslations.locale, "fr"),
        ),
      )
      .where(and(isNotNull(products.stock), lte(products.stock, 2))),
  ]);

  const paidStatuses = new Set(["paid", "in_production", "shipped", "delivered"]);
  const revenueCents = allOrders
    .filter((o) => paidStatuses.has(o.status))
    .reduce((sum, o) => sum + o.totalCents, 0);
  const openOrders = allOrders.filter((o) =>
    ["paid", "in_production"].includes(o.status),
  ).length;
  const recent = allOrders.slice(0, 6);

  const cards = [
    {
      Icon: TrendingUp,
      label: "Chiffre d'affaires",
      value: formatChf(revenueCents, "fr"),
    },
    { Icon: ShoppingCart, label: "Commandes à traiter", value: String(openOrders) },
    { Icon: FileText, label: "Devis en attente", value: String(pendingQuotes.length) },
    { Icon: AlertTriangle, label: "Stock bas", value: String(lowStock.length) },
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map(({ Icon, label, value }) => (
          <div
            key={label}
            className="rounded-card border border-line bg-surface p-4"
          >
            <Icon size={18} className="text-soft" />
            <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
            <p className="text-xs text-soft">{label}</p>
          </div>
        ))}
      </div>

      {lowStock.length > 0 && (
        <div className="rounded-card border border-amber-200 bg-amber-50 p-4 text-sm">
          <p className="font-semibold text-amber-800">⚠ Stock bas</p>
          <ul className="mt-1 text-amber-700">
            {lowStock.map((p) => (
              <li key={p.id}>
                <Link href={`/admin/products/${p.id}`} className="underline">
                  {p.name}
                </Link>{" "}
                — {p.stock} restant(s)
              </li>
            ))}
          </ul>
        </div>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Dernières commandes</h2>
          <Link
            href="/admin/orders"
            className="text-sm font-medium text-soft hover:text-ink"
          >
            Tout voir →
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="rounded-card border border-line bg-surface p-6 text-sm text-soft">
            Aucune commande pour l&apos;instant.
          </p>
        ) : (
          <ul className="divide-y divide-line rounded-card border border-line bg-surface px-5">
            {recent.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 py-3.5">
                <Link
                  href={`/admin/orders/${o.id}`}
                  className="min-w-0 flex-1 hover:underline"
                >
                  <span className="text-sm font-semibold">{o.orderNumber}</span>
                  <span className="ml-2 truncate text-xs text-soft">{o.email}</span>
                </Link>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_STYLE[o.status]}`}
                >
                  {ORDER_STATUS_FR[o.status]}
                </span>
                <span className="text-sm font-semibold tabular-nums">
                  {formatChf(o.totalCents, locale)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
