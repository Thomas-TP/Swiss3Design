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
import { Link } from "@/i18n/navigation";
import { getDb } from "@/db";
import { markOrderPaid } from "@/lib/orders";
import { getStripe } from "@/lib/stripe";
import { getServerSession } from "@/lib/session";
import { ClearCart } from "./clear-cart";

export const dynamic = "force-dynamic";

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ payment_intent?: string }>;
}) {
  const { payment_intent: paymentIntentId } = await searchParams;
  const [t, session] = await Promise.all([
    getTranslations("orderSuccess"),
    getServerSession(),
  ]);

  let status: "succeeded" | "processing" | "failed" = "failed";
  let orderNumber: string | null = null;
  let receiptEmail: string | null = null;

  if (paymentIntentId) {
    const { env } = await getCloudflareContext({ async: true });
    const stripe = getStripe(env.STRIPE_SECRET_KEY);
    try {
      const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
      orderNumber = pi.metadata?.orderNumber ?? null;
      receiptEmail = pi.receipt_email ?? null;
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
                  ? { pathname: "/account/register", query: { email: receiptEmail } }
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
