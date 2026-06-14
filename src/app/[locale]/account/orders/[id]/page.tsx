import { notFound } from "next/navigation";
import { ArrowLeft, Package, Truck, MapPin } from "lucide-react";
import { and, desc, eq, or } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getDb } from "@/db";
import { orders, orderItems } from "@/db/schema";
import { getServerSession } from "@/lib/session";
import { formatChf } from "@/lib/format";

export const dynamic = "force-dynamic";

const statusStyle: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  paid: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  in_production: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  shipped: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  delivered: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  cancelled: "bg-red-500/15 text-red-600 dark:text-red-300",
};

function trackingUrl(n: string): string {
  return `https://service.post.ch/ekp-web/ui/entry/search/${encodeURIComponent(n)}`;
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const { locale, id } = await params;
  const session = await getServerSession();
  if (!session) {
    redirect({ href: "/account/login", locale });
  }
  const { user } = session!;

  const db = await getDb();
  const [order] = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.id, id),
        or(eq(orders.customerId, user.id), eq(orders.email, user.email)),
      ),
    )
    .limit(1);
  if (!order) notFound();

  const [items, t] = await Promise.all([
    db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id))
      .orderBy(desc(orderItems.id)),
    getTranslations("account"),
  ]);

  let address = { name: "", street: "", npa: "", city: "", canton: "" };
  try {
    address = { ...address, ...JSON.parse(order.shippingAddress) };
  } catch {
    // adresse illisible — section masquée
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 md:py-16">
      <Link
        href="/account"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-soft transition-colors hover:text-ink"
      >
        <ArrowLeft size={15} />
        {t("orderDetail.back")}
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t("orderDetail.title", { n: order.orderNumber })}
          </h1>
          <p className="mt-1 text-sm text-soft">
            {t("orderDetail.placedOn", {
              date: order.createdAt.toLocaleDateString(`${locale}-CH`),
            })}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyle[order.status] ?? "bg-line text-soft"}`}
        >
          {t(`status.${order.status}`)}
        </span>
      </div>

      {order.trackingNumber && (
        <a
          href={trackingUrl(order.trackingNumber)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 flex items-center justify-between gap-3 rounded-card border border-line bg-surface px-5 py-4 transition-colors hover:border-ink"
        >
          <span className="flex items-center gap-2.5 text-sm">
            <Truck size={17} className="shrink-0 text-soft" />
            <span>
              <span className="font-semibold">{t("orderDetail.tracking")}</span>{" "}
              <span className="tabular-nums text-soft">
                {order.trackingNumber}
              </span>
            </span>
          </span>
          <span className="shrink-0 text-sm font-semibold text-accent">
            {t("orderDetail.trackOrder")} →
          </span>
        </a>
      )}

      <section className="mt-6">
        <h2 className="flex items-center gap-2 font-semibold">
          <Package size={17} className="text-soft" />
          {t("orderDetail.items")}
        </h2>
        <ul className="mt-3 divide-y divide-line rounded-card border border-line bg-surface px-5">
          {items.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-3 py-4">
              <span className="text-sm">
                <span className="font-medium tabular-nums">{i.quantity}×</span>{" "}
                {i.nameSnapshot}
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums">
                {formatChf(i.priceCentsSnapshot * i.quantity, locale)}
              </span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-2 rounded-card border border-line bg-surface px-5 py-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-soft">{t("orderDetail.subtotal")}</dt>
            <dd className="tabular-nums">
              {formatChf(order.subtotalCents, locale)}
            </dd>
          </div>
          {order.discountCents > 0 && (
            <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
              <dt>
                {t("orderDetail.discount")}
                {order.discountCode ? ` (${order.discountCode})` : ""}
              </dt>
              <dd className="tabular-nums">
                −{formatChf(order.discountCents, locale)}
              </dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-soft">{t("orderDetail.shipping")}</dt>
            <dd className="tabular-nums">
              {order.shippingCents === 0
                ? t("orderDetail.shippingFree")
                : formatChf(order.shippingCents, locale)}
            </dd>
          </div>
          <div className="flex justify-between border-t border-line pt-2 text-base font-bold">
            <dt>{t("orderDetail.total")}</dt>
            <dd className="tabular-nums">{formatChf(order.totalCents, locale)}</dd>
          </div>
        </dl>
      </section>

      {address.name && (
        <section className="mt-6">
          <h2 className="flex items-center gap-2 font-semibold">
            <MapPin size={17} className="text-soft" />
            {t("orderDetail.shippingAddress")}
          </h2>
          <p className="mt-3 rounded-card border border-line bg-surface px-5 py-4 text-sm leading-relaxed text-soft">
            {address.name}
            <br />
            {address.street}
            <br />
            {address.npa} {address.city}
            {address.canton ? `, ${address.canton}` : ""}
            <br />
            CH
          </p>
        </section>
      )}
    </div>
  );
}
