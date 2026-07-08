"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { Lock } from "lucide-react";
import { medusa } from "@/lib/medusa";
import { formatChfAmount } from "@/lib/format";
import { stripeAppearance } from "@/lib/stripe-appearance";
import { useIsDark } from "@/lib/theme";

const STRIPE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
let stripePromise: ReturnType<typeof loadStripe> | null = null;
function getStripePromise() {
  stripePromise ??= loadStripe(STRIPE_PUBLISHABLE_KEY);
  return stripePromise;
}

const SESSION_KEY = (quoteId: string) => `s3d-quote-pay-${quoteId}`;

function PaymentForm({
  quoteId,
  totalAmount,
  paymentCollectionId,
  onPaid,
}: {
  quoteId: string;
  totalAmount: number;
  paymentCollectionId: string;
  onPaid: () => void;
}) {
  const t = useTranslations("account.quotePay");
  const locale = useLocale();
  const stripe = useStripe();
  const elements = useElements();
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    if (!stripe || !elements || paying) return;
    setPaying(true);
    setError(null);
    const { error: submitError } = await elements.submit();
    if (submitError) {
      setError(submitError.message ?? t("error"));
      setPaying(false);
      return;
    }
    // Persisté avant confirmPayment : les moyens redirigés (TWINT...) quittent
    // la page, on retrouve cet id au retour pour appeler pay/confirm.
    sessionStorage.setItem(SESSION_KEY(quoteId), paymentCollectionId);
    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/${locale}/account/quotes/${quoteId}/pay` },
      redirect: "if_required",
    });
    if (confirmError) {
      setError(confirmError.message ?? t("error"));
      setPaying(false);
      return;
    }
    if (paymentIntent?.status === "succeeded" || paymentIntent?.status === "processing") {
      try {
        await medusa.client.fetch(`/store/quotes/${quoteId}/pay/confirm`, {
          method: "POST",
          body: { payment_collection_id: paymentCollectionId },
        });
        sessionStorage.removeItem(SESSION_KEY(quoteId));
        onPaid();
      } catch {
        setError(t("error"));
        setPaying(false);
      }
    }
  }

  return (
    <div className="mt-6 rounded-card border border-line bg-surface p-5 sm:p-7">
      <div className="flex items-baseline justify-between rounded-2xl bg-paper px-4 py-3.5 ring-1 ring-line">
        <span className="text-sm font-medium text-soft">{t("title")}</span>
        <span className="text-xl font-bold tabular-nums tracking-tight">{formatChfAmount(totalAmount, locale)}</span>
      </div>

      <div className="mt-5">
        <PaymentElement options={{ layout: { type: "accordion", radios: "never", spacedAccordionItems: true } }} />
      </div>

      {error && <p className="mt-5 rounded-xl bg-accent/10 px-4 py-3 text-sm font-medium text-accent">{error}</p>}

      <button
        onClick={pay}
        disabled={!stripe || !elements || paying}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-3.5 text-sm font-semibold text-white transition-all hover:bg-accent-dark active:scale-[0.98] disabled:opacity-60"
      >
        {paying ? (
          <>
            <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            {t("loading")}
          </>
        ) : (
          <>
            <Lock size={15} />
            {t("cta")}
          </>
        )}
      </button>
    </div>
  );
}

export function QuotePayFlow({ quoteId, totalAmount, onPaid }: { quoteId: string; totalAmount: number; onPaid: () => void }) {
  const t = useTranslations("account.quotePay");
  const isDark = useIsDark();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentCollectionId, setPaymentCollectionId] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    medusa.client
      .fetch<{ payment_collection_id: string; payment_session: { data?: { client_secret?: string } } }>(`/store/quotes/${quoteId}/pay`, {
        method: "POST",
      })
      .then(({ payment_collection_id, payment_session }) => {
        const secret = payment_session.data?.client_secret;
        if (!secret) throw new Error("no_client_secret");
        setPaymentCollectionId(payment_collection_id);
        setClientSecret(secret);
      })
      .catch(() => setError(true));
  }, [quoteId]);

  if (error) return <p className="mt-6 rounded-card border border-line bg-surface p-8 text-center text-soft">{t("error")}</p>;
  if (!clientSecret || !paymentCollectionId) {
    return <p className="mt-6 rounded-card border border-line bg-surface p-8 text-center text-soft">{t("loading")}</p>;
  }

  return (
    <Elements stripe={getStripePromise()} options={{ clientSecret, appearance: stripeAppearance(isDark) }}>
      <PaymentForm quoteId={quoteId} totalAmount={totalAmount} paymentCollectionId={paymentCollectionId} onPaid={onPaid} />
    </Elements>
  );
}
