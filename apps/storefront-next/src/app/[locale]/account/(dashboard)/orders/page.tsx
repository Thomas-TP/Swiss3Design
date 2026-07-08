"use client";

import { useEffect, useState } from "react";
import { Package } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { medusa } from "@/lib/medusa";
import { formatChfAmount } from "@/lib/format";
import { orderStatusStyle } from "../_ui";

interface OrderRow {
  id: string;
  display_id: number;
  fulfillment_status: string;
  total: number;
  currency_code: string;
  created_at: string;
}

export default function OrdersTab() {
  const t = useTranslations("account");
  const locale = useLocale();
  const [orders, setOrders] = useState<OrderRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    medusa.store.order
      .list({ limit: 100, order: "-created_at", fields: "id,display_id,fulfillment_status,total,currency_code,created_at" })
      .then(({ orders: rows }) => {
        if (!cancelled) setOrders(rows as unknown as OrderRow[]);
      })
      .catch(() => {
        if (!cancelled) setOrders([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <h1 className="flex items-center gap-2 text-xl font-bold">
        <Package size={19} className="text-soft" />
        {t("myOrders")}
      </h1>

      {orders === null ? null : orders.length === 0 ? (
        <p className="mt-6 rounded-card border border-line bg-surface p-6 text-sm text-soft">{t("noOrders")}</p>
      ) : (
        <ul className="mt-6 divide-y divide-line rounded-card border border-line bg-surface px-5">
          {orders.map((o) => (
            <li key={o.id}>
              <Link
                href={`/account/orders/${o.id}`}
                className="flex items-center justify-between gap-3 py-4 transition-opacity hover:opacity-70"
              >
                <div>
                  <p className="text-sm font-semibold">S3D-{o.display_id}</p>
                  <p className="text-xs text-soft">{new Date(o.created_at).toLocaleDateString(`${locale}-CH`)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${orderStatusStyle[o.fulfillment_status] ?? "bg-line text-soft"}`}
                  >
                    {t(`orderStatus.${o.fulfillment_status}`)}
                  </span>
                  <span className="text-sm font-semibold tabular-nums">{formatChfAmount(o.total, locale)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
