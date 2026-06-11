"use client";

import { useRef, useState } from "react";
import { loadStripe, type StripeElementLocale } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { ArrowLeft, ArrowRight, Lock, MapPin, ShoppingBag } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useCart } from "@/lib/cart";
import { useSession } from "@/lib/auth-client";
import { formatChf } from "@/lib/format";
import { shippingFor } from "@/lib/shipping";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
);

const field =
  "w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm transition-colors placeholder:text-soft/60 focus:border-ink focus:outline-none";

const CANTONS: [string, string][] = [
  ["AG", "Aargau"],
  ["AI", "Appenzell Rh.-Int."],
  ["AR", "Appenzell Rh.-Ext."],
  ["BE", "Bern"],
  ["BL", "Basel-Landschaft"],
  ["BS", "Basel-Stadt"],
  ["FR", "Fribourg"],
  ["GE", "Genève"],
  ["GL", "Glarus"],
  ["GR", "Graubünden"],
  ["JU", "Jura"],
  ["LU", "Luzern"],
  ["NE", "Neuchâtel"],
  ["NW", "Nidwalden"],
  ["OW", "Obwalden"],
  ["SG", "St. Gallen"],
  ["SH", "Schaffhausen"],
  ["SO", "Solothurn"],
  ["SZ", "Schwyz"],
  ["TG", "Thurgau"],
  ["TI", "Ticino"],
  ["UR", "Uri"],
  ["VD", "Vaud"],
  ["VS", "Valais"],
  ["ZG", "Zug"],
  ["ZH", "Zürich"],
];
const CANTON_CODES = new Set(CANTONS.map(([code]) => code));

export interface CheckoutAddress {
  name: string;
  street: string;
  npa: string;
  city: string;
  canton: string;
}

const EMPTY_ADDRESS: CheckoutAddress = {
  name: "",
  street: "",
  npa: "",
  city: "",
  canton: "",
};

// ── Autocomplétion d'adresse via l'API fédérale geo.admin.ch (gratuite) ─────

interface Suggestion extends CheckoutAddress {
  label: string;
}

function parseGeoAdminResult(r: {
  attrs?: { label?: string; detail?: string };
}): Suggestion | null {
  const raw = (r.attrs?.label ?? "").replace(/<[^>]+>/g, "").trim();
  const m = raw.match(/^(.*?)\s+(\d{4})\s+(.+)$/);
  if (!m) return null;
  const cantonMatch = (r.attrs?.detail ?? "").trim().match(/\b([a-z]{2})$/);
  const canton = cantonMatch ? cantonMatch[1].toUpperCase() : "";
  return {
    label: raw,
    name: "",
    street: m[1],
    npa: m[2],
    city: m[3],
    canton: CANTON_CODES.has(canton) ? canton : "",
  };
}

function StreetAutocomplete({
  value,
  onChange,
  onPick,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onPick: (s: Suggestion) => void;
  placeholder: string;
}) {
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleInput(v: string) {
    onChange(v);
    if (timer.current) clearTimeout(timer.current);
    if (v.trim().length < 3) {
      setOpen(false);
      setItems([]);
      return;
    }
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://api3.geo.admin.ch/rest/services/api/SearchServer?searchText=${encodeURIComponent(v)}&type=locations&origins=address&limit=5`,
        );
        const data = (await res.json()) as { results?: unknown[] };
        const parsed = (data.results ?? [])
          .map((r) => parseGeoAdminResult(r as Parameters<typeof parseGeoAdminResult>[0]))
          .filter((s): s is Suggestion => s !== null);
        setItems(parsed);
        setOpen(parsed.length > 0);
      } catch {
        // API indisponible — la saisie manuelle reste possible
      }
    }, 250);
  }

  return (
    <div className="relative">
      <input
        value={value}
        onChange={(e) => handleInput(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        required
        autoComplete="street-address"
        placeholder={placeholder}
        className={field}
      />
      {open && (
        <ul className="absolute z-20 mt-1.5 w-full overflow-hidden rounded-xl border border-line bg-surface shadow-lg shadow-ink/5">
          {items.map((s) => (
            <li key={s.label}>
              <button
                type="button"
                onMouseDown={() => {
                  onPick(s);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm transition-colors hover:bg-paper"
              >
                <MapPin size={14} className="shrink-0 text-soft" />
                {s.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Flux de commande ─────────────────────────────────────────────────────────

export function CheckoutFlow({
  initialAddress,
}: {
  initialAddress: CheckoutAddress | null;
}) {
  const t = useTranslations("checkout");
  const locale = useLocale();
  const { items, subtotalCents } = useCart();
  const { data: authSession } = useSession();

  const [addr, setAddr] = useState<CheckoutAddress>(
    initialAddress ?? EMPTY_ADDRESS,
  );
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
          address: addr,
          saveAddress: formData.get("saveAddress") === "on",
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
          key={authSession?.user.email ?? "anon"}
          name="email"
          type="email"
          required
          autoComplete="email"
          defaultValue={authSession?.user.email ?? ""}
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
            value={addr.name}
            onChange={(e) => setAddr({ ...addr, name: e.target.value })}
            required
            autoComplete="name"
            placeholder={t("name")}
            className={field}
          />
          <StreetAutocomplete
            value={addr.street}
            onChange={(street) => setAddr({ ...addr, street })}
            onPick={(s) =>
              setAddr({
                ...addr,
                street: s.street,
                npa: s.npa,
                city: s.city,
                canton: s.canton || addr.canton,
              })
            }
            placeholder={t("addressSearch")}
          />
          <div className="grid grid-cols-[110px_1fr] gap-3">
            <input
              value={addr.npa}
              onChange={(e) => setAddr({ ...addr, npa: e.target.value })}
              required
              inputMode="numeric"
              pattern="\d{4}"
              title={t("errorNpa")}
              autoComplete="postal-code"
              placeholder={t("npa")}
              className={field}
            />
            <input
              value={addr.city}
              onChange={(e) => setAddr({ ...addr, city: e.target.value })}
              required
              autoComplete="address-level2"
              placeholder={t("city")}
              className={field}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <select
              value={addr.canton}
              onChange={(e) => setAddr({ ...addr, canton: e.target.value })}
              required
              aria-label={t("canton")}
              className={`${field} ${addr.canton ? "" : "text-soft/60"}`}
            >
              <option value="" disabled>
                {t("canton")}
              </option>
              {CANTONS.map(([code, name]) => (
                <option key={code} value={code}>
                  {code} — {name}
                </option>
              ))}
            </select>
            <input
              value={t("countrySwiss")}
              disabled
              aria-label={t("country")}
              className={`${field} cursor-not-allowed bg-paper text-soft`}
            />
          </div>
          {authSession && (
            <label className="flex items-center gap-2.5 text-sm font-medium">
              <input
                type="checkbox"
                name="saveAddress"
                defaultChecked
                className="h-4 w-4 accent-[#da291c]"
              />
              {t("saveAddress")}
            </label>
          )}
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
  const tFooter = useTranslations("footer");
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
      <p className="text-center text-xs text-soft">
        {t("termsPrefix")}{" "}
        <Link
          href="/legal/terms"
          className="underline transition-colors hover:text-ink"
        >
          {tFooter("terms")}
        </Link>
        .
      </p>
    </div>
  );
}
