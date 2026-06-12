import { desc, eq, and, isNotNull, lte, count } from "drizzle-orm";
import {
  TrendingUp,
  ShoppingCart,
  FileText,
  AlertTriangle,
  Wallet,
  CalendarRange,
  Users,
  PackageCheck,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getDb } from "@/db";
import { orders, quoteRequests, products, productTranslations, user } from "@/db/schema";
import { formatChf } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import { ORDER_STATUS_FR, QUOTE_STATUS_FR, STATUS_STYLE } from "./ui";

export default async function AdminDashboard({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  // Défense en profondeur : le layout vérifie déjà, mais il peut être
  // contourné par une requête RSC ciblant directement la page.
  await requireAdmin();
  const { locale } = await params;
  const db = await getDb();

  const [allOrders, pendingQuotes, lowStock, [customerCount]] =
    await Promise.all([
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
        .select({
          id: quoteRequests.id,
          email: quoteRequests.email,
          description: quoteRequests.description,
          status: quoteRequests.status,
          createdAt: quoteRequests.createdAt,
        })
        .from(quoteRequests)
        .where(eq(quoteRequests.status, "received"))
        .orderBy(desc(quoteRequests.createdAt)),
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
      db.select({ value: count() }).from(user),
    ]);

  const paidStatuses = new Set(["paid", "in_production", "shipped", "delivered"]);
  const paidOrders = allOrders.filter((o) => paidStatuses.has(o.status));
  const revenueCents = paidOrders.reduce((sum, o) => sum + o.totalCents, 0);

  // Server component dynamique : rendu à chaque requête, l'horloge est stable
  // eslint-disable-next-line react-hooks/purity
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const paid30d = paidOrders.filter((o) => o.createdAt >= thirtyDaysAgo);
  const revenue30dCents = paid30d.reduce((sum, o) => sum + o.totalCents, 0);
  const avgBasketCents =
    paidOrders.length > 0 ? Math.round(revenueCents / paidOrders.length) : 0;

  const toProcess = allOrders.filter((o) =>
    ["paid", "in_production"].includes(o.status),
  ).length;
  const toShip = allOrders.filter((o) => o.status === "in_production").length;
  const recent = allOrders.slice(0, 6);

  const cards = [
    {
      Icon: TrendingUp,
      label: "Chiffre d'affaires total",
      value: formatChf(revenueCents, "fr"),
    },
    {
      Icon: CalendarRange,
      label: `30 derniers jours (${paid30d.length} cde${paid30d.length > 1 ? "s" : ""})`,
      value: formatChf(revenue30dCents, "fr"),
    },
    {
      Icon: Wallet,
      label: "Panier moyen",
      value: formatChf(avgBasketCents, "fr"),
    },
    { Icon: Users, label: "Comptes clients", value: String(customerCount.value) },
    { Icon: ShoppingCart, label: "Commandes à traiter", value: String(toProcess) },
    { Icon: PackageCheck, label: "À expédier", value: String(toShip) },
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

      {pendingQuotes.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Devis à chiffrer</h2>
            <Link
              href="/admin/quotes"
              className="text-sm font-medium text-soft hover:text-ink"
            >
              Tout voir →
            </Link>
          </div>
          <ul className="divide-y divide-line rounded-card border border-line bg-surface px-5">
            {pendingQuotes.slice(0, 4).map((q) => (
              <li key={q.id} className="py-3.5">
                <Link
                  href={`/admin/quotes/${q.id}`}
                  className="flex items-center gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm font-medium">
                      {q.description}
                    </p>
                    <p className="text-xs text-soft">
                      {q.createdAt.toLocaleDateString("fr-CH")} · {q.email}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_STYLE[q.status]}`}
                  >
                    {QUOTE_STATUS_FR[q.status]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
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
