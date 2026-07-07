"use client";

import { Minus, Plus, ShoppingBag, Trash2, ArrowRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useCart } from "@/lib/cart";
import { formatChfAmount } from "@/lib/format";
import { estimateShippingAmount, FREE_SHIPPING_OVER_AMOUNT } from "@/lib/shipping";
import { PageHeader } from "@/components/page-header";

// Miroir de src/app/[locale]/cart/page.tsx côté app Next.js racine, adapté
// au panier réel Medusa (montants décimaux, ligne de panier server-side).
export default function CartPage() {
  const t = useTranslations("cart");
  const locale = useLocale();
  const { cart, loading, updateItem, removeItem } = useCart();

  const items = cart?.items ?? [];
  const subtotal = cart?.item_subtotal ?? 0;
  const shipping = estimateShippingAmount(subtotal);
  const total = subtotal + shipping;
  const remainingForFree = FREE_SHIPPING_OVER_AMOUNT - subtotal;

  if (loading) {
    return <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6" />;
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-24 text-center sm:px-6">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-surface ring-1 ring-line">
          <ShoppingBag size={26} strokeWidth={1.6} className="text-soft" />
        </span>
        <h1 className="mt-6 text-2xl font-bold">{t("title")}</h1>
        <p className="mt-2 text-soft">{t("empty")}</p>
        <Link
          href="/shop"
          className="mt-7 inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-accent/25 transition-all hover:bg-accent-dark active:scale-[0.98]"
        >
          {t("emptyCta")}
          <ArrowRight size={16} />
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 md:py-16">
      <PageHeader title={t("title")} />

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px] lg:items-start">
        <ul className="divide-y divide-line rounded-card border border-line bg-surface px-5">
          {items.map((item: {
            id: string;
            title: string;
            product_title?: string | null;
            product_handle?: string | null;
            variant_title?: string | null;
            thumbnail?: string | null;
            quantity: number;
            unit_price: number;
            metadata?: Record<string, unknown> | null;
          }) => {
            const colorName = item.metadata?.color_name as string | undefined;
            const colorHex = item.metadata?.color_hex as string | undefined;
            const variantLabel = item.variant_title === "Default variant" ? null : item.variant_title;
            return (
              <li key={item.id} className="flex gap-4 py-5">
                <Link
                  href={`/products/${item.product_handle}`}
                  className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-paper to-line/40"
                >
                  {item.thumbnail && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.thumbnail} alt={item.product_title ?? item.title} className="h-full w-full object-cover" />
                  )}
                </Link>
                <div className="flex flex-1 flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/products/${item.product_handle}`} className="font-semibold leading-snug hover:underline">
                        {item.product_title ?? item.title}
                      </Link>
                      {variantLabel && <p className="text-xs text-soft">{variantLabel}</p>}
                      {colorName && (
                        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-soft">
                          <span className="h-3 w-3 shrink-0 rounded-full border border-swatch-ring" style={{ backgroundColor: colorHex }} />
                          {colorName}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => removeItem(item.id)}
                      aria-label={t("remove")}
                      className="rounded-full p-1.5 text-soft transition-colors hover:bg-line/60 hover:text-accent"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="mt-auto flex items-center justify-between pt-3">
                    <div className="flex items-center gap-1 rounded-full border border-line">
                      <button
                        onClick={() => updateItem(item.id, item.quantity - 1)}
                        disabled={item.quantity <= 1}
                        aria-label={t("decrease")}
                        className="grid h-8 w-8 place-items-center rounded-full transition-colors hover:bg-line/60 disabled:opacity-40"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="w-6 text-center text-sm font-semibold tabular-nums">{item.quantity}</span>
                      <button
                        onClick={() => updateItem(item.id, item.quantity + 1)}
                        aria-label={t("increase")}
                        className="grid h-8 w-8 place-items-center rounded-full transition-colors hover:bg-line/60"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <p className="font-semibold tabular-nums">{formatChfAmount(item.unit_price * item.quantity, locale)}</p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <aside className="rounded-card border border-line bg-surface p-6 lg:sticky lg:top-24">
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-soft">{t("subtotal")}</dt>
              <dd className="font-medium tabular-nums">{formatChfAmount(subtotal, locale)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-soft">{t("shipping")}</dt>
              <dd className="font-medium tabular-nums">
                {shipping === 0 ? (
                  <span className="text-emerald-600 dark:text-emerald-400">{t("shippingFree")}</span>
                ) : (
                  formatChfAmount(shipping, locale)
                )}
              </dd>
            </div>
            <div className="flex justify-between border-t border-line pt-3 text-base font-bold">
              <dt>{t("total")}</dt>
              <dd className="tabular-nums">{formatChfAmount(total, locale)}</dd>
            </div>
          </dl>

          <div className="mt-4 rounded-xl bg-paper px-4 py-3">
            <div className="h-1.5 overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-500"
                style={{ width: `${Math.min(100, Math.round((subtotal / FREE_SHIPPING_OVER_AMOUNT) * 100))}%` }}
              />
            </div>
            <p className="mt-2 text-xs font-medium text-soft">
              {remainingForFree > 0 ? t("freeShippingHint", { amount: formatChfAmount(remainingForFree, locale) }) : t("freeShippingReached")}
            </p>
          </div>

          <Link
            href="/checkout"
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-accent/25 transition-all hover:bg-accent-dark active:scale-[0.98]"
          >
            {t("checkout")}
            <ArrowRight size={16} />
          </Link>
        </aside>
      </div>
    </div>
  );
}
