"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Package, Truck, MapPin } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { medusa } from "@/lib/medusa";
import { formatChfAmount } from "@/lib/format";
import { orderStatusStyle } from "../../_ui";
import { ReorderButton } from "./reorder-button";

interface OrderItem {
  id: string;
  title: string;
  quantity: number;
  unit_price: number;
  variant_id: string | null;
  product_id: string | null;
  metadata: Record<string, unknown> | null;
}

interface OrderDetail {
  id: string;
  display_id: number;
  fulfillment_status: string;
  created_at: string;
  currency_code: string;
  subtotal: number;
  discount_total: number;
  shipping_total: number;
  total: number;
  items: OrderItem[];
  shipping_address: {
    first_name: string | null;
    last_name: string | null;
    address_1: string | null;
    postal_code: string | null;
    city: string | null;
    province: string | null;
  } | null;
  promotions?: { code: string }[];
  fulfillments?: { labels?: { tracking_number: string }[] }[] | null;
}

function trackingUrl(n: string): string {
  return `https://service.post.ch/ekp-web/ui/entry/search/${encodeURIComponent(n)}`;
}

export default function OrderDetailPage() {
  const t = useTranslations("account");
  const locale = useLocale();
  const params = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderDetail | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    medusa.store.order
      .retrieve(params.id, {
        fields:
          "id,display_id,fulfillment_status,created_at,currency_code,subtotal,discount_total,shipping_total,total,*items,*shipping_address,*promotions,*fulfillments.labels",
      })
      .then(({ order: o }) => {
        if (!cancelled) setOrder(o as unknown as OrderDetail);
      })
      .catch(() => {
        if (!cancelled) setOrder(null);
      });
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  if (order === undefined) return null;
  if (order === null) {
    return (
      <div className="max-w-2xl">
        <Link href="/account" className="inline-flex items-center gap-1.5 text-sm font-medium text-soft hover:text-ink">
          <ArrowLeft size={15} />
          {t("orderDetail.back")}
        </Link>
      </div>
    );
  }

  const trackingNumber = order.fulfillments?.[0]?.labels?.[0]?.tracking_number;
  const addr = order.shipping_address;
  const promoCode = order.promotions?.[0]?.code;

  return (
    <div className="max-w-2xl">
      <Link
        href="/account"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-soft transition-colors hover:text-ink"
      >
        <ArrowLeft size={15} />
        {t("orderDetail.back")}
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("orderDetail.title", { n: `S3D-${order.display_id}` })}</h1>
          <p className="mt-1 text-sm text-soft">
            {t("orderDetail.placedOn", { date: new Date(order.created_at).toLocaleDateString(`${locale}-CH`) })}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${orderStatusStyle[order.fulfillment_status] ?? "bg-line text-soft"}`}
        >
          {t(`orderStatus.${order.fulfillment_status}`)}
        </span>
      </div>

      <div className="mt-4">
        <ReorderButton
          items={order.items.map((i) => ({ variant_id: i.variant_id, quantity: i.quantity, metadata: i.metadata }))}
        />
      </div>

      {trackingNumber && (
        <a
          href={trackingUrl(trackingNumber)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 flex items-center justify-between gap-3 rounded-card border border-line bg-surface px-5 py-4 transition-colors hover:border-ink"
        >
          <span className="flex items-center gap-2.5 text-sm">
            <Truck size={17} className="shrink-0 text-soft" />
            <span>
              <span className="font-semibold">{t("orderDetail.tracking")}</span>{" "}
              <span className="tabular-nums text-soft">{trackingNumber}</span>
            </span>
          </span>
          <span className="shrink-0 text-sm font-semibold text-accent">{t("orderDetail.trackOrder")} →</span>
        </a>
      )}

      <section className="mt-6">
        <h2 className="flex items-center gap-2 font-semibold">
          <Package size={17} className="text-soft" />
          {t("orderDetail.items")}
        </h2>
        <ul className="mt-3 divide-y divide-line rounded-card border border-line bg-surface px-5">
          {order.items.map((i) => {
            const colorName = i.metadata?.color_name as string | undefined;
            const colorHex = i.metadata?.color_hex as string | undefined;
            return (
              <li key={i.id} className="py-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm">
                    <span className="font-medium tabular-nums">{i.quantity}×</span> {i.title}
                    {colorName && (
                      <span className="inline-flex items-center gap-1.5 text-xs text-soft">
                        <span className="h-3 w-3 shrink-0 rounded-full border border-swatch-ring" style={{ backgroundColor: colorHex }} />
                        {colorName}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">
                    {formatChfAmount(i.unit_price * i.quantity, locale)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
        <dl className="mt-4 space-y-2 rounded-card border border-line bg-surface px-5 py-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-soft">{t("orderDetail.subtotal")}</dt>
            <dd className="tabular-nums">{formatChfAmount(order.subtotal, locale)}</dd>
          </div>
          {order.discount_total > 0 && (
            <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
              <dt>
                {t("orderDetail.discount")}
                {promoCode ? ` (${promoCode})` : ""}
              </dt>
              <dd className="tabular-nums">−{formatChfAmount(order.discount_total, locale)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-soft">{t("orderDetail.shipping")}</dt>
            <dd className="tabular-nums">
              {order.shipping_total === 0 ? t("orderDetail.shippingFree") : formatChfAmount(order.shipping_total, locale)}
            </dd>
          </div>
          <div className="flex justify-between border-t border-line pt-2 text-base font-bold">
            <dt>{t("orderDetail.total")}</dt>
            <dd className="tabular-nums">{formatChfAmount(order.total, locale)}</dd>
          </div>
        </dl>
      </section>

      {addr?.first_name && (
        <section className="mt-6">
          <h2 className="flex items-center gap-2 font-semibold">
            <MapPin size={17} className="text-soft" />
            {t("orderDetail.shippingAddress")}
          </h2>
          <p className="mt-3 rounded-card border border-line bg-surface px-5 py-4 text-sm leading-relaxed text-soft">
            {addr.first_name} {addr.last_name}
            <br />
            {addr.address_1}
            <br />
            {addr.postal_code} {addr.city}
            {addr.province ? `, ${addr.province}` : ""}
            <br />
            CH
          </p>
        </section>
      )}
    </div>
  );
}
