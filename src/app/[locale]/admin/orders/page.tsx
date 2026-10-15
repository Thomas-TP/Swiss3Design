import { count, desc, eq, like, or, and, sql, type SQL } from "drizzle-orm";
import { Search, Truck } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getDb } from "@/db";
import { uncached } from "@/db/fresh";
import { orderItems, orders } from "@/db/schema";
import { formatChf } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import { ORDER_STATUSES, ORDER_STATUS_FR, STATUS_STYLE, FIELD } from "../ui";

export default async function AdminOrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ s?: string; q?: string; r?: string }>;
}) {
  await requireAdmin();
  const { locale } = await params;
  const { s, q, r } = await searchParams;
  // « Studio à relire » : commandes payées dont un texte du Studio attend la relecture.
  const reviewFilter = r === "studio";
  const statusFilter = (ORDER_STATUSES as readonly string[]).includes(s ?? "")
    ? (s as (typeof ORDER_STATUSES)[number])
    : null;
  const query = (q ?? "").trim().slice(0, 100);

  const db = await getDb();
  const all = await db.select({ status: orders.status }).from(orders);
  const countByStatus = new Map<string, number>();
  for (const row of all) {
    countByStatus.set(row.status, (countByStatus.get(row.status) ?? 0) + 1);
  }

  // `uncached` : la liste doit refléter une relecture posée à l'instant (Hyperdrive met
  // les SELECT en cache 60 s).
  const toReview = and(
    sql`${orders.status} in ('paid', 'in_production')`,
    sql`exists (select 1 from ${orderItems} where ${orderItems.orderId} = ${orders.id} and ${orderItems.studio} is not null and ${orderItems.studio}->>'reviewedAt' is null)`,
    uncached,
  )!;
  const [{ value: toReviewCount }] = await db
    .select({ value: count() })
    .from(orders)
    .where(toReview);

  const conditions: SQL[] = [];
  if (reviewFilter) conditions.push(toReview);
  if (statusFilter) conditions.push(eq(orders.status, statusFilter));
  if (query) {
    conditions.push(
      or(
        like(orders.orderNumber, `%${query}%`),
        like(orders.email, `%${query}%`),
      )!,
    );
  }
  const rows = await db
    .select()
    .from(orders)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(orders.createdAt));

  const chips: { value: string | null; label: string; count: number }[] = [
    { value: null, label: "Toutes", count: all.length },
    ...ORDER_STATUSES.map((st) => ({
      value: st as string,
      label: ORDER_STATUS_FR[st],
      count: countByStatus.get(st) ?? 0,
    })).filter((c) => c.count > 0),
  ];

  return (
    <div>
      <h2 className="mb-4 text-xl font-bold tracking-tight">Commandes</h2>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <Link
              key={c.label}
              href={{
                pathname: "/admin/orders",
                query: {
                  ...(c.value ? { s: c.value } : {}),
                  ...(query ? { q: query } : {}),
                },
              }}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                !reviewFilter && statusFilter === c.value
                  ? "bg-ink text-paper"
                  : "border border-line bg-surface text-soft hover:text-ink"
              }`}
            >
              {c.label}
              <span className="ml-1.5 font-normal tabular-nums">{c.count}</span>
            </Link>
          ))}
          {toReviewCount > 0 || reviewFilter ? (
            <Link
              href={{ pathname: "/admin/orders", query: { r: "studio" } }}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                reviewFilter
                  ? "bg-ink text-paper"
                  : "border border-amber-500/50 bg-amber-500/10 text-amber-900 hover:text-ink dark:text-amber-200"
              }`}
            >
              Studio à relire
              <span className="ml-1.5 font-normal tabular-nums">
                {toReviewCount}
              </span>
            </Link>
          ) : null}
        </div>
        <form className="relative" action="">
          {statusFilter && (
            <input type="hidden" name="s" value={statusFilter} />
          )}
          <Search
            size={15}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-soft"
          />
          <input
            name="q"
            defaultValue={query}
            placeholder="N° ou e-mail…"
            className={`${FIELD} w-52 pl-9`}
          />
        </form>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-card border border-line bg-surface p-10 text-center text-soft">
          {query || statusFilter || reviewFilter
            ? "Aucune commande ne correspond à ces critères."
            : "Aucune commande pour l'instant."}
        </p>
      ) : (
        <ul className="divide-y divide-line rounded-card border border-line bg-surface px-4">
          {rows.map((o) => (
            <li key={o.id} className="flex items-center gap-3 py-3.5">
              <Link
                href={`/admin/orders/${o.id}`}
                className="min-w-0 flex-1 hover:underline"
              >
                <p className="flex items-center gap-1.5 text-sm font-semibold">
                  {o.orderNumber}
                  {o.trackingNumber && (
                    <Truck size={13} className="shrink-0 text-soft" />
                  )}
                </p>
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
