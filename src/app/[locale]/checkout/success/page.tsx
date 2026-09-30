import {
  CheckCircle2,
  Clock,
  XCircle,
  ArrowRight,
  UserPlus,
  PackageSearch,
} from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { getDb } from "@/db";
import { orderItems, orders } from "@/db/schema";
import { settleSession } from "@/lib/checkout-session";
import { getStripe } from "@/lib/stripe";
import { getServerSession } from "@/lib/session";
import { chf } from "@/lib/analytics";
import { formatChf } from "@/lib/format";
import { TrackEvent } from "@/components/track-event";
import { ButtonLink } from "@/components/ui/button";
import { withDot } from "@/components/ui/dot-title";
import { AttributionQuestion } from "./attribution-question";
import styles from "./success.module.css";
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

// Confirmation de commande (brief « Strates » §7.15). Hors groupe (site) : ni
// Lenis ni canvas. Seul mouvement : la carte « s'imprime » une fois en CSS
// (`.s3d-print`, 8 paliers, coupé en mouvement réduit). La logique — lecture
// de la session Stripe, `settleSession` idempotent, panier vidé, « Order
// Completed » émis une fois — est celle d'avant la refonte.
export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id: sessionId } = await searchParams;
  const [t, ts, locale, session] = await Promise.all([
    getTranslations("orderSuccess"),
    getTranslations("system.success"),
    getLocale(),
    getServerSession(),
  ]);

  let status: "succeeded" | "processing" | "failed" = "failed";
  let orderNumber: string | null = null;
  let receiptEmail: string | null = null;
  let amountCents: number | null = null;
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
      amountCents = checkoutSession.amount_total;
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
  // Couleurs de statut conservées (émeraude, ambre) ; l'échec prend le rouge
  // lisible (< 24 px : `accent-text`).
  const iconTone =
    status === "succeeded"
      ? "text-emerald-700 dark:text-emerald-300"
      : status === "processing"
        ? "text-amber-700 dark:text-amber-300"
        : "text-accent-text";
  const kicker =
    status === "succeeded"
      ? ts("kicker")
      : status === "processing"
        ? ts("processingKicker")
        : ts("failedKicker");
  const title =
    status === "succeeded"
      ? ts("title")
      : status === "processing"
        ? t("processingTitle")
        : t("failedTitle");
  const text =
    status === "succeeded"
      ? ts("text")
      : status === "processing"
        ? t("processing")
        : t("failed");

  // Un seul bouton rouge par écran : « Créer mon compte » quand il est
  // proposé (invité après un paiement réussi), sinon le lien principal.
  const guestOffer = status === "succeeded" && !session;

  return (
    <div className="s3d-page py-12 md:py-20">
      {status === "succeeded" && <ClearCart />}
      {purchase && (
        <TrackEvent
          event="Order Completed"
          properties={purchase}
          onceKey={purchase.order_id}
        />
      )}
      <div className="mx-auto max-w-3xl">
        <p className="s3d-label flex items-center gap-2 text-soft">
          <Icon
            size={16}
            strokeWidth={1.5}
            aria-hidden="true"
            className={iconTone}
          />
          {kicker}
        </p>
        <h1 className="mt-3 font-display text-display break-words text-ink">
          {withDot(title)}
        </h1>
        <p className="mt-5 max-w-xl text-lead text-soft">{text}</p>

        {/* La carte de confirmation « s'imprime » une fois (CSS seul, jamais
            sur le h1). Le ticket est en mono : n° et montant sont des données
            réelles, lisibles d'un coup d'œil et à copier. */}
        <section
          className={`s3d-print ${styles.card} mt-10 rounded-card border border-line bg-surface p-6 sm:p-8`}
        >
          {status === "succeeded" && (
            <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
              <div>
                <dt className="s3d-label text-soft">{ts("ticketNumber")}</dt>
                <dd className="mt-1.5 break-all font-mono text-2xl font-medium tracking-tight text-ink">
                  {orderNumber ?? "—"}
                </dd>
              </div>
              {amountCents !== null && (
                <div>
                  <dt className="s3d-label text-soft">{ts("ticketAmount")}</dt>
                  <dd className="s3d-num mt-1.5 font-mono text-2xl font-medium tracking-tight text-ink">
                    {formatChf(amountCents, locale)}
                  </dd>
                </div>
              )}
            </dl>
          )}
          <div
            className={
              status === "succeeded"
                ? "mt-6 border-t border-dashed border-iso pt-6"
                : ""
            }
          >
            <ButtonLink
              href={status === "failed" ? "/cart" : "/shop"}
              variant={guestOffer ? "secondary" : "primary"}
              size="lg"
            >
              {status === "failed" ? t("backCart") : t("backShop")}
              <ArrowRight size={18} strokeWidth={1.5} />
            </ButtonLink>
          </div>
        </section>

        {purchase && <AttributionQuestion orderId={purchase.order_id} />}

        {/* Conversion invité → compte : seulement après un paiement réussi et
            si le client n'est pas déjà connecté. L'e-mail (déjà vérifié au
            checkout) pré-remplit l'inscription ; ses commandes invité y sont
            rattachées automatiquement. */}
        {guestOffer && (
          <section className="mt-6 rounded-card border border-line bg-surface p-6 sm:p-8">
            <h2 className="font-display text-title text-ink">
              {t("createAccountTitle")}
            </h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-soft">
              {t("createAccountText")}
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
              <ButtonLink
                href={
                  receiptEmail
                    ? {
                        pathname: "/account/register",
                        query: { email: receiptEmail },
                      }
                    : "/account/register"
                }
                variant="primary"
              >
                <UserPlus size={16} strokeWidth={1.5} />
                {t("createAccountCta")}
              </ButtonLink>
              <ButtonLink
                href={
                  orderNumber
                    ? { pathname: "/track", query: { order: orderNumber } }
                    : "/track"
                }
                variant="secondary"
              >
                <PackageSearch size={16} strokeWidth={1.5} />
                {t("trackGuestCta")}
              </ButtonLink>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
