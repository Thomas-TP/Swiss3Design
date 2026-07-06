import {
  createSignal,
  createResource,
  createEffect,
  createMemo,
  onCleanup,
  For,
  Show,
} from "solid-js";
import { A, useNavigate } from "@solidjs/router";
import type { Stripe, StripeElements } from "@stripe/stripe-js";
import { loadStripe } from "@stripe/stripe-js";
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
} from "lucide-solid";
import { useI18n } from "../../../i18n/context";
import { medusa } from "../../../lib/medusa";
import { useCart } from "../../../lib/cart";
import { useSession } from "../../../lib/auth-client";
import { useIsDark } from "../../../lib/theme";
import { formatChfAmount } from "../../../lib/format";
import { stripeAppearance } from "../../../lib/stripe-appearance";
import { CANTONS, CANTON_CODES } from "../../../lib/cantons";
import { Select } from "../../../components/select";

const BETTER_AUTH_URL = import.meta.env.VITE_BETTER_AUTH_URL ?? "http://localhost:3000";
const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;

let stripePromise: ReturnType<typeof loadStripe> | null = null;
function getStripePromise() {
  stripePromise ??= loadStripe(STRIPE_PUBLISHABLE_KEY ?? "");
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

// ── Autocomplétion d'adresse via l'API fédérale geo.admin.ch (gratuite) ─────

interface Suggestion extends CheckoutAddress {
  label: string;
}

function parseGeoAdminResult(r: { attrs?: { label?: string; detail?: string } }): Suggestion | null {
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

function StreetAutocomplete(props: {
  value: string;
  onChange: (v: string) => void;
  onPick: (s: Suggestion) => void;
  placeholder: string;
}) {
  const [items, setItems] = createSignal<Suggestion[]>([]);
  const [open, setOpen] = createSignal(false);
  let timer: ReturnType<typeof setTimeout> | null = null;

  function handleInput(v: string) {
    props.onChange(v);
    if (timer) clearTimeout(timer);
    if (v.trim().length < 3) {
      setOpen(false);
      setItems([]);
      return;
    }
    timer = setTimeout(async () => {
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
  onCleanup(() => {
    if (timer) clearTimeout(timer);
  });

  return (
    <div class="relative">
      <input
        value={props.value}
        onInput={(e) => handleInput(e.currentTarget.value)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        required
        autocomplete="street-address"
        placeholder={props.placeholder}
        class={field}
      />
      <Show when={open()}>
        <ul class="absolute z-20 mt-1.5 w-full overflow-hidden rounded-xl border border-line bg-surface shadow-lg shadow-ink/5">
          <For each={items()}>
            {(s) => (
              <li>
                <button
                  type="button"
                  onMouseDown={() => {
                    props.onPick(s);
                    setOpen(false);
                  }}
                  class="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm transition-colors hover:bg-paper"
                >
                  <MapPin size={14} class="shrink-0 text-soft" />
                  {s.label}
                </button>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </div>
  );
}

// ── Indicateur d'étapes ──────────────────────────────────────────────────────

function Steps(props: { current: 1 | 2 }) {
  const { t } = useI18n();
  const steps = () => [t("checkout.stepDelivery"), t("checkout.stepPayment")];
  return (
    <ol class="flex items-center gap-3">
      <For each={steps()}>
        {(label, i) => {
          const n = i() + 1;
          const active = n === props.current;
          const done = n < props.current;
          return (
            <li class="flex items-center gap-3">
              <Show when={i() > 0}>
                <span class="h-px w-10 bg-line sm:w-16" />
              </Show>
              <span class={`flex items-center gap-2 text-sm font-semibold ${active ? "text-ink" : done ? "text-emerald-600" : "text-soft"}`}>
                <span class={`grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${active ? "bg-ink text-paper" : done ? "bg-emerald-600 text-white" : "bg-line text-soft"}`}>
                  {done ? <Check size={13} stroke-width={3} /> : n}
                </span>
                {label}
              </span>
            </li>
          );
        }}
      </For>
    </ol>
  );
}

// ── Récapitulatif (colonne latérale) ─────────────────────────────────────────

function SummaryCard(props: {
  shippingAmount: number | null;
  editable: boolean;
  onApplyPromo: (code: string) => Promise<string | null>;
  onRemovePromo: () => Promise<void>;
}) {
  const { t, locale } = useI18n();
  const { cart } = useCart();
  const [code, setCode] = createSignal("");
  const [applying, setApplying] = createSignal(false);
  const [promoError, setPromoError] = createSignal<string | null>(null);

  const items = () => cart()?.items ?? [];
  const promo = () => cart()?.promotions?.[0] ?? null;
  const subtotal = () => cart()?.item_subtotal ?? 0;
  const discount = () => cart()?.discount_total ?? 0;
  const shipping = () => props.shippingAmount ?? cart()?.shipping_total ?? 0;
  const total = () => subtotal() - discount() + shipping();

  async function applyCode() {
    const c = code().trim();
    if (!c || applying()) return;
    setApplying(true);
    setPromoError(null);
    const error = await props.onApplyPromo(c);
    if (error) setPromoError(error);
    setApplying(false);
  }

  return (
    <div class="rounded-card border border-line bg-surface p-5 sm:p-6">
      <p class="flex items-center gap-2 text-sm font-semibold">
        <ShoppingBag size={15} class="text-soft" />
        {t("checkout.summary")}
      </p>
      <ul class="mt-3 space-y-2 text-sm">
        <For each={items()}>
          {(item) => (
            <li class="flex justify-between gap-3">
              <span class="text-soft">
                {item.quantity} × {item.product_title ?? item.title}
                {item.variant_title && item.variant_title !== "Default variant" ? ` (${item.variant_title})` : ""}
                {item.metadata?.color_name ? ` — ${item.metadata.color_name as string}` : ""}
              </span>
              <span class="font-medium tabular-nums">{formatChfAmount(item.unit_price * item.quantity, locale())}</span>
            </li>
          )}
        </For>
        <Show when={discount() > 0}>
          <li class="flex justify-between gap-3 border-t border-line pt-2 text-emerald-600 dark:text-emerald-400">
            <span>
              {t("checkout.discountLine")}
              {promo()?.code ? ` (${promo()!.code})` : ""}
            </span>
            <span class="font-medium tabular-nums">−{formatChfAmount(discount(), locale())}</span>
          </li>
        </Show>
        <li class={`flex justify-between gap-3 ${discount() > 0 ? "" : "border-t border-line pt-2"}`}>
          <span class="text-soft">{t("checkout.shippingLine")}</span>
          <span class="font-medium tabular-nums">
            {shipping() === 0 ? t("checkout.shippingFree") : formatChfAmount(shipping(), locale())}
          </span>
        </li>
        <li class="flex justify-between gap-3 font-bold">
          <span>{t("checkout.totalLine")}</span>
          <span class="tabular-nums">{formatChfAmount(total(), locale())}</span>
        </li>
      </ul>

      <Show when={props.editable}>
        <div class="mt-4 border-t border-line pt-4">
          <Show
            when={promo()}
            fallback={
              <>
                <div class="flex gap-2">
                  <input
                    value={code()}
                    onInput={(e) => setCode(e.currentTarget.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        applyCode();
                      }
                    }}
                    placeholder={t("checkout.promoPlaceholder")}
                    class="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm uppercase transition-colors placeholder:normal-case placeholder:text-soft/60 focus:border-ink focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={applyCode}
                    disabled={!code().trim() || applying()}
                    class="shrink-0 rounded-xl bg-ink px-4 text-sm font-semibold text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {applying() ? "…" : t("checkout.promoApply")}
                  </button>
                </div>
                <Show when={promoError()}>
                  <p class="mt-2 text-xs font-medium text-accent">{promoError()}</p>
                </Show>
              </>
            }
          >
            {(p) => (
              <div class="flex items-center justify-between gap-2 rounded-xl bg-emerald-500/10 px-3.5 py-2.5 text-sm">
                <span class="font-semibold text-emerald-700 dark:text-emerald-300">{p().code}</span>
                <button
                  type="button"
                  onClick={() => {
                    setCode("");
                    setPromoError(null);
                    props.onRemovePromo();
                  }}
                  class="text-xs font-semibold text-soft transition-colors hover:text-accent"
                >
                  {t("checkout.promoRemove")}
                </button>
              </div>
            )}
          </Show>
        </div>
      </Show>
    </div>
  );
}

// ── Vérification de l'e-mail invité (code à 6 chiffres) ─────────────────────

type EmailProof = { email: string; token: string };

function GuestEmailVerification(props: { proof: EmailProof | null; onProof: (p: EmailProof | null) => void }) {
  const { t, locale } = useI18n();
  const [email, setEmail] = createSignal("");
  const [code, setCode] = createSignal("");
  const [codeSent, setCodeSent] = createSignal(false);
  const [pending, setPending] = createSignal<"send" | "verify" | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [cooldown, setCooldown] = createSignal(0);

  createEffect(() => {
    if (cooldown() <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    onCleanup(() => clearTimeout(id));
  });

  const emailValid = () => /^\S+@\S+\.\S+$/.test(email().trim());

  async function sendCode() {
    if (!emailValid() || pending()) return;
    setPending("send");
    setError(null);
    try {
      const res = await fetch(`${BETTER_AUTH_URL}/api/checkout/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", email: email().trim().toLowerCase(), locale: locale() }),
      });
      if (!res.ok && res.status !== 429) throw new Error("send_failed");
      setCodeSent(true);
      setCooldown(30);
      setCode("");
    } catch {
      setError(t("checkout.errorSendCode"));
    } finally {
      setPending(null);
    }
  }

  async function verifyCode() {
    if (code().length !== 6 || pending()) return;
    setPending("verify");
    setError(null);
    try {
      const target = email().trim().toLowerCase();
      const res = await fetch(`${BETTER_AUTH_URL}/api/checkout/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", email: target, code: code() }),
      });
      if (!res.ok) {
        setError(t("checkout.errorCodeInvalid"));
        return;
      }
      const data = (await res.json()) as { proof: string };
      props.onProof({ email: target, token: data.proof });
    } catch {
      setError(t("checkout.errorGeneric"));
    } finally {
      setPending(null);
    }
  }

  return (
    <Show
      when={props.proof}
      fallback={
        <div class="mt-3 space-y-3">
          <p class="text-xs leading-relaxed text-soft">{t("checkout.guestNotice")}</p>
          <div class="flex gap-2">
            <input
              value={email()}
              onInput={(e) => {
                setEmail(e.currentTarget.value);
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
              autocomplete="email"
              placeholder={t("checkout.email")}
              class={field}
            />
            <button
              type="button"
              onClick={sendCode}
              disabled={!emailValid() || pending() !== null || cooldown() > 0}
              class="shrink-0 rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-paper transition-all hover:bg-ink/85 active:scale-[0.98] disabled:opacity-50"
            >
              {pending() === "send"
                ? t("checkout.processing")
                : cooldown() > 0
                  ? t("checkout.resendIn", { s: cooldown() })
                  : codeSent()
                    ? t("checkout.resendCode")
                    : t("checkout.sendCode")}
            </button>
          </div>
          <Show when={codeSent()}>
            <div class="rounded-xl bg-paper p-3.5 ring-1 ring-line">
              <p class="flex items-center gap-2 text-xs font-medium text-soft">
                <MailCheck size={14} class="shrink-0 text-emerald-600" />
                {t("checkout.codeSentTo", { email: email().trim().toLowerCase() })}
              </p>
              <div class="mt-2.5 flex gap-2">
                <input
                  value={code()}
                  onInput={(e) => setCode(e.currentTarget.value.replace(/\D/g, "").slice(0, 6))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      verifyCode();
                    }
                  }}
                  inputmode="numeric"
                  autocomplete="one-time-code"
                  placeholder={t("checkout.codePlaceholder")}
                  class={`${field} tracking-[0.3em]`}
                />
                <button
                  type="button"
                  onClick={verifyCode}
                  disabled={code().length !== 6 || pending() !== null}
                  class="shrink-0 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-accent-dark active:scale-[0.98] disabled:opacity-50"
                >
                  {pending() === "verify" ? t("checkout.processing") : t("checkout.verifyCode")}
                </button>
              </div>
            </div>
          </Show>
          <Show when={error()}>
            <p class="rounded-xl bg-accent/10 px-4 py-3 text-sm font-medium text-accent">{error()}</p>
          </Show>
        </div>
      }
    >
      <div class="mt-3 flex items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
        <span class="flex min-w-0 items-center gap-2.5 text-sm font-medium text-emerald-800 dark:text-emerald-200">
          <CheckCircle2 size={17} class="shrink-0 text-emerald-600" />
          <span class="truncate">{props.proof!.email}</span>
        </span>
        <button
          type="button"
          onClick={() => {
            props.onProof(null);
            setCodeSent(false);
            setCode("");
          }}
          aria-label={t("checkout.email")}
          class="shrink-0 rounded-full p-1.5 text-emerald-700 transition-colors hover:bg-emerald-100"
        >
          <Pencil size={14} />
        </button>
      </div>
    </Show>
  );
}

// ── Étape paiement (Stripe Elements vanilla, pas de binding React) ──────────

function PaymentStep(props: {
  stripe: Stripe;
  clientSecret: string;
  totalAmount: number;
  onBack: () => void;
}) {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const isDark = useIsDark();
  const [elements, setElements] = createSignal<StripeElements | null>(null);
  const [ready, setReady] = createSignal(false);
  const [paying, setPaying] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  let container: HTMLDivElement | undefined;

  createEffect(() => {
    if (!container) return;
    const els = props.stripe.elements({
      clientSecret: props.clientSecret,
      appearance: stripeAppearance(isDark()),
    });
    const paymentElement = els.create("payment", {
      layout: { type: "accordion", radios: "never", spacedAccordionItems: true },
    });
    paymentElement.mount(container);
    paymentElement.on("ready", () => setReady(true));
    setElements(els);
    onCleanup(() => paymentElement.destroy());
  });

  async function pay() {
    const els = elements();
    if (!els || paying()) return;
    setPaying(true);
    setError(null);
    const { error: submitError } = await els.submit();
    if (submitError) {
      setError(submitError.message ?? t("checkout.errorGeneric"));
      setPaying(false);
      return;
    }
    const result = await props.stripe.confirmPayment({
      elements: els,
      confirmParams: {
        return_url: `${window.location.origin}/${locale()}/checkout/success`,
      },
      redirect: "if_required",
    });
    if (result.error) {
      setError(result.error.message ?? t("checkout.errorGeneric"));
      setPaying(false);
      return;
    }
    // Pas de redirection (carte sans 3DS, etc.) : on finalise nous-mêmes,
    // même chemin que la page de retour pour les moyens redirigés (TWINT...).
    navigate(`/${locale()}/checkout/success`);
  }

  return (
    <div class="rounded-card border border-line bg-surface p-5 sm:p-7">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <p class="text-lg font-bold tracking-tight">{t("checkout.paymentTitle")}</p>
        <span class="flex items-center gap-1.5 rounded-full bg-paper px-2.5 py-1 text-[11px] font-semibold text-soft ring-1 ring-line">
          <Lock size={12} />
          {t("checkout.securedByStripe")}
        </span>
      </div>
      <p class="mt-1 text-sm text-soft">{t("checkout.paymentSubtitle")}</p>

      <div class="mt-5 flex items-baseline justify-between rounded-2xl bg-paper px-4 py-3.5 ring-1 ring-line">
        <span class="text-sm font-medium text-soft">{t("checkout.totalToPay")}</span>
        <span class="text-xl font-bold tabular-nums tracking-tight">{formatChfAmount(props.totalAmount, locale())}</span>
      </div>

      <div class="mt-5" ref={container} />

      <Show when={error()}>
        <p class="mt-5 rounded-xl bg-accent/10 px-4 py-3 text-sm font-medium text-accent">{error()}</p>
      </Show>

      <button
        onClick={pay}
        disabled={!ready() || paying()}
        class="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-3.5 text-sm font-semibold text-white transition-all hover:bg-accent-dark active:scale-[0.98] disabled:opacity-60"
      >
        <Show
          when={!paying()}
          fallback={
            <>
              <span aria-hidden class="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              {t("checkout.processing")}
            </>
          }
        >
          <Lock size={15} />
          {t("checkout.payNow", { amount: formatChfAmount(props.totalAmount, locale()) })}
        </Show>
      </button>

      <p class="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-soft">
        <Lock size={12} class="shrink-0" />
        {t("checkout.paymentReassurance")}
      </p>

      <button
        type="button"
        onClick={props.onBack}
        class="mt-5 flex w-full items-center justify-center gap-1.5 text-sm font-medium text-soft transition-colors hover:text-ink"
      >
        <ArrowLeft size={15} />
        {t("checkout.backToAddress")}
      </button>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CheckoutPage() {
  const { t, locale } = useI18n();
  const { cart, refresh } = useCart();
  const session = useSession();

  const accountEmail = () => session().data?.user.email ?? null;

  const [addr, setAddr] = createSignal<CheckoutAddress>(EMPTY_ADDRESS);
  const [proof, setProof] = createSignal<EmailProof | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [submitting, setSubmitting] = createSignal(false);
  const [clientSecret, setClientSecret] = createSignal<string | null>(null);
  const [shippingAmount, setShippingAmount] = createSignal<number | null>(null);
  const [stripeInstance, setStripeInstance] = createSignal<Stripe | null>(null);

  getStripePromise().then(setStripeInstance);

  const [shippingOptions] = createResource(
    () => cart()?.id,
    async (cartId: string) => {
      const { shipping_options } = await medusa.store.fulfillment.listCartOptions({ cart_id: cartId });
      return shipping_options;
    },
  );

  const emailReady = createMemo(() => Boolean(accountEmail() || proof()));

  async function applyPromo(code: string): Promise<string | null> {
    const current = cart();
    if (!current) return null;
    try {
      await medusa.store.cart.addPromotions(current.id, { promo_codes: [code] });
      await refresh();
      if (!cart()?.promotions?.length) return t("checkout.promoInvalid");
      return null;
    } catch {
      return t("checkout.promoInvalid");
    }
  }

  async function removePromo() {
    const current = cart();
    const code = current?.promotions?.[0]?.code;
    if (!current || !code) return;
    await medusa.store.cart.removePromotions(current.id, { promo_codes: [code] });
    await refresh();
  }

  async function startPayment(e: SubmitEvent) {
    e.preventDefault();
    const current = cart();
    if (!current || !emailReady()) return;
    if (!addr().canton) {
      setError(t("checkout.errorCanton"));
      return;
    }
    const option = shippingOptions()?.[0];
    if (!option) {
      setError(t("checkout.errorGeneric"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const [firstName, ...rest] = addr().name.trim().split(/\s+/);
      const lastName = rest.join(" ") || firstName;
      const email = accountEmail() ?? proof()!.email;

      await medusa.store.cart.update(current.id, {
        email,
        shipping_address: {
          first_name: firstName,
          last_name: lastName,
          address_1: addr().street,
          city: addr().city,
          postal_code: addr().npa,
          province: addr().canton,
          country_code: "ch",
        },
      });
      await medusa.store.cart.addShippingMethod(current.id, { option_id: option.id });
      await refresh();

      const { payment_providers } = await medusa.store.payment.listPaymentProviders({
        region_id: current.region_id!,
      });
      const provider = payment_providers.find((p: { id: string }) => p.id.includes("stripe")) ?? payment_providers[0];
      if (!provider) throw new Error("no_provider");

      const refreshed = cart();
      if (!refreshed) throw new Error("no_cart");
      setShippingAmount(refreshed.shipping_total ?? null);

      const { payment_collection } = await medusa.store.payment.initiatePaymentSession(refreshed, {
        provider_id: provider.id,
      });
      const session_ = payment_collection.payment_sessions?.[0];
      const secret = (session_?.data as { client_secret?: string } | undefined)?.client_secret;
      if (!secret) throw new Error("no_client_secret");
      setClientSecret(secret);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError(t("checkout.errorGeneric"));
    } finally {
      setSubmitting(false);
    }
  }

  const items = () => cart()?.items ?? [];

  return (
    <div class="mx-auto max-w-5xl px-4 py-10 sm:px-6 md:py-16">
      <h1 class="text-3xl font-bold tracking-tight md:text-4xl">{t("checkout.title")}</h1>
      <div class="mt-8">
        <Show
          when={items().length > 0 || clientSecret()}
          fallback={
            <div class="rounded-card border border-line bg-surface p-10 text-center">
              <ShoppingBag size={26} stroke-width={1.6} class="mx-auto text-soft" />
              <p class="mt-4 text-soft">{t("checkout.emptyCart")}</p>
              <A href={`/${locale()}/shop`} class="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-accent hover:underline">
                {t("checkout.back")}
                <ArrowRight size={15} />
              </A>
            </div>
          }
        >
          <Steps current={clientSecret() ? 2 : 1} />
          <div class="mt-7 grid gap-6 lg:grid-cols-[1fr_340px] lg:items-start lg:gap-8">
            <div class="order-2 min-w-0 lg:order-1">
              <Show
                when={clientSecret() && stripeInstance()}
                fallback={
                  <form onSubmit={startPayment} class="space-y-6">
                    <div class="rounded-card border border-line bg-surface p-5 sm:p-6">
                      <div class="flex items-center justify-between">
                        <p class="font-semibold">{t("checkout.contactTitle")}</p>
                        <Show when={accountEmail()}>
                          <span class="rounded-full bg-paper px-2.5 py-1 text-[11px] font-semibold text-soft ring-1 ring-line">
                            {t("checkout.accountBadge")}
                          </span>
                        </Show>
                      </div>
                      <Show
                        when={accountEmail()}
                        fallback={<GuestEmailVerification proof={proof()} onProof={setProof} />}
                      >
                        <div class="mt-3 flex items-center gap-2.5 rounded-xl bg-paper px-4 py-3 text-sm font-medium ring-1 ring-line">
                          <CheckCircle2 size={17} class="shrink-0 text-emerald-600" />
                          <span class="truncate">{accountEmail()}</span>
                        </div>
                      </Show>
                    </div>

                    <div class="rounded-card border border-line bg-surface p-5 sm:p-6">
                      <div class="mb-3 flex items-center justify-between">
                        <p class="font-semibold">{t("checkout.addressTitle")}</p>
                        <span class="rounded-full bg-paper px-2.5 py-1 text-[11px] font-semibold text-soft ring-1 ring-line">
                          🇨🇭 {t("checkout.swissOnly")}
                        </span>
                      </div>
                      <div class="space-y-3">
                        <input
                          value={addr().name}
                          onInput={(e) => setAddr({ ...addr(), name: e.currentTarget.value })}
                          required
                          autocomplete="name"
                          placeholder={t("checkout.name")}
                          class={field}
                        />
                        <StreetAutocomplete
                          value={addr().street}
                          onChange={(street) => setAddr({ ...addr(), street })}
                          onPick={(s) => setAddr({ ...addr(), street: s.street, npa: s.npa, city: s.city, canton: s.canton || addr().canton })}
                          placeholder={t("checkout.addressSearch")}
                        />
                        <div class="grid grid-cols-[110px_1fr] gap-3">
                          <input
                            value={addr().npa}
                            onInput={(e) => setAddr({ ...addr(), npa: e.currentTarget.value })}
                            required
                            inputmode="numeric"
                            pattern="\d{4}"
                            title={t("checkout.errorNpa")}
                            autocomplete="postal-code"
                            placeholder={t("checkout.npa")}
                            class={field}
                          />
                          <input
                            value={addr().city}
                            onInput={(e) => setAddr({ ...addr(), city: e.currentTarget.value })}
                            required
                            autocomplete="address-level2"
                            placeholder={t("checkout.city")}
                            class={field}
                          />
                        </div>
                        <div class="grid grid-cols-2 gap-3">
                          <Select
                            value={addr().canton}
                            onChange={(canton) => setAddr({ ...addr(), canton })}
                            options={CANTONS.map(([code, name]) => ({ value: code, label: `${code} — ${name}` }))}
                            placeholder={t("checkout.canton")}
                            ariaLabel={t("checkout.canton")}
                          />
                          <input
                            value={t("checkout.countrySwiss")}
                            disabled
                            aria-label={t("checkout.country")}
                            class={`${field} cursor-not-allowed bg-paper text-soft`}
                          />
                        </div>
                      </div>
                    </div>

                    <Show when={error()}>
                      <p class="rounded-xl bg-accent/10 px-4 py-3 text-sm font-medium text-accent">{error()}</p>
                    </Show>

                    <div>
                      <button
                        type="submit"
                        disabled={submitting() || !emailReady()}
                        class="flex w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-3.5 text-sm font-semibold text-white transition-all hover:bg-accent-dark active:scale-[0.98] disabled:opacity-60"
                      >
                        {submitting() ? t("checkout.processing") : t("checkout.continueToPayment")}
                        <Show when={!submitting()}>
                          <ArrowRight size={16} />
                        </Show>
                      </button>
                      <Show when={!emailReady()}>
                        <p class="mt-2.5 text-center text-xs text-soft">{t("checkout.verifyToContinue")}</p>
                      </Show>
                    </div>

                    <A href={`/${locale()}/cart`} class="flex items-center justify-center gap-1.5 text-sm font-medium text-soft transition-colors hover:text-ink">
                      <ArrowLeft size={15} />
                      {t("checkout.back")}
                    </A>
                  </form>
                }
              >
                <PaymentStep
                  stripe={stripeInstance()!}
                  clientSecret={clientSecret()!}
                  totalAmount={(cart()?.item_subtotal ?? 0) - (cart()?.discount_total ?? 0) + (shippingAmount() ?? cart()?.shipping_total ?? 0)}
                  onBack={() => setClientSecret(null)}
                />
              </Show>
            </div>

            <aside class="order-1 lg:order-2 lg:sticky lg:top-24">
              <SummaryCard
                shippingAmount={shippingAmount()}
                editable={!clientSecret()}
                onApplyPromo={applyPromo}
                onRemovePromo={removePromo}
              />
            </aside>
          </div>
        </Show>
      </div>
    </div>
  );
}
