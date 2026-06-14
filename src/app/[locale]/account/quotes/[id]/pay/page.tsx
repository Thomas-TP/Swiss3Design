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
import { formatChf } from "@/lib/format";
import { QuotePayFlow } from "./quote-pay-flow";

export const dynamic = "force-dynamic";

export default async function QuotePayPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale; id: string }>;
  searchParams: Promise<{ payment_intent?: string }>;
}) {
  const { locale, id } = await params;
  const { payment_intent: paymentIntentId } = await searchParams;
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

  let paid = ["paid", "in_production", "done"].includes(quote.status);
  // Filet : si Stripe nous renvoie ici après paiement, on confirme (idempotent)
  if (paymentIntentId && !paid) {
    const { env } = await getCloudflareContext({ async: true });
    const stripe = getStripe(env.STRIPE_SECRET_KEY);
    try {
      const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
      if (pi.status === "succeeded" && pi.metadata?.quoteId === quote.id) {
        await markQuotePaid(db, quote.id);
        paid = true;
      }
    } catch {
      // ignore — le webhook reste la source de vérité
    }
  }

  const payable =
    !paid &&
    (quote.status === "quoted" || quote.status === "accepted") &&
    !!quote.quotedPriceCents &&
    quote.quotedPriceCents > 0;

  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:px-6 md:py-16">
      <Link
        href="/account"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-soft transition-colors hover:text-ink"
      >
        <ArrowLeft size={15} />
        {t("orderDetail.back")}
      </Link>

      {paid ? (
        <div className="rounded-card border border-line bg-surface p-8 text-center">
          <CheckCircle2
            size={30}
            strokeWidth={1.8}
            className="mx-auto text-emerald-600"
          />
          <h1 className="mt-5 text-2xl font-bold">{t("quotePay.paidTitle")}</h1>
          <p className="mt-3 leading-relaxed text-soft">
            {t("quotePay.paidText")}
          </p>
        </div>
      ) : payable ? (
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t("quotePay.title")}
          </h1>
          <p className="mt-3 text-2xl font-semibold tabular-nums">
            {formatChf(quote.quotedPriceCents!, locale)}
          </p>
          {quote.adminMessage && (
            <p className="mt-3 rounded-xl bg-paper px-4 py-3 text-sm leading-relaxed text-soft ring-1 ring-line">
              {quote.adminMessage}
            </p>
          )}
          <QuotePayFlow
            quoteId={quote.id}
            totalCents={quote.quotedPriceCents!}
            locale={locale}
          />
        </div>
      ) : (
        <p className="rounded-card border border-line bg-surface p-8 text-center text-soft">
          {t("quotePay.notPayable")}
        </p>
      )}
    </div>
  );
}
