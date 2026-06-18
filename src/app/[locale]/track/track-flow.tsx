"use client";

import { useState } from "react";
import {
  ArrowRight,
  MapPin,
  Package,
  Search,
  Truck,
  UserPlus,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { formatChf } from "@/lib/format";

const field =
  "w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm transition-colors placeholder:text-soft/60 focus:border-ink focus:outline-none";

// Mêmes teintes que l'espace compte — limité aux statuts d'une commande.
const statusStyle: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  paid: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  in_production: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  shipped: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  delivered: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  cancelled: "bg-red-500/15 text-red-600 dark:text-red-300",
};

function trackingUrl(n: string): string {
  return `https://service.post.ch/ekp-web/ui/entry/search/${encodeURIComponent(n)}`;
}

interface TrackResult {
  orderNumber: string;
  status: string;
  createdAt: string;
  subtotalCents: number;
  shippingCents: number;
  discountCents: number;
  discountCode: string | null;
  totalCents: number;
  trackingNumber: string | null;
  address: { name: string; street: string; npa: string; city: string; canton: string };
  items: {
    id: string;
    nameSnapshot: string;
    colorName: string | null;
    colorHex: string | null;
    priceCentsSnapshot: number;
    quantity: number;
  }[];
}

export function TrackFlow({ initialOrderNumber }: { initialOrderNumber: string }) {
  const t = useTranslations("track");
  const tStatus = useTranslations("account.status");
  const locale = useLocale();
  const [orderNumber, setOrderNumber] = useState(initialOrderNumber);
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TrackResult | null>(null);

  const ready = orderNumber.trim().length >= 3 && /^\S+@\S+\.\S+$/.test(email.trim());

  async function search() {
    if (!ready || pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/track-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderNumber: orderNumber.trim(),
          email: email.trim().toLowerCase(),
        }),
      });
      if (res.status === 404) {
        setResult(null);
        setError(t("notFound"));
        return;
      }
      if (!res.ok) throw new Error("track_failed");
      setResult((await res.json()) as TrackResult);
    } catch {
      setResult(null);
      setError(t("errorGeneric"));
    } finally {
      setPending(false);
    }
  }

  if (result) {
    return (
      <div className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold tracking-tight">
              {result.orderNumber}
            </h2>
            <p className="mt-1 text-sm text-soft">
              {t("placedOn", {
                date: new Date(result.createdAt).toLocaleDateString(`${locale}-CH`),
              })}
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyle[result.status] ?? "bg-line text-soft"}`}
          >
            {tStatus(result.status)}
          </span>
        </div>

        {result.trackingNumber && (
          <a
            href={trackingUrl(result.trackingNumber)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 flex items-center justify-between gap-3 rounded-card border border-line bg-surface px-5 py-4 transition-colors hover:border-ink"
          >
            <span className="flex items-center gap-2.5 text-sm">
              <Truck size={17} className="shrink-0 text-soft" />
              <span>
                <span className="font-semibold">{t("tracking")}</span>{" "}
                <span className="tabular-nums text-soft">
                  {result.trackingNumber}
                </span>
              </span>
            </span>
            <span className="shrink-0 text-sm font-semibold text-accent">
              {t("trackOrder")} →
            </span>
          </a>
        )}

        <section className="mt-6">
          <h3 className="flex items-center gap-2 font-semibold">
            <Package size={17} className="text-soft" />
            {t("items")}
          </h3>
          <ul className="mt-3 divide-y divide-line rounded-card border border-line bg-surface px-5">
            {result.items.map((i) => (
              <li
                key={i.id}
                className="flex items-center justify-between gap-3 py-4"
              >
                <span className="flex items-center gap-2 text-sm">
                  <span className="font-medium tabular-nums">{i.quantity}×</span>{" "}
                  {i.nameSnapshot}
                  {i.colorName && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-soft">
                      <span
                        className="h-3 w-3 shrink-0 rounded-full border border-swatch-ring"
                        style={{ backgroundColor: i.colorHex ?? undefined }}
                      />
                      {i.colorName}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-sm font-semibold tabular-nums">
                  {formatChf(i.priceCentsSnapshot * i.quantity, locale)}
                </span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-2 rounded-card border border-line bg-surface px-5 py-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-soft">{t("subtotal")}</dt>
              <dd className="tabular-nums">
                {formatChf(result.subtotalCents, locale)}
              </dd>
            </div>
            {result.discountCents > 0 && (
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                <dt>
                  {t("discount")}
                  {result.discountCode ? ` (${result.discountCode})` : ""}
                </dt>
                <dd className="tabular-nums">
                  −{formatChf(result.discountCents, locale)}
                </dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-soft">{t("shipping")}</dt>
              <dd className="tabular-nums">
                {result.shippingCents === 0
                  ? t("shippingFree")
                  : formatChf(result.shippingCents, locale)}
              </dd>
            </div>
            <div className="flex justify-between border-t border-line pt-2 text-base font-bold">
              <dt>{t("total")}</dt>
              <dd className="tabular-nums">
                {formatChf(result.totalCents, locale)}
              </dd>
            </div>
          </dl>
        </section>

        {result.address.name && (
          <section className="mt-6">
            <h3 className="flex items-center gap-2 font-semibold">
              <MapPin size={17} className="text-soft" />
              {t("shippingAddress")}
            </h3>
            <p className="mt-3 rounded-card border border-line bg-surface px-5 py-4 text-sm leading-relaxed text-soft">
              {result.address.name}
              <br />
              {result.address.street}
              <br />
              {result.address.npa} {result.address.city}
              {result.address.canton ? `, ${result.address.canton}` : ""}
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
          <label
            htmlFor="orderNumber"
            className="mb-1.5 block text-sm font-semibold"
          >
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

      {error && (
        <p className="mt-4 rounded-xl bg-accent/10 px-4 py-3 text-sm font-medium text-accent">
          {error}
        </p>
      )}

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
        <Link
          href="/account/login"
          className="inline-flex items-center gap-1 font-semibold text-accent hover:underline"
        >
          {t("loginLink")}
          <ArrowRight size={14} />
        </Link>
      </div>
    </form>
  );
}
