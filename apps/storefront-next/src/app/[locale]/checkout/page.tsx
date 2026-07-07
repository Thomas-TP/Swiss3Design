"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { loadStripe } from "@stripe/stripe-js";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  MailCheck,
  MapPin,
  Pencil,
  ShoppingBag,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { medusa } from "@/lib/medusa";
import { useCart } from "@/lib/cart";
import { useSession } from "@/lib/auth-client";
import { formatChfAmount } from "@/lib/format";
import { CANTONS, CANTON_CODES } from "@/lib/cantons";
import { Select } from "@/components/select";
import { PaymentStep } from "@/components/payment-step";

const BETTER_AUTH_URL = process.env.NEXT_PUBLIC_BETTER_AUTH_URL ?? "http://localhost:3000";
const STRIPE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
let stripePromise: ReturnType<typeof loadStripe> | null = null;
function getStripePromise() {
  stripePromise ??= loadStripe(STRIPE_PUBLISHABLE_KEY);
  return stripePromise;
}

const field =
  "w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm transition-colors placeholder:text-soft/60 focus:border-ink focus:outline-none";

interface CheckoutAddress {
  name: string;
  street: string;
  npa: string;
  city: string;
  canton: string;
}
const EMPTY_ADDRESS: CheckoutAddress = { name: "", street: "", npa: "", city: "", canton: "" };

interface Suggestion extends CheckoutAddress {
  label: string;
}

