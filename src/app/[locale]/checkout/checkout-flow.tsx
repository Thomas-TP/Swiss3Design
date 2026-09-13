"use client";

import { useEffect, useId, useRef, useState } from "react";
// Import « /pure » : la variante par défaut injecte le script Stripe (et ses
// iframes antifraude) dès l'import du module, même sans appeler loadStripe.
import { loadStripe } from "@stripe/stripe-js/pure";
import {
  CheckoutElementsProvider,
  PaymentElement,
  useCheckoutElements,
} from "@stripe/react-stripe-js/checkout";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Lock,
  ShoppingBag,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import {
  GuestEmailVerification,
  type EmailProof,
} from "@/components/guest-email-verification";
import { Select } from "@/components/select";
import { useCart } from "@/lib/cart";
import { useSession } from "@/lib/auth-client";
import { useIsDark } from "@/lib/theme";
import { stripeAppearance } from "@/lib/stripe-appearance";
import { formatChf } from "@/lib/format";
import { shippingFor } from "@/lib/shipping";
import { CANTONS, CANTON_CODES } from "@/lib/cantons";

// Stripe.js est préchargé dès l'arrivée sur le checkout (voir le useEffect dans
// CheckoutFlow) : le download du script + iframes (js.stripe.com, m.stripe.network)
// se fait pendant la saisie de l'adresse, pour que le passage à l'étape paiement
// soit immédiat — plus d'attente du téléchargement après la création du
// PaymentIntent. La variante « /pure » nous laisse choisir ce moment.
let stripePromise: ReturnType<typeof loadStripe> | null = null;
// La clé publiable vient d'abord des vars du Worker (runtime : permet à la
// preview d'utiliser la clé TEST alors que le build embarque la clé live),
// avec repli sur la valeur inlinée au build (dev local).
function getStripePromise(publishableKey?: string) {
  stripePromise ??= loadStripe(
    publishableKey || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
  );
  return stripePromise;
}

const field =
  "w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm transition-colors placeholder:text-soft/60 focus:border-ink focus:outline-none";

// CANTONS/CANTON_CODES déplacés vers src/lib/cantons.ts (réutilisés par le
// carnet d'adresses du compte).

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

// Un seul passage de `/<[^>]+>/g` peut laisser passer des balises imbriquées
// (ex. "<<script>x</script>>" ne se nettoie pas en un seul passage) : on
// répète jusqu'à stabilité.
function stripTags(s: string): string {
  let out = s;
  let prev: string;
  do {
    prev = out;
    out = out.replace(/<[^>]+>/g, "");
  } while (out !== prev);
  return out;
}

function parseGeoAdminResult(r: {
  attrs?: { label?: string; detail?: string };
}): Suggestion | null {
  const raw = stripTags(r.attrs?.label ?? "").trim();
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
  const listId = useId();
  const pending = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      pending.current?.abort();
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  function handleInput(value: string) {
    pending.current?.abort();
    if (timer.current) clearTimeout(timer.current);
    const selected = items.find((item) => item.label === value);
    if (selected) {
      onPick(selected);
      setItems([]);
      return;
    }
    onChange(value);
    setItems([]);
    if (value.trim().length < 3) return;
    const controller = new AbortController();
    pending.current = controller;
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          "https://api3.geo.admin.ch/rest/services/api/SearchServer?searchText=" +
            encodeURIComponent(value) +
            "&type=locations&origins=address&limit=5",
          { signal: controller.signal },
        );
        const data = (await res.json()) as {
          results?: Parameters<typeof parseGeoAdminResult>[0][];
        };
        if (!controller.signal.aborted)
          setItems(
            (data.results ?? [])
              .map(parseGeoAdminResult)
              .filter((item): item is Suggestion => item !== null),
          );
      } catch {
        /* La saisie manuelle reste utilisable hors réseau. */
      }
    }, 250);
  }
  return (
    <div className="relative">
      <input
        value={value}
        onChange={(e) => handleInput(e.target.value)}
        list={listId}
        aria-label={placeholder}
        required
        autoComplete="street-address"
        placeholder={placeholder}
        className={field}
      />
      <datalist id={listId}>
        {items.map((item) => (
          <option key={item.label} value={item.label}>
            {item.label}
          </option>
        ))}
      </datalist>
    </div>
  );
}

// ── Indicateur d'étapes ──────────────────────────────────────────────────────

