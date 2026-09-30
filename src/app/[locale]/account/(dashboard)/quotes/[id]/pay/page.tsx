import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { and, eq, or } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { Link, redirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getDb } from "@/db";
import { quoteRequests } from "@/db/schema";
import { getServerSession } from "@/lib/session";
import { getStripe } from "@/lib/stripe";
import { markQuotePaid } from "@/lib/orders";
import { formatChf, renderTime } from "@/lib/format";
import { backLink, card } from "../../../_ui";
import { QuotePayFlow } from "./quote-pay-flow";

export const dynamic = "force-dynamic";

export default async function QuotePayPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale; id: string }>;
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { locale, id } = await params;
  const { session_id: sessionId } = await searchParams;
  const session = await getServerSession();
  if (!session) {
    redirect({ href: "/account/login", locale });
  }
  const { user } = session!;

  const db = await getDb();
  const [quote] = await db
    .select()
    .from(quoteRequests)
    .where(
      and(
        eq(quoteRequests.id, id),
        or(
          eq(quoteRequests.customerId, user.id),
          eq(quoteRequests.email, user.email),
        ),
      ),
    )
    .limit(1);
  if (!quote) notFound();

  const t = await getTranslations("account");

  const { env } = await getCloudflareContext({ async: true });

  let paid = ["paid", "in_production", "done"].includes(quote.status);
  // Filet : si Stripe nous renvoie ici après paiement, on confirme (idempotent)
  if (sessionId && !paid) {
    const stripe = getStripe(env.STRIPE_SECRET_KEY);
    try {
      const checkoutSession = await stripe.checkout.sessions.retrieve(
        sessionId,
        { expand: ["payment_intent"] },
      );
      const pi = checkoutSession.payment_intent;
      if (
        pi &&
        typeof pi !== "string" &&
        pi.status === "succeeded" &&
        pi.metadata?.quoteId === quote.id
      ) {
        paid = await markQuotePaid(db, quote.id, {
          id: pi.id,
          amount: pi.amount_received,
          currency: pi.currency,
          offerVersion: pi.metadata.offerVersion
            ? Number(pi.metadata.offerVersion)
            : undefined,
        });
      }
    } catch {
      // ignore — le webhook reste la source de vérité
    }
  }

  const now = renderTime();
  const expired = !!quote.validUntil && quote.validUntil.getTime() < now;
  const payable =
    !paid &&
    !expired &&
    (quote.status === "quoted" || quote.status === "accepted") &&
    !!quote.quotedPriceCents &&
    quote.quotedPriceCents > 0;

  return (
    <div className="max-w-xl">
      <Link href="/account" className={backLink}>
        <ArrowLeft size={15} strokeWidth={1.5} />
        {t("orderDetail.back")}
      </Link>

      {paid ? (
        <div className={`${card} text-center sm:p-8`}>
          <CheckCircle2
            size={30}
            strokeWidth={1.5}
            className="mx-auto text-emerald-600"
          />
          <h1 className="mt-5 break-words font-display text-title text-ink">
            {t("quotePay.paidTitle")}
          </h1>
          <p className="mt-3 leading-relaxed text-soft">
            {t("quotePay.paidText")}
          </p>
        </div>
      ) : payable ? (
        <div>
          <h1 className="break-words font-display text-title text-ink">
            {t("quotePay.title")}
          </h1>
          <p className="s3d-num mt-3 font-display text-subtitle font-bold text-ink">
            {formatChf(quote.quotedPriceCents!, locale)}
          </p>
          {quote.adminMessage && (
            <p className="mt-3 rounded-field bg-paper px-4 py-3 text-sm leading-relaxed text-soft ring-1 ring-line">
              {quote.adminMessage}
            </p>
          )}
          <QuotePayFlow
            quoteId={quote.id}
            totalCents={quote.quotedPriceCents!}
            locale={locale}
            stripePublishableKey={env.STRIPE_PUBLISHABLE_KEY ?? ""}
          />
        </div>
      ) : (
        <p className={`${card} text-center text-soft sm:p-8`}>
          {expired ? t("quotePay.expired") : t("quotePay.notPayable")}
        </p>
      )}
    </div>
  );
}
