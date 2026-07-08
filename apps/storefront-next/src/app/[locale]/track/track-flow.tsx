"use client";

import { useState } from "react";
import { ArrowRight, MapPin, Package, Search, Truck, UserPlus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { medusa } from "@/lib/medusa";
import { formatChfAmount } from "@/lib/format";
import { orderStatusStyle } from "../account/(dashboard)/_ui";

const field =
  "w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm transition-colors placeholder:text-soft/60 focus:border-ink focus:outline-none";

function trackingUrl(n: string): string {
  return `https://service.post.ch/ekp-web/ui/entry/search/${encodeURIComponent(n)}`;
}

interface TrackResult {
  display_id: number;
  fulfillment_status: string;
  created_at: string;
  subtotal: number;
  discount_total: number;
  shipping_total: number;
  total: number;
  items: { id: string; title: string; quantity: number; unit_price: number; metadata: Record<string, unknown> | null }[];
  shipping_address: {
    first_name: string | null;
    last_name: string | null;
    address_1: string | null;
    postal_code: string | null;
    city: string | null;
    province: string | null;
  } | null;
  promotions?: { code: string }[];
  fulfillments?: { labels?: { tracking_number: string }[] }[] | null;
}

export function TrackFlow({ initialOrderNumber }: { initialOrderNumber: string }) {
  const t = useTranslations("track");
  const tStatus = useTranslations("account.orderStatus");
  const locale = useLocale();
  const [orderNumber, setOrderNumber] = useState(initialOrderNumber);
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TrackResult | null>(null);

  const ready = orderNumber.trim().length >= 1 && /^\S+@\S+\.\S+$/.test(email.trim());

  async function search() {
    if (!ready || pending) return;
    setPending(true);
    setError(null);
    try {
      // Le numéro affiché est préfixé "S3D-" (voir S3D-{display_id} plus bas) ;
      // on l'accepte tel quel ou sans préfixe.
      const cleaned = orderNumber.trim().replace(/^s3d-/i, "");
      const { order } = await medusa.client.fetch<{ order: TrackResult }>("/store/track-order", {
        method: "POST",
        body: { orderNumber: cleaned, email: email.trim().toLowerCase() },
      });
      setResult(order);
    } catch (e) {
      setResult(null);
      setError((e as { status?: number })?.status === 404 ? t("notFound") : t("errorGeneric"));
    } finally {
      setPending(false);
    }
  }

  if (result) {
    const trackingNumber = result.fulfillments?.[0]?.labels?.[0]?.tracking_number;
    const addr = result.shipping_address;
    const promoCode = result.promotions?.[0]?.code;

    return (
      <div className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold tracking-tight">S3D-{result.display_id}</h2>
            <p className="mt-1 text-sm text-soft">{t("placedOn", { date: new Date(result.created_at).toLocaleDateString(`${locale}-CH`) })}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${orderStatusStyle[result.fulfillment_status] ?? "bg-line text-soft"}`}>
            {tStatus(result.fulfillment_status)}
          </span>
        </div>

        {trackingNumber && (
          <a
            href={trackingUrl(trackingNumber)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 flex items-center justify-between gap-3 rounded-card border border-line bg-surface px-5 py-4 transition-colors hover:border-ink"
          >
            <span className="flex items-center gap-2.5 text-sm">
              <Truck size={17} className="shrink-0 text-soft" />
              <span>
                <span className="font-semibold">{t("tracking")}</span> <span className="tabular-nums text-soft">{trackingNumber}</span>
              </span>
            </span>
            <span className="shrink-0 text-sm font-semibold text-accent">{t("trackOrder")} →</span>
          </a>
        )}

        <section className="mt-6">
          <h3 className="flex items-center gap-2 font-semibold">
            <Package size={17} className="text-soft" />
            {t("items")}
          </h3>
          <ul className="mt-3 divide-y divide-line rounded-card border border-line bg-surface px-5">
            {result.items.map((i) => {
              const colorName = i.metadata?.color_name as string | undefined;
              const colorHex = i.metadata?.color_hex as string | undefined;
              return (
                <li key={i.id} className="flex items-center justify-between gap-3 py-4">
                  <span className="flex items-center gap-2 text-sm">
                    <span className="font-medium tabular-nums">{i.quantity}×</span> {i.title}
                    {colorName && (
                      <span className="inline-flex items-center gap-1.5 text-xs text-soft">
                        <span className="h-3 w-3 shrink-0 rounded-full border border-swatch-ring" style={{ backgroundColor: colorHex }} />
                        {colorName}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">{formatChfAmount(i.unit_price * i.quantity, locale)}</span>
                </li>
              );
            })}
          </ul>
          <dl className="mt-4 space-y-2 rounded-card border border-line bg-surface px-5 py-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-soft">{t("subtotal")}</dt>
              <dd className="tabular-nums">{formatChfAmount(result.subtotal, locale)}</dd>
            </div>
            {result.discount_total > 0 && (
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                <dt>
                  {t("discount")}
                  {promoCode ? ` (${promoCode})` : ""}
                </dt>
                <dd className="tabular-nums">−{formatChfAmount(result.discount_total, locale)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-soft">{t("shipping")}</dt>
              <dd className="tabular-nums">{result.shipping_total === 0 ? t("shippingFree") : formatChfAmount(result.shipping_total, locale)}</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-2 text-base font-bold">
              <dt>{t("total")}</dt>
              <dd className="tabular-nums">{formatChfAmount(result.total, locale)}</dd>
            </div>
          </dl>
        </section>

        {addr?.first_name && (
          <section className="mt-6">
            <h3 className="flex items-center gap-2 font-semibold">
              <MapPin size={17} className="text-soft" />
              {t("shippingAddress")}
            </h3>
            <p className="mt-3 rounded-card border border-line bg-surface px-5 py-4 text-sm leading-relaxed text-soft">
              {addr.first_name} {addr.last_name}
              <br />
              {addr.address_1}
              <br />
              {addr.postal_code} {addr.city}
              {addr.province ? `, ${addr.province}` : ""}
              <br />
              CH
            </p>
          </section>
        )}

        <div className="mt-7 rounded-card border border-line bg-surface p-5 text-center">
          <p className="text-sm text-soft">{t("createAccountPrompt")}</p>
          <Link
            href="/account/register"
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 text-sm font-semibold text-paper transition-opacity hover:opacity-90"
          >
            <UserPlus size={16} />
            {t("createAccountCta")}
          </Link>
        </div>

        <button
          type="button"
          onClick={() => {
            setResult(null);
            setError(null);
          }}
          className="mt-5 flex w-full items-center justify-center gap-1.5 text-sm font-medium text-soft transition-colors hover:text-ink"
        >
          {t("searchAgain")}
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        search();
      }}
      className="mt-8 rounded-card border border-line bg-surface p-6 sm:p-8"
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="orderNumber" className="mb-1.5 block text-sm font-semibold">
            {t("orderNumber")}
          </label>
          <input
            id="orderNumber"
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            required
            autoComplete="off"
            placeholder={t("orderNumberPlaceholder")}
            className={`${field} uppercase placeholder:normal-case`}
          />
        </div>
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-semibold">
            {t("email")}
          </label>
          <input
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
            autoComplete="email"
            placeholder={t("emailPlaceholder")}
            className={field}
          />
        </div>
      </div>

      {error && <p className="mt-4 rounded-xl bg-accent/10 px-4 py-3 text-sm font-medium text-accent">{error}</p>}

      <button
        type="submit"
        disabled={!ready || pending}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-3.5 text-sm font-semibold text-white transition-all hover:bg-accent-dark active:scale-[0.98] disabled:opacity-60"
      >
        {pending ? (
          t("searching")
        ) : (
          <>
            <Search size={16} />
            {t("submit")}
          </>
        )}
      </button>

      <p className="mt-4 text-center text-xs text-soft">{t("hint")}</p>

      <div className="mt-5 flex items-center justify-center gap-1.5 border-t border-line pt-5 text-sm text-soft">
        {t("haveAccountPrompt")}{" "}
        <Link href="/account/login" className="inline-flex items-center gap-1 font-semibold text-accent hover:underline">
          {t("loginLink")}
          <ArrowRight size={14} />
        </Link>
      </div>
    </form>
  );
}
