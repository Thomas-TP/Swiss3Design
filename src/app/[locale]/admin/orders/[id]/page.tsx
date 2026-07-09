import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ArrowLeft, UserCircle, StickyNote, Truck } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getDb } from "@/db";
import { orders, orderItems, user } from "@/db/schema";
import { formatChf } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import { updateOrderStatus, updateOrderNote } from "../actions";
import {
  ORDER_STATUSES,
  ORDER_STATUS_FR,
  STATUS_STYLE,
  FIELD,
  BTN_PRIMARY,
  BTN_GHOST,
} from "../../ui";

interface Address {
  name?: string;
  street?: string;
  npa?: string;
  city?: string;
  canton?: string;
}

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  await requireAdmin();
  const { locale, id } = await params;
  const db = await getDb();

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, id))
    .limit(1);
  if (!order) notFound();

  const [items, [customer]] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, id)),
    db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
      })
      .from(user)
      .where(
        order.customerId
          ? eq(user.id, order.customerId)
          : eq(user.email, order.email),
      )
      .limit(1),
  ]);

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
          <h2 className="flex items-center gap-2.5 text-xl font-bold">
            {order.orderNumber}
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_STYLE[order.status]}`}
            >
              {ORDER_STATUS_FR[order.status]}
            </span>
          </h2>
          <p className="text-sm text-soft">
            {order.createdAt.toLocaleString("fr-CH")} ·{" "}
            <a href={`mailto:${order.email}`} className="underline">
              {order.email}
            </a>{" "}
            · langue client : {order.locale.toUpperCase()}
          </p>
        </div>
      </div>

      <section className="mt-6 rounded-card border border-line bg-surface p-5">
        <h3 className="mb-3 flex items-center gap-2 font-semibold">
          <Truck size={16} className="text-soft" />
          Statut & expédition
        </h3>
        <form
          action={updateOrderStatus}
          className="flex flex-wrap items-center gap-2"
        >
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
          <input
            name="tracking"
            defaultValue={order.trackingNumber ?? ""}
            placeholder="N° de suivi Poste (optionnel)"
            className={`${FIELD} w-56`}
          />
          <button type="submit" className={BTN_PRIMARY}>Mettre à jour</button>
        </form>
        {order.trackingNumber && (
          <p className="mt-2.5 text-xs text-soft">
            Suivi actuel :{" "}
            <a
              href={`https://service.post.ch/ekp-web/ui/entry/search/${encodeURIComponent(order.trackingNumber)}`}
              target="_blank"
              rel="noreferrer"
              className="font-medium underline hover:text-ink"
            >
              {order.trackingNumber} ↗
            </a>
          </p>
        )}
        <p className="mt-2.5 text-xs leading-relaxed text-soft">
          E-mails automatiques au client : <strong>Expédiée</strong> → e-mail
          avec n° de suivi · <strong>Livrée</strong> → confirmation de livraison
          · <strong>Annulée</strong> (si payée) → annulation. Le remboursement
          éventuel se fait dans Stripe.
        </p>
      </section>

      <section className="mt-4 rounded-card border border-line bg-surface p-5">
        <h3 className="mb-3 font-semibold">Articles</h3>
        <ul className="divide-y divide-line text-sm">
          {items.map((it) => (
            <li key={it.id} className="flex justify-between gap-3 py-2.5">
              <span className="flex items-center gap-2">
                {it.quantity} × {it.nameSnapshot}
                {it.colorName && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-soft">
                    <span
                      className="h-3 w-3 shrink-0 rounded-full border border-swatch-ring"
                      style={{ backgroundColor: it.colorHex ?? undefined }}
                    />
                    {it.colorName}
                  </span>
                )}
              </span>
              <span className="font-medium tabular-nums">
                {formatChf(it.priceCentsSnapshot * it.quantity, locale)}
              </span>
            </li>
          ))}
          {order.discountCents > 0 && (
            <li className="flex justify-between gap-3 py-2.5 text-emerald-600 dark:text-emerald-400">
              <span>
                Remise{order.discountCode ? ` (${order.discountCode})` : ""}
              </span>
              <span className="tabular-nums">
                −{formatChf(order.discountCents, locale)}
              </span>
            </li>
          )}
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

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <section className="rounded-card border border-line bg-surface p-5 text-sm">
          <h3 className="mb-2 font-semibold">Adresse de livraison</h3>
          <p className="select-all leading-relaxed">
            {address.name}
            <br />
            {address.street}
            <br />
            {address.npa} {address.city}
            {address.canton ? ` (${address.canton})` : ""}, Suisse
          </p>
          <p className="mt-2 text-xs text-soft">
            Un clic sélectionne toute l&apos;adresse (copier-coller étiquette).
          </p>
        </section>

        <section className="rounded-card border border-line bg-surface p-5 text-sm">
          <h3 className="mb-2 flex items-center gap-2 font-semibold">
            <UserCircle size={16} className="text-soft" />
            Client
          </h3>
          {customer ? (
            <>
              <p className="font-medium">{customer.name}</p>
              <p className="text-xs text-soft">
                Compte créé le {customer.createdAt.toLocaleDateString("fr-CH")}
                {customer.emailVerified
                  ? " · e-mail vérifié ✓"
                  : " · e-mail non vérifié"}
              </p>
              <Link
                href={{
                  pathname: "/admin/orders",
                  query: { q: customer.email },
                }}
                className="mt-2.5 inline-block text-xs font-medium underline hover:text-ink"
              >
                Voir toutes ses commandes
              </Link>
            </>
          ) : (
            <p className="text-soft">
              Commande passée en invité (sans compte client).
            </p>
          )}
        </section>
      </div>

      <section className="mt-4 rounded-card border border-line bg-surface p-5">
        <h3 className="mb-2 flex items-center gap-2 font-semibold">
          <StickyNote size={16} className="text-soft" />
          Note interne
          <span className="text-xs font-normal text-soft">
            (jamais visible par le client)
          </span>
        </h3>
        <form action={updateOrderNote} className="space-y-3">
          <input type="hidden" name="id" value={order.id} />
          <textarea
            name="adminNote"
            rows={3}
            defaultValue={order.adminNote ?? ""}
            placeholder="Ex. : réimprimer le couvercle en 0.2 mm, client appelé le 12.06…"
            className={FIELD}
          />
          <button type="submit" className={BTN_GHOST}>Enregistrer la note</button>
        </form>
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
          </a>{" "}
          (remboursements et détails du paiement)
        </p>
      )}
    </div>
  );
}
