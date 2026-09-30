import { ArrowRight, Package, FileText, Sparkles } from "lucide-react";
import { and, count, desc, eq, inArray, or } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getDb } from "@/db";
import { orders, quoteRequests } from "@/db/schema";
import { getServerSession } from "@/lib/session";
import { formatChf } from "@/lib/format";
import { AccountTitle } from "./account-title";
import {
  btnAccent,
  card,
  linkSoft,
  rowLink,
  rowLinkBlock,
  rowList,
  statusBadge,
} from "./_ui";

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
      <AccountTitle
        title={t("greeting", { name: user.name })}
        subtitle={t("overview.subtitle")}
        className=""
      />

      {/* Cartes de synthèse : le chiffre d'abord (grand chiffre en Archivo),
          son libellé dessous. Aucun mouvement au survol. */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/account/orders"
          className={`${card} group flex items-center justify-between transition-colors duration-150 hover:border-ink`}
        >
          <div>
            <p className="s3d-num font-display text-title text-ink">
              {openOrderCount}
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-soft">
              <Package size={15} strokeWidth={1.5} />
              {t("overview.openOrders")}
            </p>
          </div>
          <ArrowRight
            size={18}
            strokeWidth={1.5}
            className="text-soft transition-colors duration-150 group-hover:text-ink"
          />
        </Link>
        <Link
          href="/account/quotes"
          className={`${card} group flex items-center justify-between transition-colors duration-150 hover:border-ink`}
        >
          <div>
            <p className="s3d-num font-display text-title text-ink">
              {actionQuoteCount}
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-soft">
              <FileText size={15} strokeWidth={1.5} />
              {t("overview.actionQuotes")}
            </p>
          </div>
          <ArrowRight
            size={18}
            strokeWidth={1.5}
            className="text-soft transition-colors duration-150 group-hover:text-ink"
          />
        </Link>
      </div>

      {isEmpty ? (
        <div className={`${card} text-center`}>
          <Sparkles size={22} strokeWidth={1.5} className="mx-auto text-soft" />
          <p className="mt-3 text-sm font-semibold">
            {t("overview.emptyTitle")}
          </p>
          <p className="mt-1 text-sm text-soft">{t("overview.emptyDesc")}</p>
          {/* Seul bouton rouge de l'écran : l'action principale. */}
          <Link href="/shop" className={`${btnAccent} mt-5`}>
            {t("overview.emptyCta")}
            <ArrowRight size={16} strokeWidth={1.5} />
          </Link>
        </div>
      ) : (
        <>
          {recentOrders.length > 0 && (
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-semibold">
                  <Package size={17} strokeWidth={1.5} className="text-soft" />
                  {t("myOrders")}
                </h2>
                <Link href="/account/orders" className={linkSoft}>
                  {t("overview.seeAll")}
                </Link>
              </div>
              <ul className={rowList}>
                {recentOrders.map((o) => (
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
            </section>
          )}

          {recentQuotes.length > 0 && (
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-semibold">
                  <FileText size={17} strokeWidth={1.5} className="text-soft" />
                  {t("myQuotes")}
                </h2>
                <Link href="/account/quotes" className={linkSoft}>
                  {t("overview.seeAll")}
                </Link>
              </div>
              <ul className={rowList}>
                {recentQuotes.map((q) => (
                  <li key={q.id}>
                    <Link
                      href={`/account/quotes/${q.id}`}
                      className={rowLinkBlock}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="line-clamp-1 text-sm font-medium">
                          {q.description}
                        </p>
                        <span className={statusBadge(q.status)}>
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
