"use client";

import { useEffect, useState } from "react";
import { Package, ArrowRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { medusa } from "@/lib/medusa";
import { useAccountUser } from "./account-context";
import { orderStatusStyle } from "./_ui";

interface OrderSummary {
  id: string;
  display_id: number;
  fulfillment_status: string;
  total: number;
  currency_code: string;
  created_at: string;
}

export default function AccountOverview() {
  const t = useTranslations("account");
  const locale = useLocale();
  const user = useAccountUser();
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    medusa.store.order
      .list({ limit: 3, order: "-created_at", fields: "id,display_id,fulfillment_status,total,currency_code,created_at" })
      .then(({ orders: rows }) => {
        if (!cancelled) setOrders(rows as unknown as OrderSummary[]);
      })
      .catch(() => {
        if (!cancelled) setOrders([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const firstName = user.name.split(" ")[0] || user.name;

  return (
    <div>
      <h1 className="text-xl font-bold">{t("greeting", { name: firstName })}</h1>
      <p className="mt-1 mb-6 text-sm text-soft">{t("overview.subtitle")}</p>

      {orders === null ? null : orders.length === 0 ? (
        <div className="rounded-card border border-line bg-surface p-8 text-center">
          <p className="text-sm font-semibold">{t("overview.emptyTitle")}</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-soft">{t("overview.emptyDesc")}</p>
          <Link
            href="/shop"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 text-sm font-semibold text-paper transition-opacity hover:opacity-90"
          >
            {t("overview.emptyCta")}
            <ArrowRight size={16} />
          </Link>
        </div>
      ) : (
        <div className="rounded-card border border-line bg-surface p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Package size={16} className="text-soft" />
              {t("myOrders")}
            </p>
            <Link href="/account/orders" className="text-xs font-semibold text-soft hover:text-ink">
              {t("overview.seeAll")}
            </Link>
          </div>
          <ul className="mt-4 divide-y divide-line">
            {orders.map((o) => (
              <li key={o.id}>
                <Link href={`/account/orders/${o.id}`} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">S3D-{o.display_id}</p>
                    <p className="mt-0.5 text-xs text-soft">
                      {new Date(o.created_at).toLocaleDateString(`${locale}-CH`)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${orderStatusStyle[o.fulfillment_status] ?? "bg-line text-soft"}`}
                  >
                    {t(`orderStatus.${o.fulfillment_status}`)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
