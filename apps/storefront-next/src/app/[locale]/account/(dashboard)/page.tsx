"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Package, FileText, Sparkles } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { medusa } from "@/lib/medusa";
import { useAccountUser } from "./account-context";
import { card, orderStatusStyle, quoteStatusStyle } from "./_ui";

interface OrderSummary {
  id: string;
  display_id: number;
  fulfillment_status: string;
  created_at: string;
}

// Le compteur "commandes en cours" doit porter sur toutes les commandes, pas
// seulement les 3 affichées — on récupère un lot plus large pour le compte,
// mais n'affiche que les 3 premières (déjà triées -created_at).
const COUNT_SAMPLE_LIMIT = 50;

interface QuoteSummary {
  id: string;
  description: string;
  status: string;
}

// Statuts « actifs » d'une commande (ni livrée ni annulée) → compteur « en cours ».
const OPEN_ORDER_STATUSES = new Set(["not_fulfilled", "partially_fulfilled", "fulfilled", "partially_shipped", "shipped", "partially_delivered"]);

export default function AccountOverview() {
  const t = useTranslations("account");
  const locale = useLocale();
  const user = useAccountUser();
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const [quotes, setQuotes] = useState<QuoteSummary[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    medusa.store.order
      .list({ limit: COUNT_SAMPLE_LIMIT, order: "-created_at", fields: "id,display_id,fulfillment_status,created_at" })
      .then(({ orders: rows }) => {
        if (!cancelled) setOrders(rows as unknown as OrderSummary[]);
      })
      .catch(() => {
        if (!cancelled) setOrders([]);
      });
    medusa.client
      .fetch<{ quotes: QuoteSummary[] }>("/store/quotes")
      .then(({ quotes: rows }) => {
        if (!cancelled) setQuotes(rows);
      })
      .catch(() => {
        if (!cancelled) setQuotes([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const firstName = user.name.split(" ")[0] || user.name;

  if (orders === null || quotes === null) {
    return (
      <div>
        <h1 className="text-xl font-bold">{t("greeting", { name: firstName })}</h1>
        <p className="mt-1 mb-6 text-sm text-soft">{t("overview.subtitle")}</p>
      </div>
    );
  }

  const openOrderCount = orders.filter((o) => OPEN_ORDER_STATUSES.has(o.fulfillment_status)).length;
  const actionQuoteCount = quotes.filter((q) => q.status === "quoted").length;
  const isEmpty = orders.length === 0 && quotes.length === 0;
  const recentOrders = orders.slice(0, 3);
  const recentQuotes = quotes.slice(0, 3);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold">{t("greeting", { name: firstName })}</h1>
        <p className="mt-1 text-sm text-soft">{t("overview.subtitle")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/account/orders" className={`${card} group flex items-center justify-between`}>
          <div>
            <p className="text-3xl font-bold tabular-nums">{openOrderCount}</p>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-soft">
              <Package size={15} />
              {t("overview.openOrders")}
            </p>
          </div>
          <ArrowRight size={18} className="text-soft transition-transform group-hover:translate-x-0.5" />
        </Link>
        <Link href="/account/quotes" className={`${card} group flex items-center justify-between`}>
          <div>
            <p className="text-3xl font-bold tabular-nums">{actionQuoteCount}</p>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-soft">
              <FileText size={15} />
              {t("overview.actionQuotes")}
            </p>
          </div>
          <ArrowRight size={18} className="text-soft transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      {isEmpty ? (
        <div className={`${card} text-center`}>
          <Sparkles size={22} className="mx-auto text-accent" />
          <p className="mt-3 text-sm font-semibold">{t("overview.emptyTitle")}</p>
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
                <Link href="/account/orders" className="text-xs font-semibold text-soft transition-colors hover:text-ink">
                  {t("overview.seeAll")}
                </Link>
              </div>
              <ul className="divide-y divide-line rounded-card border border-line bg-surface px-5">
                {recentOrders.map((o) => (
                  <li key={o.id}>
                    <Link href={`/account/orders/${o.id}`} className="flex items-center justify-between gap-3 py-4 transition-opacity hover:opacity-70">
                      <div>
                        <p className="text-sm font-semibold">S3D-{o.display_id}</p>
                        <p className="text-xs text-soft">{new Date(o.created_at).toLocaleDateString(`${locale}-CH`)}</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${orderStatusStyle[o.fulfillment_status] ?? "bg-line text-soft"}`}>
                        {t(`orderStatus.${o.fulfillment_status}`)}
                      </span>
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
                <Link href="/account/quotes" className="text-xs font-semibold text-soft transition-colors hover:text-ink">
                  {t("overview.seeAll")}
                </Link>
              </div>
              <ul className="divide-y divide-line rounded-card border border-line bg-surface px-5">
                {recentQuotes.map((q) => (
                  <li key={q.id}>
                    <Link href={`/account/quotes/${q.id}`} className="block py-4 transition-opacity hover:opacity-70">
                      <div className="flex items-center justify-between gap-3">
                        <p className="line-clamp-1 text-sm font-medium">{q.description}</p>
                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${quoteStatusStyle[q.status] ?? "bg-line text-soft"}`}>
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