function Steps({ current }: { current: 1 | 2 }) {
  const t = useTranslations("checkout");
  const steps = [t("stepDelivery"), t("stepPayment")];
  return (
    <ol className="flex items-center gap-3">
      {steps.map((label, i) => {
        const n = (i + 1) as 1 | 2;
        const active = n === current;
        const done = n < current;
        return (
          <li key={label} className="flex items-center gap-3">
            {i > 0 && <span className="h-px w-10 bg-line sm:w-16" />}
            <span
              className={`flex items-center gap-2 text-sm font-semibold ${
                active ? "text-ink" : done ? "text-emerald-600" : "text-soft"
              }`}
            >
              <span
                className={`grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${
                  active
                    ? "bg-ink text-paper"
                    : done
                      ? "bg-emerald-600 text-white"
                      : "bg-line text-soft"
                }`}
              >
                {done ? <Check size={13} strokeWidth={3} /> : n}
              </span>
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

// ── Récapitulatif (colonne latérale) ─────────────────────────────────────────

function SummaryCard({
  shippingCents,
  discountCents,
  discount,
  setDiscount,
  editable,
  confirmedSubtotal,
}: {
  shippingCents: number;
  discountCents: number;
  discount: { code: string; discountCents: number } | null;
  setDiscount: (d: { code: string; discountCents: number } | null) => void;
  editable: boolean;
  confirmedSubtotal?: number;
}) {
  const t = useTranslations("checkout");
  const locale = useLocale();
  const { items, subtotalCents: cartSubtotal } = useCart();
  const subtotalCents = confirmedSubtotal ?? cartSubtotal;
  const [code, setCode] = useState(discount?.code ?? "");
  const [applying, setApplying] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);

  async function applyCode() {
    const c = code.trim();
    if (!c || applying) return;
    setApplying(true);
    setPromoError(null);
    try {
      const res = await fetch("/api/discount/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: c, subtotalCents }),
      });
      const data = (await res.json()) as {
        valid: boolean;
        code?: string;
        discountCents?: number;
      };
      if (data.valid && data.code && data.discountCents) {
        setDiscount({ code: data.code, discountCents: data.discountCents });
      } else {
        setDiscount(null);
        setPromoError(t("promoInvalid"));
      }
    } catch {
      setPromoError(t("promoInvalid"));
    } finally {
      setApplying(false);
    }
  }

  const total = subtotalCents - discountCents + shippingCents;

  return (
    <div className="rounded-card border border-line bg-surface p-5 sm:p-6">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <ShoppingBag size={15} className="text-soft" />
        {t("summary")}
      </p>
      <ul className="mt-3 space-y-2 text-sm">
        {items.map((i) => (
          <li
            key={`${i.productId}:${i.variantId ?? ""}:${i.colorName ?? ""}`}
            className="flex justify-between gap-3"
          >
            <span className="text-soft">
              {i.quantity} × {i.name}
              {i.variantName ? ` (${i.variantName})` : ""}
              {i.colorName ? ` — ${i.colorName}` : ""}
            </span>
            <span className="font-medium tabular-nums">
              {formatChf(i.priceCents * i.quantity, locale)}
            </span>
          </li>
        ))}
        {discountCents > 0 && (
          <li className="flex justify-between gap-3 border-t border-line pt-2 text-emerald-600 dark:text-emerald-400">
            <span>
              {t("discountLine")}
              {discount?.code ? ` (${discount.code})` : ""}
            </span>
            <span className="font-medium tabular-nums">
              −{formatChf(discountCents, locale)}
            </span>
          </li>
        )}
        <li
          className={`flex justify-between gap-3 ${
            discountCents > 0 ? "" : "border-t border-line pt-2"
          }`}
        >
          <span className="text-soft">{t("shippingLine")}</span>
          <span className="font-medium tabular-nums">
            {shippingCents === 0
              ? t("shippingFree")
              : formatChf(shippingCents, locale)}
          </span>
        </li>
        <li className="flex justify-between gap-3 font-bold">
          <span>{t("totalLine")}</span>
          <span className="tabular-nums">{formatChf(total, locale)}</span>
        </li>
      </ul>

      {editable && (
        <div className="mt-4 border-t border-line pt-4">
          {discount ? (
            <div className="flex items-center justify-between gap-2 rounded-xl bg-emerald-500/10 px-3.5 py-2.5 text-sm">
              <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                {discount.code}
              </span>
              <button
                type="button"
                onClick={() => {
                  setDiscount(null);
                  setCode("");
                  setPromoError(null);
                }}
                className="text-xs font-semibold text-soft transition-colors hover:text-accent"
              >
                {t("promoRemove")}
              </button>
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      applyCode();
                    }
                  }}
                  placeholder={t("promoPlaceholder")}
                  className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm uppercase transition-colors placeholder:normal-case placeholder:text-soft/60 focus:border-ink focus:outline-none"
                />
                <button
                  type="button"
                  onClick={applyCode}
                  disabled={!code.trim() || applying}
                  className="shrink-0 rounded-xl bg-ink px-4 text-sm font-semibold text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {applying ? "…" : t("promoApply")}
                </button>
              </div>
              {promoError && (
                <p className="mt-2 text-xs font-medium text-accent">
                  {promoError}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Vérification de l'e-mail invité (code à 6 chiffres) ─────────────────────

// ── Flux de commande ─────────────────────────────────────────────────────────

export function CheckoutFlow({
  initialAddress,
  shippingSettings,
  sessionEmail,
  stripePublishableKey,
}: {
  initialAddress: CheckoutAddress | null;
  shippingSettings: { shippingCents: number; freeOverCents: number };
  sessionEmail: string | null;
  stripePublishableKey?: string;
}) {
  const t = useTranslations("checkout");
  const locale = useLocale();
  const { items, subtotalCents } = useCart();
  const { data: authSession } = useSession();

  const accountEmail = authSession?.user.email ?? sessionEmail;

  const [addr, setAddr] = useState<CheckoutAddress>(
    initialAddress ?? EMPTY_ADDRESS,
  );
  const [proof, setProof] = useState<EmailProof | null>(null);
  const checkoutAttempt = useRef<{ fingerprint: string; id: string } | null>(
    null,
  );
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [totalCents, setTotalCents] = useState(0);
  const [discount, setDiscount] = useState<{
    code: string;
    discountCents: number;
  } | null>(null);
  const [serverShipping, setServerShipping] = useState(0);
  const [serverDiscount, setServerDiscount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Suit le thème du site pour accorder l'apparence du Payment Element Stripe
  const isDark = useIsDark();

  // Préchargement de stripe.js dès le montage du checkout : le script se
  // télécharge en parallèle de la saisie de l'adresse, donc le passage à
  // l'étape paiement n'attend plus que le PaymentIntent. Différé en idle pour
  // ne pas concurrencer le premier rendu de la page.
  // oxlint-disable exhaustive-deps -- precharge une seule fois au montage, jamais a chaque changement de cle
  useEffect(() => {
    const warm = () => void getStripePromise(stripePublishableKey);
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(warm);
      return () => window.cancelIdleCallback(id);
    }
    const timer = setTimeout(warm, 1200);
    return () => clearTimeout(timer);
  }, []);
  // oxlint-enable exhaustive-deps

  const shippingCents = clientSecret
    ? serverShipping
    : shippingFor(subtotalCents, shippingSettings);
  const discountCents = clientSecret
    ? serverDiscount
    : (discount?.discountCents ?? 0);

  if (items.length === 0 && !clientSecret) {
    return (
      <div className="rounded-card border border-line bg-surface p-10 text-center">
        <ShoppingBag
          size={26}
          strokeWidth={1.6}
          className="mx-auto text-soft"
        />
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

  const emailReady = Boolean(accountEmail || proof);

  async function startPayment(formData: FormData) {
    if (!emailReady) return;
    // Garder la validation métier du canton même avec un sélecteur natif.
    if (!addr.canton) {
      setError(t("errorCanton"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        items: items.map((i) => ({
          productId: i.productId,
          variantId: i.variantId ?? undefined,
          color: i.colorName ?? undefined,
          quantity: i.quantity,
        })),
        email: accountEmail ?? proof!.email,
        emailProof: proof?.token,
        address: addr,
        saveAddress: formData.get("saveAddress") === "on",
        locale,
        discountCode: discount?.code,
      };
      const encoded = new TextEncoder().encode(
        JSON.stringify({ ...payload, emailProof: undefined }),
      );
      const fingerprint = Array.from(
        new Uint8Array(await crypto.subtle.digest("SHA-256", encoded)),
        (b) => b.toString(16).padStart(2, "0"),
      ).join("");
      // La reprise ne stocke ni adresse ni preuve d'e-mail dans sessionStorage.
      try {
        const saved = JSON.parse(
          sessionStorage.getItem("s3d-checkout-attempt") ?? "null",
        );
        if (
          saved?.fingerprint === fingerprint &&
          typeof saved.id === "string" &&
          /^[0-9a-f-]{36}$/i.test(saved.id)
        )
          checkoutAttempt.current = saved;
      } catch {
        /* Le stockage peut être désactivé. */
      }
      if (checkoutAttempt.current?.fingerprint !== fingerprint)
        checkoutAttempt.current = { fingerprint, id: crypto.randomUUID() };
      try {
        sessionStorage.setItem(
          "s3d-checkout-attempt",
          JSON.stringify(checkoutAttempt.current),
        );
      } catch {
        /* Reprise en mémoire disponible. */
      }
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          attemptId: checkoutAttempt.current.id,
        }),
      });
      if (!res.ok) {
        const failure = (await res.json()) as { error?: string };
        const key =
          failure.error === "insufficient_stock"
            ? "errorStock"
            : failure.error === "email_not_verified"
              ? "errorVerifyAgain"
              : failure.error === "unknown_product"
                ? "errorProductChanged"
                : "errorGeneric";
        if (
          failure.error === "checkout_closed" ||
          failure.error === "checkout_changed"
        ) {
          checkoutAttempt.current = null;
          try {
            sessionStorage.removeItem("s3d-checkout-attempt");
          } catch {
            /* Stockage facultatif. */
          }
        }
        setError(t(key));
        return;
      }
      const data = (await res.json()) as {
        clientSecret: string;
        totalCents: number;
        shippingCents: number;
        discountCents: number;
      };
      setTotalCents(data.totalCents);
      setServerShipping(data.shippingCents);
      setServerDiscount(data.discountCents);
      setClientSecret(data.clientSecret);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError(t("errorGeneric"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <Steps current={clientSecret ? 2 : 1} />
      <div className="mt-7 grid gap-6 lg:grid-cols-[1fr_340px] lg:items-start lg:gap-8">
        <div className="order-2 min-w-0 lg:order-1">
          {clientSecret ? (
            <CheckoutElementsProvider
              stripe={getStripePromise(stripePublishableKey)}
              options={{
                clientSecret,
                elementsOptions: {
                  // La police du site doit aussi vivre dans les iframes Stripe
                  fonts: [
                    {
                      cssSrc:
                        "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&display=swap",
                    },
                  ],
                  appearance: stripeAppearance(isDark),
                },
              }}
            >
              <PaymentStep
                totalCents={totalCents}
                onBack={() => setClientSecret(null)}
              />
            </CheckoutElementsProvider>
          ) : (
            <form action={startPayment} className="space-y-6">
              {/* Contact — compte connecté ou e-mail vérifié par code */}
              <div className="rounded-card border border-line bg-surface p-5 sm:p-6">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{t("contactTitle")}</p>
                  {accountEmail && (
                    <span className="rounded-full bg-paper px-2.5 py-1 text-[11px] font-semibold text-soft ring-1 ring-line">
                      {t("accountBadge")}
                    </span>
                  )}
                </div>
                {accountEmail ? (
                  <div className="mt-3 flex items-center gap-2.5 rounded-xl bg-paper px-4 py-3 text-sm font-medium ring-1 ring-line">
                    <CheckCircle2
                      size={17}
                      className="shrink-0 text-emerald-600"
                    />
                    <span className="truncate">{accountEmail}</span>
                  </div>
                ) : (
                  <GuestEmailVerification proof={proof} onProof={setProof} />
                )}
              </div>

              {/* Adresse — Suisse uniquement */}
              <div className="rounded-card border border-line bg-surface p-5 sm:p-6">
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
                    aria-label={t("name")}
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
                      onChange={(e) =>
                        setAddr({ ...addr, npa: e.target.value })
                      }
                      required
                      inputMode="numeric"
                      pattern="\d{4}"
                      aria-label={t("npa")}
                      title={t("errorNpa")}
                      autoComplete="postal-code"
                      placeholder={t("npa")}
                      className={field}
                    />
                    <input
                      value={addr.city}
                      onChange={(e) =>
                        setAddr({ ...addr, city: e.target.value })
                      }
                      required
                      autoComplete="address-level2"
                      aria-label={t("city")}
                      placeholder={t("city")}
                      className={field}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Select
                      value={addr.canton}
                      onChange={(canton) => setAddr({ ...addr, canton })}
                      options={CANTONS.map(([code, name]) => ({
                        value: code,
                        label: `${code} — ${name}`,
                      }))}
                      placeholder={t("canton")}
                      ariaLabel={t("canton")}
                    />
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
                        className="h-4 w-4 accent-accent"
                      />
                      {t("saveAddress")}
                    </label>
                  )}
                </div>
              </div>

              {error && (
                <p className="rounded-xl bg-accent/10 px-4 py-3 text-sm font-medium text-accent">
                  {error}
                </p>
              )}

              <div>
                <button
                  type="submit"
                  disabled={submitting || !emailReady}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-3.5 text-sm font-semibold text-white transition-all hover:bg-accent-dark active:scale-[0.98] disabled:opacity-60"
                >
                  {submitting ? t("processing") : t("continueToPayment")}
                  {!submitting && <ArrowRight size={16} />}
                </button>
                {!emailReady && (
                  <p className="mt-2.5 text-center text-xs text-soft">
                    {t("verifyToContinue")}
                  </p>
                )}
              </div>

              <Link
                href="/cart"
                className="flex items-center justify-center gap-1.5 text-sm font-medium text-soft transition-colors hover:text-ink"
              >
                <ArrowLeft size={15} />
                {t("back")}
              </Link>
            </form>
          )}
        </div>

        <aside className="order-1 lg:order-2 lg:sticky lg:top-24">
          <SummaryCard
            shippingCents={shippingCents}
            discountCents={discountCents}
            discount={discount}
            setDiscount={setDiscount}
            confirmedSubtotal={
              clientSecret
                ? totalCents + serverDiscount - serverShipping
                : undefined
            }
            editable={!clientSecret}
          />
        </aside>
      </div>
    </div>
  );
}

function PaymentStep({
  totalCents,
  onBack,
}: {
  totalCents: number;
  onBack: () => void;
}) {
  const t = useTranslations("checkout");
  const tFooter = useTranslations("footer");
  const locale = useLocale();
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
      setError(result.error.message ?? t("errorGeneric"));
      setPaying(false);
      return;
    }
    // Certains moyens de paiement (TWINT, virements…) font déjà naviguer le
    // navigateur vers return_url ; pour les autres (carte sans 3DS…), Stripe
    // ne redirige pas toujours de lui-même — on le fait nous-mêmes avec le
    // même identifiant de session que porte return_url, pour un comportement
    // garanti quel que soit le moyen choisi.
    router.push(
      `/checkout/success?session_id=${encodeURIComponent(result.session.id)}`,
    );
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

      {/* Montant à régler — hiérarchie claire, juste au-dessus des moyens de paiement */}
      <div className="mt-5 flex items-baseline justify-between rounded-2xl bg-paper px-4 py-3.5 ring-1 ring-line">
        <span className="text-sm font-medium text-soft">{t("totalToPay")}</span>
        <span className="text-xl font-bold tabular-nums tracking-tight">
          {formatChf(totalCents, locale)}
        </span>
      </div>

      <div className="mt-5">
        {/* Accordéon : tous les moyens de paiement listés proprement,
            sans le menu déroulant « plus de moyens » du mode tabs */}
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
        <p className="mt-5 rounded-xl bg-accent/10 px-4 py-3 text-sm font-medium text-accent">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={pay}
        disabled={checkoutState.type !== "success" || paying}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-3.5 text-sm font-semibold text-white transition-all hover:bg-accent-dark active:scale-[0.98] disabled:opacity-60"
      >
        {paying ? (
          <>
            <span
              aria-hidden
              className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
            />
            {t("processing")}
          </>
        ) : (
          <>
            <Lock size={15} />
            {t("payNow", { amount: formatChf(totalCents, locale) })}
          </>
        )}
      </button>

      <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-soft">
        <Lock size={12} className="shrink-0" />
        {t("paymentReassurance")}
      </p>

      <p className="mt-2 text-center text-xs text-soft">
        {t("termsPrefix")}{" "}
        <Link
          href="/legal/terms"
          target="_blank"
          rel="noopener noreferrer"
          className="underline transition-colors hover:text-ink"
        >
          {tFooter("terms")}
        </Link>
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
