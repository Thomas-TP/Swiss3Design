import { ArrowRight, Package, FileText, Sparkles } from "lucide-react";
import { and, count, desc, eq, inArray, or } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getDb } from "@/db";
import { orders, quoteRequests } from "@/db/schema";
import { getServerSession } from "@/lib/session";
import { formatChf } from "@/lib/format";
import { card, statusStyle } from "./_ui";

export const dynamic = "force-dynamic";

// Statuts « actifs » d'une commande (ni livrée ni annulée) → compteur « en cours ».
const OPEN_ORDER_STATUS: (typeof orders.$inferSelect)["status"][] = [
  "pending",
  "paid",
  "in_production",
  "shipped",
];

export default async function AccountOverview({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  // La garde de session est dans le layout ; on relit la session pour l'identité.
  const session = await getServerSession();
  const { user } = session!;

  const db = await getDb();
  const ordersWhere = or(
    eq(orders.customerId, user.id),
    eq(orders.email, user.email),
  );
  const quotesWhere = or(
    eq(quoteRequests.customerId, user.id),
    eq(quoteRequests.email, user.email),
  );

  const [recentOrders, recentQuotes, openOrders, openQuotes, t] =
    await Promise.all([
      db
        .select()
        .from(orders)
        .where(ordersWhere)
        .orderBy(desc(orders.createdAt))
        .limit(3),
      db
        .select()
        .from(quoteRequests)
        .where(quotesWhere)
        .orderBy(desc(quoteRequests.createdAt))
        .limit(3),
      db
        .select({ c: count() })
        .from(orders)
        .where(and(ordersWhere, inArray(orders.status, OPEN_ORDER_STATUS))),
      db
        .select({ c: count() })
        .from(quoteRequests)
        .where(and(quotesWhere, eq(quoteRequests.status, "quoted"))),
      getTranslations("account"),
    ]);

  const openOrderCount = openOrders[0]?.c ?? 0;
  const actionQuoteCount = openQuotes[0]?.c ?? 0;
  const isEmpty = recentOrders.length === 0 && recentQuotes.length === 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold">
          {t("greeting", { name: user.name })}
        </h1>
        <p className="mt-1 text-sm text-soft">{t("overview.subtitle")}</p>
      </div>

      {/* Cartes de synthèse */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/account/orders"
          className={`${card} group flex items-center justify-between`}
        >
          <div>
            <p className="text-3xl font-bold tabular-nums">{openOrderCount}</p>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-soft">
              <Package size={15} />
              {t("overview.openOrders")}
            </p>
          </div>
          <ArrowRight
            size={18}
            className="text-soft transition-transform group-hover:translate-x-0.5"
          />
        </Link>
        <Link
          href="/account/quotes"
          className={`${card} group flex items-center justify-between`}
        >
          <div>
            <p className="text-3xl font-bold tabular-nums">
              {actionQuoteCount}
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-soft">
              <FileText size={15} />
              {t("overview.actionQuotes")}
            </p>
          </div>
          <ArrowRight
            size={18}
            className="text-soft transition-transform group-hover:translate-x-0.5"
          />
        </Link>
      </div>

      {isEmpty ? (
        <div className={`${card} text-center`}>
          <Sparkles size={22} className="mx-auto text-accent" />
          <p className="mt-3 text-sm font-semibold">
            {t("overview.emptyTitle")}
          </p>
          <p className="mt-1 text-sm text-soft">{t("overview.emptyDesc")}</p>
          <Link
            href="/shop"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-dark"
          >
            {t("overview.emptyCta")}
            <ArrowRight size={16} />
          </Link>
        </div>
      ) : (
        <>
          {recentOrders.length > 0 && (
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-semibold">
                  <Package size={17} className="text-soft" />
                  {t("myOrders")}
                </h2>
                <Link
                  href="/account/orders"
                  className="text-xs font-semibold text-soft transition-colors hover:text-ink"
                >
                  {t("overview.seeAll")}
                </Link>
              </div>
              <ul className="divide-y divide-line rounded-card border border-line bg-surface px-5">
                {recentOrders.map((o) => (
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
            </section>
          )}

          {recentQuotes.length > 0 && (
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-semibold">
                  <FileText size={17} className="text-soft" />
                  {t("myQuotes")}
                </h2>
                <Link
                  href="/account/quotes"
                  className="text-xs font-semibold text-soft transition-colors hover:text-ink"
                >
                  {t("overview.seeAll")}
                </Link>
              </div>
              <ul className="divide-y divide-line rounded-card border border-line bg-surface px-5">
                {recentQuotes.map((q) => (
                  <li key={q.id}>
                    <Link
                      href={`/account/quotes/${q.id}`}
                      className="block py-4 transition-opacity hover:opacity-70"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="line-clamp-1 text-sm font-medium">
                          {q.description}
                        </p>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusStyle[q.status] ?? "bg-line text-soft"}`}
                        >
                          {t(`quoteStatus.${q.status}`)}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
