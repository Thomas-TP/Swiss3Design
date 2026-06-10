"use client";

import { useState } from "react";
import { loadStripe, type StripeElementLocale } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { ArrowLeft, ArrowRight, Lock, ShoppingBag } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useCart } from "@/lib/cart";
import { formatChf } from "@/lib/format";
import { shippingFor } from "@/lib/shipping";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
);

const field =
  "w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm transition-colors placeholder:text-soft/60 focus:border-ink focus:outline-none";

export function CheckoutFlow() {
  const t = useTranslations("checkout");
  const locale = useLocale();
  const { items, subtotalCents } = useCart();

  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [totalCents, setTotalCents] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shippingCents = shippingFor(subtotalCents);

  if (items.length === 0 && !clientSecret) {
    return (
      <div className="rounded-card border border-line bg-surface p-10 text-center">
        <ShoppingBag size={26} strokeWidth={1.6} className="mx-auto text-soft" />
        <p className="mt-4 text-soft">{t("emptyCart")}</p>
        <Link
          href="/shop"
          className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-accent hover:underline"
        >
          {t("back")}
          <ArrowRight size={15} />
        </Link>
      </div>
    );
  }

  async function startPayment(formData: FormData) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
          })),
          email: formData.get("email"),
          address: {
            name: formData.get("name"),
            street: formData.get("street"),
            npa: formData.get("npa"),
            city: formData.get("city"),
          },
          locale,
        }),
      });
      if (!res.ok) throw new Error("checkout_failed");
      const data = (await res.json()) as {
        clientSecret: string;
        totalCents: number;
      };
      setTotalCents(data.totalCents);
      setClientSecret(data.clientSecret);
    } catch {
      setError(t("errorGeneric"));
    } finally {
      setSubmitting(false);
    }
  }

  if (clientSecret) {
    return (
      <Elements
        stripe={stripePromise}
        options={{
          clientSecret,
          locale: locale as StripeElementLocale,
          appearance: {
            theme: "stripe",
            variables: {
              colorPrimary: "#da291c",
              colorText: "#1c1917",
              colorBackground: "#ffffff",
              borderRadius: "12px",
              fontFamily: "inherit",
            },
          },
        }}
      >
        <PaymentStep totalCents={totalCents} />
      </Elements>
    );
  }

  return (
    <form action={startPayment} className="space-y-7">
      {/* Récapitulatif */}
      <div className="rounded-card border border-line bg-surface p-5">
        <p className="text-sm font-semibold">{t("summary")}</p>
        <ul className="mt-3 space-y-2 text-sm">
          {items.map((i) => (
            <li key={i.productId} className="flex justify-between gap-3">
              <span className="text-soft">
                {i.quantity} × {i.name}
              </span>
              <span className="font-medium tabular-nums">
                {formatChf(i.priceCents * i.quantity, locale)}
              </span>
            </li>
          ))}
          <li className="flex justify-between gap-3 border-t border-line pt-2">
            <span className="text-soft">{t("shippingLine")}</span>
            <span className="font-medium tabular-nums">
              {shippingCents === 0
                ? t("shippingFree")
                : formatChf(shippingCents, locale)}
            </span>
          </li>
          <li className="flex justify-between gap-3 font-bold">
            <span>{t("totalLine")}</span>
            <span className="tabular-nums">
              {formatChf(subtotalCents + shippingCents, locale)}
            </span>
          </li>
        </ul>
      </div>

      {/* Contact */}
      <div>
        <p className="mb-3 font-semibold">{t("contactTitle")}</p>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder={t("email")}
          className={field}
        />
      </div>

      {/* Adresse — Suisse uniquement */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="font-semibold">{t("addressTitle")}</p>
          <span className="rounded-full bg-paper px-2.5 py-1 text-[11px] font-semibold text-soft ring-1 ring-line">
            🇨🇭 {t("swissOnly")}
          </span>
        </div>
        <div className="space-y-3">
          <input
            name="name"
            required
            autoComplete="name"
            placeholder={t("name")}
            className={field}
          />
          <input
            name="street"
            required
            autoComplete="street-address"
            placeholder={t("street")}
            className={field}
          />
          <div className="grid grid-cols-[110px_1fr] gap-3">
            <input
              name="npa"
              required
              inputMode="numeric"
              pattern="\d{4}"
              title={t("errorNpa")}
              autoComplete="postal-code"
              placeholder={t("npa")}
              className={field}
            />
            <input
              name="city"
              required
              autoComplete="address-level2"
              placeholder={t("city")}
              className={field}
            />
          </div>
          <input
            value={t("countrySwiss")}
            disabled
            aria-label={t("country")}
            className={`${field} cursor-not-allowed bg-paper text-soft`}
          />
        </div>
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-accent">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-3.5 text-sm font-semibold text-white transition-all hover:bg-accent-dark active:scale-[0.98] disabled:opacity-60"
      >
        {submitting ? t("processing") : t("continueToPayment")}
        {!submitting && <ArrowRight size={16} />}
      </button>

      <Link
        href="/cart"
        className="flex items-center justify-center gap-1.5 text-sm font-medium text-soft transition-colors hover:text-ink"
      >
        <ArrowLeft size={15} />
        {t("back")}
      </Link>
    </form>
  );
}

function PaymentStep({ totalCents }: { totalCents: number }) {
  const t = useTranslations("checkout");
  const locale = useLocale();
  const stripe = useStripe();
  const elements = useElements();
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    if (!stripe || !elements) return;
    setPaying(true);
    setError(null);
    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/${locale}/checkout/success`,
      },
    });
    // En cas de succès, Stripe redirige : on n'arrive ici qu'en cas d'erreur
    if (stripeError) {
      setError(stripeError.message ?? t("errorGeneric"));
      setPaying(false);
    }
  }

  return (
    <div className="space-y-6">
      <p className="font-semibold">{t("paymentTitle")}</p>
      <PaymentElement />
      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-accent">
          {error}
        </p>
      )}
      <button
        onClick={pay}
        disabled={!stripe || paying}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-3.5 text-sm font-semibold text-white transition-all hover:bg-accent-dark active:scale-[0.98] disabled:opacity-60"
      >
        <Lock size={15} />
        {paying
          ? t("processing")
          : t("payNow", { amount: formatChf(totalCents, locale) })}
      </button>
    </div>
  );
}
