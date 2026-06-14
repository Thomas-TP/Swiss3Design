"use client";

import { useEffect, useRef, useState } from "react";
// Import « /pure » : la variante par défaut injecte le script Stripe (et ses
// iframes antifraude) dès l'import du module, même sans appeler loadStripe.
import { loadStripe } from "@stripe/stripe-js/pure";
import type { StripeElementLocale } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Lock,
  MailCheck,
  MapPin,
  Pencil,
  ShoppingBag,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Select } from "@/components/select";
import { useCart } from "@/lib/cart";
import { useSession } from "@/lib/auth-client";
import { useIsDark } from "@/lib/theme";
import { stripeAppearance } from "@/lib/stripe-appearance";
import { formatChf } from "@/lib/format";
import { shippingFor } from "@/lib/shipping";

// Stripe.js n'est chargé qu'au moment du paiement : ses iframes (js.stripe.com,
// m.stripe.network) comptent comme des processus Chrome — inutile de les créer
// pendant la saisie de l'adresse.
let stripePromise: ReturnType<typeof loadStripe> | null = null;
function getStripePromise() {
  stripePromise ??= loadStripe(
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
  );
  return stripePromise;
}

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

function SummaryCard({ shippingCents }: { shippingCents: number }) {
  const t = useTranslations("checkout");
  const locale = useLocale();
  const { items, subtotalCents } = useCart();

  return (
    <div className="rounded-card border border-line bg-surface p-5 sm:p-6">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <ShoppingBag size={15} className="text-soft" />
        {t("summary")}
      </p>
      <ul className="mt-3 space-y-2 text-sm">
        {items.map((i) => (
          <li
            key={`${i.productId}:${i.variantId ?? ""}`}
            className="flex justify-between gap-3"
          >
            <span className="text-soft">
              {i.quantity} × {i.name}
              {i.variantName ? ` (${i.variantName})` : ""}
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
  );
}

// ── Vérification de l'e-mail invité (code à 6 chiffres) ─────────────────────

type EmailProof = { email: string; token: string };

function GuestEmailVerification({
  proof,
  onProof,
}: {
  proof: EmailProof | null;
  onProof: (p: EmailProof | null) => void;
}) {
  const t = useTranslations("checkout");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [pending, setPending] = useState<"send" | "verify" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const emailValid = /^\S+@\S+\.\S+$/.test(email.trim());

  async function sendCode() {
    if (!emailValid || pending) return;
    setPending("send");
    setError(null);
    try {
      const res = await fetch("/api/checkout/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send",
          email: email.trim().toLowerCase(),
          locale,
        }),
      });
      // 429 = un code vient déjà d'être envoyé à cette adresse
      if (!res.ok && res.status !== 429) throw new Error("send_failed");
      setCodeSent(true);
      setCooldown(30);
      setCode("");
    } catch {
      setError(t("errorSendCode"));
    } finally {
      setPending(null);
    }
  }

  async function verifyCode() {
    if (code.length !== 6 || pending) return;
    setPending("verify");
    setError(null);
    try {
      const target = email.trim().toLowerCase();
      const res = await fetch("/api/checkout/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", email: target, code }),
      });
      if (!res.ok) {
        setError(t("errorCodeInvalid"));
        return;
      }
      const data = (await res.json()) as { proof: string };
      onProof({ email: target, token: data.proof });
    } catch {
      setError(t("errorGeneric"));
    } finally {
      setPending(null);
    }
  }

  if (proof) {
    return (
      <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
        <span className="flex min-w-0 items-center gap-2.5 text-sm font-medium text-emerald-800 dark:text-emerald-200">
          <CheckCircle2 size={17} className="shrink-0 text-emerald-600" />
          <span className="truncate">{proof.email}</span>
          <span className="hidden shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 sm:inline">
            {t("emailVerified")}
          </span>
        </span>
        <button
          type="button"
          onClick={() => {
            onProof(null);
            setCodeSent(false);
            setCode("");
          }}
          aria-label={t("email")}
          className="shrink-0 rounded-full p-1.5 text-emerald-700 transition-colors hover:bg-emerald-100"
        >
          <Pencil size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-3">
      <p className="text-xs leading-relaxed text-soft">{t("guestNotice")}</p>
      <div className="flex gap-2">
        <input
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setCodeSent(false);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              sendCode();
            }
          }}
          type="email"
          autoComplete="email"
          placeholder={t("email")}
          className={field}
        />
        <button
          type="button"
          onClick={sendCode}
          disabled={!emailValid || pending !== null || cooldown > 0}
          className="shrink-0 rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-paper transition-all hover:bg-ink/85 active:scale-[0.98] disabled:opacity-50"
        >
          {pending === "send"
            ? t("processing")
            : cooldown > 0
              ? t("resendIn", { s: cooldown })
              : codeSent
                ? t("resendCode")
                : t("sendCode")}
        </button>
      </div>
      {codeSent && (
        <div className="rounded-xl bg-paper p-3.5 ring-1 ring-line">
          <p className="flex items-center gap-2 text-xs font-medium text-soft">
            <MailCheck size={14} className="shrink-0 text-emerald-600" />
            {t("codeSentTo", { email: email.trim().toLowerCase() })}
          </p>
          <div className="mt-2.5 flex gap-2">
            <input
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  verifyCode();
                }
              }}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder={t("codePlaceholder")}
              className={`${field} tracking-[0.3em]`}
            />
            <button
              type="button"
              onClick={verifyCode}
              disabled={code.length !== 6 || pending !== null}
              className="shrink-0 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-accent-dark active:scale-[0.98] disabled:opacity-50"
            >
              {pending === "verify" ? t("processing") : t("verifyCode")}
            </button>
          </div>
        </div>
      )}
      {error && (
        <p className="rounded-xl bg-accent/10 px-4 py-3 text-sm font-medium text-accent">
          {error}
        </p>
      )}
      <p className="text-xs text-soft">
        {t("haveAccount")}{" "}
        <Link
          href={{ pathname: "/account/login", query: { next: "/checkout" } }}
          className="font-semibold text-accent hover:underline"
        >
          {t("loginCta")}
        </Link>
      </p>
    </div>
  );
}