function parseGeoAdminResult(r: { attrs?: { label?: string; detail?: string } }): Suggestion | null {
  const raw = (r.attrs?.label ?? "").replace(/<[^>]+>/g, "").trim();
  const m = raw.match(/^(.*?)\s+(\d{4})\s+(.+)$/);
  if (!m) return null;
  const cantonMatch = (r.attrs?.detail ?? "").trim().match(/\b([a-z]{2})$/);
  const canton = cantonMatch ? cantonMatch[1].toUpperCase() : "";
  return { label: raw, name: "", street: m[1], npa: m[2], city: m[3], canton: CANTON_CODES.has(canton) ? canton : "" };
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
            <span className={`flex items-center gap-2 text-sm font-semibold ${active ? "text-ink" : done ? "text-emerald-600" : "text-soft"}`}>
              <span className={`grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${active ? "bg-ink text-paper" : done ? "bg-emerald-600 text-white" : "bg-line text-soft"}`}>
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

function SummaryCard({
  shippingAmount,
  editable,
  onApplyPromo,
  onRemovePromo,
}: {
  shippingAmount: number | null;
  editable: boolean;
  onApplyPromo: (code: string) => Promise<string | null>;
  onRemovePromo: () => Promise<void>;
}) {
  const t = useTranslations("checkout");
  const locale = useLocale();
  const { cart } = useCart();
  const [code, setCode] = useState("");
  const [applying, setApplying] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);

  const items = cart?.items ?? [];
  const promo = cart?.promotions?.[0] ?? null;
  const subtotal = cart?.item_subtotal ?? 0;
  const discount = cart?.discount_total ?? 0;
  const shipping = shippingAmount ?? cart?.shipping_total ?? 0;
  const total = subtotal - discount + shipping;

  async function applyCode() {
    const c = code.trim();
    if (!c || applying) return;
    setApplying(true);
    setPromoError(null);
    const error = await onApplyPromo(c);
    if (error) setPromoError(error);
    setApplying(false);
  }

  return (
    <div className="rounded-card border border-line bg-surface p-5 sm:p-6">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <ShoppingBag size={15} className="text-soft" />
        {t("summary")}
      </p>
      <ul className="mt-3 space-y-2 text-sm">
        {items.map((item: { id: string; product_title?: string | null; title: string; variant_title?: string | null; metadata?: Record<string, unknown> | null; quantity: number; unit_price: number }) => (
          <li key={item.id} className="flex justify-between gap-3">
            <span className="text-soft">
              {item.quantity} × {item.product_title ?? item.title}
              {item.variant_title && item.variant_title !== "Default variant" ? ` (${item.variant_title})` : ""}
              {item.metadata?.color_name ? ` — ${item.metadata.color_name as string}` : ""}
            </span>
            <span className="font-medium tabular-nums">{formatChfAmount(item.unit_price * item.quantity, locale)}</span>
          </li>
        ))}
        {discount > 0 && (
          <li className="flex justify-between gap-3 border-t border-line pt-2 text-emerald-600 dark:text-emerald-400">
            <span>
              {t("discountLine")}
              {promo?.code ? ` (${promo.code})` : ""}
            </span>
            <span className="font-medium tabular-nums">−{formatChfAmount(discount, locale)}</span>
          </li>
        )}
        <li className={`flex justify-between gap-3 ${discount > 0 ? "" : "border-t border-line pt-2"}`}>
          <span className="text-soft">{t("shippingLine")}</span>
          <span className="font-medium tabular-nums">{shipping === 0 ? t("shippingFree") : formatChfAmount(shipping, locale)}</span>
        </li>
        <li className="flex justify-between gap-3 font-bold">
          <span>{t("totalLine")}</span>
          <span className="tabular-nums">{formatChfAmount(total, locale)}</span>
        </li>
      </ul>

      {editable && (
        <div className="mt-4 border-t border-line pt-4">
          {promo ? (
            <div className="flex items-center justify-between gap-2 rounded-xl bg-emerald-500/10 px-3.5 py-2.5 text-sm">
              <span className="font-semibold text-emerald-700 dark:text-emerald-300">{promo.code}</span>
              <button
                type="button"
                onClick={() => {
                  setCode("");
                  setPromoError(null);
                  onRemovePromo();
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
              {promoError && <p className="mt-2 text-xs font-medium text-accent">{promoError}</p>}
            </>
          )}
        </div>
      )}
    </div>
  );
}

type EmailProof = { email: string; token: string };

function GuestEmailVerification({ proof, onProof }: { proof: EmailProof | null; onProof: (p: EmailProof | null) => void }) {
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
      const res = await fetch(`${BETTER_AUTH_URL}/api/checkout/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", email: email.trim().toLowerCase(), locale }),
      });
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
      const res = await fetch(`${BETTER_AUTH_URL}/api/checkout/verify-email`, {
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
          {pending === "send" ? t("processing") : cooldown > 0 ? t("resendIn", { s: cooldown }) : codeSent ? t("resendCode") : t("sendCode")}
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
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
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
      {error && <p className="rounded-xl bg-accent/10 px-4 py-3 text-sm font-medium text-accent">{error}</p>}
      <p className="text-xs text-soft">
        {t("haveAccount")}{" "}
        <Link href={{ pathname: "/account/login", query: { next: "/checkout" } }} className="font-semibold text-accent hover:underline">
          {t("loginCta")}
        </Link>
      </p>
    </div>
  );
}

export default function CheckoutPage() {
  const t = useTranslations("checkout");
  const { cart, refresh } = useCart();
  const { data: authSession } = useSession();
  const accountEmail = authSession?.user.email ?? null;

  const [addr, setAddr] = useState<CheckoutAddress>(EMPTY_ADDRESS);
  const [proof, setProof] = useState<EmailProof | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [shippingAmount, setShippingAmount] = useState<number | null>(null);
  const [shippingOptions, setShippingOptions] = useState<{ id: string }[] | null>(null);

  useEffect(() => {
    if (!cart) return;
    medusa.store.fulfillment.listCartOptions({ cart_id: cart.id }).then(({ shipping_options }) => {
      setShippingOptions(shipping_options as { id: string }[]);
    });
    // On ne veut recharger les options de livraison que si l'id du panier
    // change (nouveau panier), pas à chaque mutation du panier lui-même.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart?.id]);

  const emailReady = Boolean(accountEmail || proof);

  async function applyPromo(code: string): Promise<string | null> {
    if (!cart) return null;
    try {
      await medusa.store.cart.addPromotions(cart.id, { promo_codes: [code] });
      await refresh();
      return null;
    } catch {
      return t("promoInvalid");
    }
  }

  async function removePromo() {
    const code = cart?.promotions?.[0]?.code;
    if (!cart || !code) return;
    await medusa.store.cart.removePromotions(cart.id, { promo_codes: [code] });
    await refresh();
  }

  async function startPayment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!cart || !emailReady) return;
    if (!addr.canton) {
      setError(t("errorCanton"));
      return;
    }
    const option = shippingOptions?.[0];
    if (!option) {
      setError(t("errorGeneric"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const [firstName, ...rest] = addr.name.trim().split(/\s+/);
      const lastName = rest.join(" ") || firstName;
      const email = accountEmail ?? proof!.email;

      await medusa.store.cart.update(cart.id, {
        email,
        shipping_address: {
          first_name: firstName,
          last_name: lastName,
          address_1: addr.street,
          city: addr.city,
          postal_code: addr.npa,
          province: addr.canton,
          country_code: "ch",
        },
      });
      await medusa.store.cart.addShippingMethod(cart.id, { option_id: option.id });
      await refresh();

      const { payment_providers } = await medusa.store.payment.listPaymentProviders({ region_id: cart.region_id! });
      const provider = payment_providers.find((p: { id: string }) => p.id.includes("stripe")) ?? payment_providers[0];
      if (!provider) throw new Error("no_provider");

      const { cart: refreshed } = await medusa.store.cart.retrieve(cart.id);
      setShippingAmount(refreshed.shipping_total ?? null);

      const { payment_collection } = await medusa.store.payment.initiatePaymentSession(refreshed, { provider_id: provider.id });
      const session_ = payment_collection.payment_sessions?.[0];
      const secret = (session_?.data as { client_secret?: string } | undefined)?.client_secret;
      if (!secret) throw new Error("no_client_secret");
      setClientSecret(secret);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError(t("errorGeneric"));
    } finally {
      setSubmitting(false);
    }
  }

  const items = cart?.items ?? [];

  if (items.length === 0 && !clientSecret) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 md:py-16">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{t("title")}</h1>
        <div className="mt-8 rounded-card border border-line bg-surface p-10 text-center">
          <ShoppingBag size={26} strokeWidth={1.6} className="mx-auto text-soft" />
          <p className="mt-4 text-soft">{t("emptyCart")}</p>
          <Link href="/shop" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-accent hover:underline">
            {t("back")}
            <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    );
  }

  const totalAmount = (cart?.item_subtotal ?? 0) - (cart?.discount_total ?? 0) + (shippingAmount ?? cart?.shipping_total ?? 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 md:py-16">
      <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{t("title")}</h1>
      <div className="mt-8">
        <Steps current={clientSecret ? 2 : 1} />
        <div className="mt-7 grid gap-6 lg:grid-cols-[1fr_340px] lg:items-start lg:gap-8">
          <div className="order-2 min-w-0 lg:order-1">
            {clientSecret ? (
              <PaymentStep
                stripePromise={getStripePromise()}
                clientSecret={clientSecret}
                totalAmount={totalAmount}
                onBack={() => setClientSecret(null)}
              />
            ) : (
              <form onSubmit={startPayment} className="space-y-6">
                <div className="rounded-card border border-line bg-surface p-5 sm:p-6">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{t("contactTitle")}</p>
                    {accountEmail && (
                      <span className="rounded-full bg-paper px-2.5 py-1 text-[11px] font-semibold text-soft ring-1 ring-line">{t("accountBadge")}</span>
                    )}
                  </div>
                  {accountEmail ? (
                    <div className="mt-3 flex items-center gap-2.5 rounded-xl bg-paper px-4 py-3 text-sm font-medium ring-1 ring-line">
                      <CheckCircle2 size={17} className="shrink-0 text-emerald-600" />
                      <span className="truncate">{accountEmail}</span>
                    </div>
                  ) : (
                    <GuestEmailVerification proof={proof} onProof={setProof} />
                  )}
                </div>

                <div className="rounded-card border border-line bg-surface p-5 sm:p-6">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="font-semibold">{t("addressTitle")}</p>
                    <span className="rounded-full bg-paper px-2.5 py-1 text-[11px] font-semibold text-soft ring-1 ring-line">🇨🇭 {t("swissOnly")}</span>
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
                      onPick={(s) => setAddr({ ...addr, street: s.street, npa: s.npa, city: s.city, canton: s.canton || addr.canton })}
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
                        options={CANTONS.map(([code, name]) => ({ value: code, label: `${code} — ${name}` }))}
                        placeholder={t("canton")}
                        ariaLabel={t("canton")}
                      />
                      <input value={t("countrySwiss")} disabled aria-label={t("country")} className={`${field} cursor-not-allowed bg-paper text-soft`} />
                    </div>
                  </div>
                </div>

                {error && <p className="rounded-xl bg-accent/10 px-4 py-3 text-sm font-medium text-accent">{error}</p>}

                <div>
                  <button
                    type="submit"
                    disabled={submitting || !emailReady}
                    className="flex w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-3.5 text-sm font-semibold text-white transition-all hover:bg-accent-dark active:scale-[0.98] disabled:opacity-60"
                  >
                    {submitting ? t("processing") : t("continueToPayment")}
                    {!submitting && <ArrowRight size={16} />}
                  </button>
                  {!emailReady && <p className="mt-2.5 text-center text-xs text-soft">{t("verifyToContinue")}</p>}
                </div>

                <Link href="/cart" className="flex items-center justify-center gap-1.5 text-sm font-medium text-soft transition-colors hover:text-ink">
                  <ArrowLeft size={15} />
                  {t("back")}
                </Link>
              </form>
            )}
          </div>

          <aside className="order-1 lg:order-2 lg:sticky lg:top-24">
            <SummaryCard shippingAmount={shippingAmount} editable={!clientSecret} onApplyPromo={applyPromo} onRemovePromo={removePromo} />
          </aside>
        </div>
      </div>
    </div>
  );
}
