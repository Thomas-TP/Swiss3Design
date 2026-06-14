"use client";

import { useEffect, useState } from "react";
import { loadStripe } from "@stripe/stripe-js/pure";
import type { StripeElementLocale } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useIsDark } from "@/lib/theme";
import { stripeAppearance } from "@/lib/stripe-appearance";
import { formatChf } from "@/lib/format";

let stripePromise: ReturnType<typeof loadStripe> | null = null;
function getStripePromise() {
  stripePromise ??= loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
  return stripePromise;
}

export function QuotePayFlow({
  quoteId,
  totalCents,
  locale,
}: {
  quoteId: string;
  totalCents: number;
  locale: string;
}) {
  const t = useTranslations("account");
  const isDark = useIsDark();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/quote-checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quoteId }),
        });
        if (!res.ok) throw new Error();
        const data = (await res.json()) as { clientSecret: string };
        if (active) setClientSecret(data.clientSecret);
      } catch {
        if (active) setError(t("quotePay.error"));
      }
    })();
    return () => {
      active = false;
    };
  }, [quoteId, t]);

  if (error) {
    return (
      <p className="mt-5 rounded-xl bg-accent/10 px-4 py-3 text-sm font-medium text-accent">
        {error}
      </p>
    );
  }
  if (!clientSecret) {
    return <p className="mt-5 text-sm text-soft">{t("quotePay.loading")}</p>;
  }

  return (
    <Elements
      stripe={getStripePromise()}
      options={{
        clientSecret,
        locale: locale as StripeElementLocale,
        appearance: stripeAppearance(isDark),
      }}
    >
      <PayStep totalCents={totalCents} locale={locale} />
    </Elements>
  );
}

function PayStep({
  totalCents,
  locale,
}: {
  totalCents: number;
  locale: string;
}) {
  const t = useTranslations("account");
  const tc = useTranslations("checkout");
  const stripe = useStripe();
  const elements = useElements();
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    if (!stripe || !elements) return;
    setPaying(true);
    setError(null);
    const { error: e } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.href },
    });
    if (e) {
      setError(e.message ?? t("quotePay.error"));
      setPaying(false);
    }
  }

  return (
    <div className="mt-5 rounded-card border border-line bg-surface p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-lg font-bold tracking-tight">{tc("paymentTitle")}</p>
        <span className="flex items-center gap-1.5 text-xs font-medium text-soft">
          <Lock size={13} />
          {tc("securedByStripe")}
        </span>
      </div>
      <div className="mt-5">
        <PaymentElement
          options={{
            layout: { type: "accordion", radios: "never", spacedAccordionItems: true },
          }}
        />
      </div>
      {error && (
        <p className="mt-5 rounded-xl bg-accent/10 px-4 py-3 text-sm font-medium text-accent">
          {error}
        </p>
      )}
      <button
        onClick={pay}
        disabled={!stripe || paying}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-3.5 text-sm font-semibold text-white transition-all hover:bg-accent-dark active:scale-[0.98] disabled:opacity-60"
      >
        <Lock size={15} />
        {paying
          ? tc("processing")
          : tc("payNow", { amount: formatChf(totalCents, locale) })}
      </button>
    </div>
  );
}