// ── Flux de commande ─────────────────────────────────────────────────────────

export function CheckoutFlow({
  initialAddress,
  sessionEmail,
}: {
  initialAddress: CheckoutAddress | null;
  sessionEmail: string | null;
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
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [totalCents, setTotalCents] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Suit le thème du site pour accorder l'apparence du Payment Element Stripe
  const isDark = useIsDark();

  const shippingCents = clientSecret
    ? Math.max(totalCents - subtotalCents, 0)
    : shippingFor(subtotalCents);

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

  const emailReady = Boolean(accountEmail || proof);

  async function startPayment(formData: FormData) {
    if (!emailReady) return;
    // Le canton n'est plus un <select> natif : validation manuelle
    if (!addr.canton) {
      setError(t("errorCanton"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({
            productId: i.productId,
            variantId: i.variantId ?? undefined,
            quantity: i.quantity,
          })),
          email: accountEmail ?? proof!.email,
          emailProof: proof?.token,
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
            <Elements
              stripe={getStripePromise()}
              options={{
                clientSecret,
                locale: locale as StripeElementLocale,
                // La police du site doit aussi vivre dans les iframes Stripe
                fonts: [
                  {
                    cssSrc:
                      "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&display=swap",
                  },
                ],
                appearance: stripeAppearance(isDark),
              }}
            >
              <PaymentStep
                totalCents={totalCents}
                onBack={() => setClientSecret(null)}
              />
            </Elements>
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
          <SummaryCard shippingCents={shippingCents} />
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
    <div className="rounded-card border border-line bg-surface p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-lg font-bold tracking-tight">{t("paymentTitle")}</p>
        <span className="flex items-center gap-1.5 text-xs font-medium text-soft">
          <Lock size={13} />
          {t("securedByStripe")}
        </span>
      </div>
      <p className="mt-1 text-sm text-soft">{t("paymentSubtitle")}</p>

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
        onClick={pay}
        disabled={!stripe || paying}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-3.5 text-sm font-semibold text-white transition-all hover:bg-accent-dark active:scale-[0.98] disabled:opacity-60"
      >
        <Lock size={15} />
        {paying
          ? t("processing")
          : t("payNow", { amount: formatChf(totalCents, locale) })}
      </button>

      <p className="mt-3 text-center text-xs text-soft">
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
