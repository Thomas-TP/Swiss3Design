import { CheckCircle2, Clock, XCircle, ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { Link } from "@/i18n/navigation";
import { getDb } from "@/db";
import { markOrderPaid } from "@/lib/orders";
import { getStripe } from "@/lib/stripe";
import { ClearCart } from "./clear-cart";

export const dynamic = "force-dynamic";

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ payment_intent?: string }>;
}) {
  const { payment_intent: paymentIntentId } = await searchParams;
  const t = await getTranslations("orderSuccess");

  let status: "succeeded" | "processing" | "failed" = "failed";
  let orderNumber: string | null = null;

  if (paymentIntentId) {
    const { env } = await getCloudflareContext({ async: true });
    const stripe = getStripe(env.STRIPE_SECRET_KEY);
    try {
      const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
      orderNumber = pi.metadata?.orderNumber ?? null;
      if (pi.status === "succeeded") {
        status = "succeeded";
        // Filet de sécurité si le webhook n'est pas encore passé (idempotent)
        const orderId = pi.metadata?.orderId;
        if (orderId) {
          const db = await getDb();
          await markOrderPaid(db, orderId);
        }
      } else if (pi.status === "processing") {
        status = "processing";
      }
    } catch {
      status = "failed";
    }
  }

  const Icon =
    status === "succeeded" ? CheckCircle2 : status === "processing" ? Clock : XCircle;

  return (
    <div className="mx-auto max-w-xl px-4 py-20 sm:px-6">
      {status !== "failed" && <ClearCart />}
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
          {status === "succeeded" ? t("title") : status === "processing" ? t("processingTitle") : t("failedTitle")}
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
    </div>
  );
}
