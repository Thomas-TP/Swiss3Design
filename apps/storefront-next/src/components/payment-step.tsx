"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import type { Stripe } from "@stripe/stripe-js";
import { ArrowLeft, Lock } from "lucide-react";
import { formatChfAmount } from "@/lib/format";
import { stripeAppearance } from "@/lib/stripe-appearance";
import { useIsDark } from "@/lib/theme";

// Étape paiement : binding React officiel @stripe/react-stripe-js (contrairement
// au storefront SolidStart, qui a dû intégrer Stripe.js vanilla faute de binding
// officiel pour Solid) - Elements/PaymentElement classiques, PaymentIntent créé
// par @medusajs/payment-stripe (pas de Stripe Checkout Sessions).
function PaymentForm({ totalAmount, onBack }: { totalAmount: number; onBack: () => void }) {
  const t = useTranslations("checkout");
  const tFooter = useTranslations("footer");
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
      setError(submitError.message ?? t("errorGeneric"));
      setPaying(false);
      return;
    }
    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/${locale}/checkout/success` },
      redirect: "if_required",
    });
    if (confirmError) {
      setError(confirmError.message ?? t("errorGeneric"));
      setPaying(false);
      return;
    }
    window.location.href = `/${locale}/checkout/success`;
  }

  return (
    <div className="rounded-card border border-line bg-surface p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-lg font-bold tracking-tight">{t("paymentTitle")}</p>
        <span className="flex items-center gap-1.5 rounded-full bg-paper px-2.5 py-1 text-[11px] font-semibold text-soft ring-1 ring-line">
          <Lock size={12} />
          {t("securedByStripe")}
        </span>
      </div>
      <p className="mt-1 text-sm text-soft">{t("paymentSubtitle")}</p>

      <div className="mt-5 flex items-baseline justify-between rounded-2xl bg-paper px-4 py-3.5 ring-1 ring-line">
        <span className="text-sm font-medium text-soft">{t("totalToPay")}</span>
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
            {t("processing")}
          </>
        ) : (
          <>
            <Lock size={15} />
            {t("payNow", { amount: formatChfAmount(totalAmount, locale) })}
          </>
        )}
      </button>

      <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-soft">
        <Lock size={12} className="shrink-0" />
        {t("paymentReassurance")}
      </p>

      <p className="mt-2 text-center text-xs text-soft">
        {t("termsPrefix")}{" "}
        <a href={`/${locale}/legal/terms`} target="_blank" rel="noopener noreferrer" className="underline transition-colors hover:text-ink">
          {tFooter("terms")}
        </a>
        .
      </p>

      <button
        type="button"
        onClick={onBack}
        className="mt-5 flex w-full items-center justify-center gap-1.5 text-sm font-medium text-soft transition-colors hover:text-ink"
      >
        <ArrowLeft size={15} />
        {t("backToAddress")}
      </button>
    </div>
  );
}

export function PaymentStep({
  stripePromise,
  clientSecret,
  totalAmount,
  onBack,
}: {
  stripePromise: Promise<Stripe | null>;
  clientSecret: string;
  totalAmount: number;
  onBack: () => void;
}) {
  const isDark = useIsDark();
  return (
    <Elements stripe={stripePromise} options={{ clientSecret, appearance: stripeAppearance(isDark) }}>
      <PaymentForm totalAmount={totalAmount} onBack={onBack} />
    </Elements>
  );
}
