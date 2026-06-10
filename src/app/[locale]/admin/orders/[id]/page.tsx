import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getDb } from "@/db";
import { orders, orderItems } from "@/db/schema";
import { formatChf } from "@/lib/format";
import { updateOrderStatus } from "../actions";
import { ORDER_STATUSES, ORDER_STATUS_FR, FIELD, BTN_PRIMARY } from "../../ui";

interface Address {
  name?: string;
  street?: string;
  npa?: string;
  city?: string;
}

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const { locale, id } = await params;
  const db = await getDb();

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, id))
    .limit(1);
  if (!order) notFound();

  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, id));

  let address: Address = {};
  try {
    address = JSON.parse(order.shippingAddress);
  } catch {
    // adresse illisible — on affiche le brut
  }

  return (
    <div className="max-w-2xl">
      <Link
        href="/admin/orders"
        className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-soft hover:text-ink"
      >
        <ArrowLeft size={15} />
        Toutes les commandes
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">{order.orderNumber}</h2>
          <p className="text-sm text-soft">
            {order.createdAt.toLocaleString("fr-CH")} · {order.email} · langue
            client : {order.locale.toUpperCase()}
          </p>
        </div>
        <form action={updateOrderStatus} className="flex items-center gap-2">
          <input type="hidden" name="id" value={order.id} />
          <select
            name="status"
            defaultValue={order.status}
            className={`${FIELD} w-auto`}
          >
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {ORDER_STATUS_FR[s]}
              </option>
            ))}
          </select>
          <button className={BTN_PRIMARY}>OK</button>
        </form>
      </div>

      <section className="mt-6 rounded-card border border-line bg-surface p-5">
        <h3 className="mb-3 font-semibold">Articles</h3>
        <ul className="divide-y divide-line text-sm">
          {items.map((it) => (
            <li key={it.id} className="flex justify-between gap-3 py-2.5">
              <span>
                {it.quantity} × {it.nameSnapshot}
              </span>
              <span className="font-medium tabular-nums">
                {formatChf(it.priceCentsSnapshot * it.quantity, locale)}
              </span>
            </li>
          ))}
          <li className="flex justify-between gap-3 py-2.5 text-soft">
            <span>Livraison</span>
            <span className="tabular-nums">
              {order.shippingCents === 0
                ? "Offerte"
                : formatChf(order.shippingCents, locale)}
            </span>
          </li>
          <li className="flex justify-between gap-3 py-2.5 font-bold">
            <span>Total</span>
            <span className="tabular-nums">
              {formatChf(order.totalCents, locale)}
            </span>
          </li>
        </ul>
      </section>

      <section className="mt-4 rounded-card border border-line bg-surface p-5 text-sm">
        <h3 className="mb-2 font-semibold">Adresse de livraison</h3>
        <p>
          {address.name}
          <br />
          {address.street}
          <br />
          {address.npa} {address.city}, Suisse
        </p>
      </section>

      {order.stripePaymentIntentId && (
        <p className="mt-4 text-xs text-soft">
          Stripe :{" "}
          <a
            href={`https://dashboard.stripe.com/payments/${order.stripePaymentIntentId}`}
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-ink"
          >
            {order.stripePaymentIntentId}
          </a>
        </p>
      )}
    </div>
  );
}
