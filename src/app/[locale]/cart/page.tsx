"use client";

import { Minus, Plus, ShoppingBag, Trash2, ArrowRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useCart } from "@/lib/cart";
import { formatChf } from "@/lib/format";
import { shippingFor, FREE_SHIPPING_OVER_CENTS } from "@/lib/shipping";

export default function CartPage() {
  const t = useTranslations("cart");
  const locale = useLocale();
  const { items, subtotalCents, setQuantity, remove } = useCart();

  const shippingCents = shippingFor(subtotalCents);
  const totalCents = subtotalCents + shippingCents;
  const remainingForFree = FREE_SHIPPING_OVER_CENTS - subtotalCents;

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
      <span className="flex h-1 w-10 rounded-full bg-accent" />
      <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
        {t("title")}
      </h1>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px] lg:items-start">
        <ul className="divide-y divide-line rounded-card border border-line bg-surface px-5">
          {items.map((item) => (
            <li
              key={`${item.productId}:${item.variantId ?? ""}:${item.colorName ?? ""}`}
              className="flex gap-4 py-5"
            >
              <Link
                href={`/products/${item.slug}`}
                className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-paper to-line/40"
              >
                {item.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="h-full w-full object-cover"
                  />
                )}
              </Link>
              <div className="flex flex-1 flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/products/${item.slug}`}
                      className="font-semibold leading-snug hover:underline"
                    >
                      {item.name}
                    </Link>
                    {item.variantName && (
                      <p className="text-xs text-soft">{item.variantName}</p>
                    )}
                    {item.colorName && (
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-soft">
                        <span
                          className="h-3 w-3 shrink-0 rounded-full border border-black/10"
                          style={{ backgroundColor: item.colorHex ?? undefined }}
                        />
                        {item.colorName}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() =>
                      remove(
                        item.productId,
                        item.variantId ?? null,
                        item.colorName ?? null,
                      )
                    }
                    aria-label={t("remove")}
                    className="rounded-full p-1.5 text-soft transition-colors hover:bg-line/60 hover:text-accent"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="mt-auto flex items-center justify-between pt-3">
                  <div className="flex items-center gap-1 rounded-full border border-line">
                    <button
                      onClick={() =>
                        setQuantity(
                          item.productId,
                          item.variantId ?? null,
                          item.colorName ?? null,
                          item.quantity - 1,
                        )
                      }
                      aria-label={t("decrease")}
                      className="grid h-8 w-8 place-items-center rounded-full transition-colors hover:bg-line/60"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="w-6 text-center text-sm font-semibold tabular-nums">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() =>
                        setQuantity(
                          item.productId,
                          item.variantId ?? null,
                          item.colorName ?? null,
                          item.quantity + 1,
                        )
                      }
                      aria-label={t("increase")}
                      className="grid h-8 w-8 place-items-center rounded-full transition-colors hover:bg-line/60"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  <p className="font-semibold tabular-nums">
                    {formatChf(item.priceCents * item.quantity, locale)}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <aside className="rounded-card border border-line bg-surface p-6">
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-soft">{t("subtotal")}</dt>
              <dd className="font-medium tabular-nums">
                {formatChf(subtotalCents, locale)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-soft">{t("shipping")}</dt>
              <dd className="font-medium tabular-nums">
                {shippingCents === 0 ? (
                  <span className="text-emerald-600 dark:text-emerald-400">
                    {t("shippingFree")}
                  </span>
                ) : (
                  formatChf(shippingCents, locale)
                )}
              </dd>
            </div>
            <div className="flex justify-between border-t border-line pt-3 text-base font-bold">
              <dt>{t("total")}</dt>
              <dd className="tabular-nums">{formatChf(totalCents, locale)}</dd>
            </div>
          </dl>

          <p className="mt-4 rounded-xl bg-paper px-4 py-3 text-xs font-medium text-soft">
            {remainingForFree > 0
              ? t("freeShippingHint", {
                  amount: formatChf(remainingForFree, locale),
                })
              : t("freeShippingReached")}
          </p>

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
