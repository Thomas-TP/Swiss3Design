import {
  CheckCircle2,
  Clock,
  XCircle,
  ArrowRight,
  UserPlus,
  PackageSearch,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { Link } from "@/i18n/navigation";
import { getDb } from "@/db";
import { orderItems, orders } from "@/db/schema";
import { settleSession } from "@/lib/checkout-session";
import { getStripe } from "@/lib/stripe";
import { getServerSession } from "@/lib/session";
import { chf } from "@/lib/analytics";
import { TrackEvent } from "@/components/track-event";
import { AttributionQuestion } from "./attribution-question";
import { ClearCart } from "./clear-cart";

// « Order Completed » (spécification e-commerce PostHog). `revenue` = montant
// réellement encaissé, livraison comprise : le même chiffre que Stripe.
async function orderCompletedProperties(
  db: Awaited<ReturnType<typeof getDb>>,
  session: Stripe.Checkout.Session,
  orderNumber: string | null,
) {
  const orderId = session.metadata?.orderId;
  const [items, [order]] = orderId
    ? await Promise.all([
        db
          .select({
            productId: orderItems.productId,
            name: orderItems.nameSnapshot,
            color: orderItems.colorName,
            priceCents: orderItems.priceCentsSnapshot,
            quantity: orderItems.quantity,
          })
          .from(orderItems)
          .where(eq(orderItems.orderId, orderId)),
        db
          .select({ coupon: orders.discountCode })
          .from(orders)
          .where(eq(orders.id, orderId)),
      ])
    : [[], []];
  return {
    order_id: orderNumber ?? session.id.slice(-12),
    order_type: session.metadata?.quoteId ? "custom_quote" : "shop",
    coupon: order?.coupon ?? undefined,
    revenue: chf(session.amount_total ?? 0),
    subtotal: chf(session.amount_subtotal ?? 0),
    shipping: chf(session.total_details?.amount_shipping ?? 0),
    discount: chf(session.total_details?.amount_discount ?? 0),
    currency: (session.currency ?? "chf").toUpperCase(),
    products: items.map((i) => ({
      product_id: i.productId,
      name: i.name,
      variant: i.color ?? undefined,
      price: chf(i.priceCents),
      quantity: i.quantity,
    })),
  };
}

export const dynamic = "force-dynamic";

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id: sessionId } = await searchParams;
  const [t, session] = await Promise.all([
    getTranslations("orderSuccess"),
    getServerSession(),
  ]);

  let status: "succeeded" | "processing" | "failed" = "failed";
  let orderNumber: string | null = null;
  let receiptEmail: string | null = null;
  let purchase: Awaited<ReturnType<typeof orderCompletedProperties>> | null =
    null;

  if (sessionId) {
    const { env } = await getCloudflareContext({ async: true });
    const stripe = getStripe(env.STRIPE_SECRET_KEY);
    try {
      const checkoutSession = await stripe.checkout.sessions.retrieve(
        sessionId,
        { expand: ["payment_intent"] },
      );
      orderNumber = checkoutSession.metadata?.orderNumber ?? null;
      receiptEmail =
        checkoutSession.customer_details?.email ??
        checkoutSession.customer_email;
      const db = await getDb();
      if (await settleSession(db, checkoutSession)) {
        status = "succeeded";
        // La mesure ne doit jamais masquer une confirmation de paiement.
        purchase = await orderCompletedProperties(
          db,
          checkoutSession,
          orderNumber,
        ).catch(() => null);
      } else if (checkoutSession.status === "complete") status = "processing";
    } catch {
      // Une réponse réseau perdue ne prouve pas un refus du paiement.
      status = "processing";
    }
  }

  const Icon =
    status === "succeeded"
      ? CheckCircle2
      : status === "processing"
        ? Clock
        : XCircle;

  return (
    <div className="mx-auto max-w-xl px-4 py-20 sm:px-6">
      {status === "succeeded" && <ClearCart />}
      {purchase && (
        <TrackEvent
          event="Order Completed"
          properties={purchase}
          onceKey={purchase.order_id}
        />
      )}
      <div className="rounded-card border border-line bg-surface p-10 text-center">
        <span
          className={`mx-auto grid h-16 w-16 place-items-center rounded-full ${
            status === "succeeded"
              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
              : status === "processing"
                ? "bg-amber-500/15 text-amber-600 dark:text-amber-300"
                : "bg-accent/10 text-accent"
          }`}
        >
          <Icon size={30} strokeWidth={1.8} />
        </span>
        <h1 className="mt-6 text-2xl font-bold">
          {status === "succeeded"
            ? t("title")
            : status === "processing"
              ? t("processingTitle")
              : t("failedTitle")}
        </h1>
        <p className="mt-3 leading-relaxed text-soft">
          {status === "succeeded"
            ? t("text", { orderNumber: orderNumber ?? "—" })
            : status === "processing"
              ? t("processing")
              : t("failed")}
        </p>
        <Link
          href={status === "failed" ? "/cart" : "/shop"}
          className="mt-7 inline-flex items-center gap-2 rounded-full bg-ink px-7 py-3.5 text-sm font-semibold text-paper transition-opacity hover:opacity-90"
        >
          {status === "failed" ? t("backCart") : t("backShop")}
          <ArrowRight size={16} />
        </Link>
      </div>

      {purchase && <AttributionQuestion orderId={purchase.order_id} />}

      {/* Conversion invité → compte : seulement après un paiement réussi et
          si le client n'est pas déjà connecté. L'e-mail (déjà vérifié au
          checkout) pré-remplit l'inscription ; ses commandes invité y sont
          rattachées automatiquement. */}
      {status === "succeeded" && !session && (
        <div className="mt-6 rounded-card border border-line bg-surface p-7 text-center sm:p-8">
          <h2 className="text-lg font-bold tracking-tight">
            {t("createAccountTitle")}
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-soft">
            {t("createAccountText")}
          </p>
          <div className="mt-5 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href={
                receiptEmail
                  ? {
                      pathname: "/account/register",
                      query: { email: receiptEmail },
                    }
                  : "/account/register"
              }
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-accent-dark active:scale-[0.98] sm:w-auto"
            >
              <UserPlus size={16} />
              {t("createAccountCta")}
            </Link>
            <Link
              href={
                orderNumber
                  ? { pathname: "/track", query: { order: orderNumber } }
                  : "/track"
              }
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-line px-6 py-3 text-sm font-semibold transition-colors hover:border-ink sm:w-auto"
            >
              <PackageSearch size={16} />
              {t("trackGuestCta")}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
