"use client";

import { useEffect, useState } from "react";
import { loadStripe } from "@stripe/stripe-js/pure";
import {
  CheckoutElementsProvider,
  PaymentElement,
  useCheckoutElements,
} from "@stripe/react-stripe-js/checkout";
import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useIsDark } from "@/lib/theme";
import { stripeAppearance } from "@/lib/stripe-appearance";
import { formatChf } from "@/lib/format";
import {
  alertError,
  badge,
  badgeNeutral,
  btnAccentLg,
  card,
} from "../../../_ui";

let stripePromise: ReturnType<typeof loadStripe> | null = null;
// Clé publiable à l'exécution (vars Worker) avec repli sur la valeur inlinée
// au build — même logique que le checkout (la preview utilise la clé TEST).
function getStripePromise(publishableKey?: string) {
  stripePromise ??= loadStripe(
    publishableKey || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
  );
  return stripePromise;
}

export function QuotePayFlow({
  quoteId,
  totalCents,
  locale,
  stripePublishableKey,
}: {
  quoteId: string;
  totalCents: number;
  locale: string;
  stripePublishableKey?: string;
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
          body: JSON.stringify({ quoteId, locale }),
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
  }, [quoteId, locale, t]);

  if (error) {
    return (
      <p className={`${alertError} mt-5`}>{error}</p>
    );
  }
  if (!clientSecret) {
    return <p className="mt-5 text-sm text-soft">{t("quotePay.loading")}</p>;
  }

  return (
    <CheckoutElementsProvider
      stripe={getStripePromise(stripePublishableKey)}
      options={{
        clientSecret,
        elementsOptions: { appearance: stripeAppearance(isDark) },
      }}
    >
      <PayStep quoteId={quoteId} totalCents={totalCents} locale={locale} />
    </CheckoutElementsProvider>
  );
}

function PayStep({
  quoteId,
  totalCents,
  locale,
}: {
  quoteId: string;
  totalCents: number;
  locale: string;
}) {
  const t = useTranslations("account");
  const tc = useTranslations("checkout");
  const router = useRouter();
  const checkoutState = useCheckoutElements();
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    if (checkoutState.type !== "success") return;
    setPaying(true);
    setError(null);
    const result = await checkoutState.checkout.confirm();
    if (result.type === "error") {
      setError(result.error.message ?? t("quotePay.error"));
      setPaying(false);
      return;
    }
    // Même identifiant de session que porte return_url : redirection garantie
    // pour les moyens de paiement qui ne font pas naviguer le navigateur eux-mêmes.
    router.push(
      `/account/quotes/${quoteId}/pay?session_id=${encodeURIComponent(result.session.id)}`,
    );
  }

  return (
    <div className={`${card} mt-5 sm:p-7`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-display text-subtitle font-bold text-ink">{tc("paymentTitle")}</p>
        <span className={`${badge} ${badgeNeutral} gap-1.5`}>
          <Lock size={12} strokeWidth={1.5} />
          {tc("securedByStripe")}
        </span>
      </div>

      <div className="mt-5 flex items-baseline justify-between rounded-field bg-paper px-4 py-3.5 ring-1 ring-line">
        <span className="text-sm font-medium text-soft">
          {tc("totalToPay")}
        </span>
        <span className="s3d-num font-display text-subtitle font-bold">
          {formatChf(totalCents, locale)}
        </span>
      </div>

      <div className="mt-5">
        <PaymentElement
          options={{
            layout: {
              type: "accordion",
              radios: "never",
              spacedAccordionItems: true,
            },
          }}
        />
      </div>
      {error && (
        <p className={`${alertError} mt-5`}>{error}</p>
      )}
      <button
        type="button"
        onClick={pay}
        disabled={checkoutState.type !== "success" || paying}
        className={`${btnAccentLg} mt-6`}
      >
        {paying ? (
          <>
            <span
              aria-hidden
              className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
            />
            {tc("processing")}
          </>
        ) : (
          <>
            <Lock size={15} strokeWidth={1.5} />
            {tc("payNow", { amount: formatChf(totalCents, locale) })}
          </>
        )}
      </button>

      <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-soft">
        <Lock size={12} strokeWidth={1.5} className="shrink-0" />
        {tc("paymentReassurance")}
      </p>
    </div>
  );
}
