import { For, Show } from "solid-js";
import { A } from "@solidjs/router";
import { Minus, Plus, ShoppingBag, Trash2, ArrowRight } from "lucide-solid";
import { useI18n } from "../../i18n/context";
import { useCart } from "../../lib/cart";
import { formatChfAmount } from "../../lib/format";
import { estimateShippingAmount, FREE_SHIPPING_OVER_AMOUNT } from "../../lib/shipping";
import { PageHeader } from "../../components/page-header";

export default function CartPage() {
  const { t, locale } = useI18n();
  const { cart, loading, updateItem, removeItem } = useCart();

  const items = () => cart()?.items ?? [];
  const subtotal = () => cart()?.item_subtotal ?? 0;
  const shipping = () => estimateShippingAmount(subtotal());
  const total = () => subtotal() + shipping();
  const remainingForFree = () => FREE_SHIPPING_OVER_AMOUNT - subtotal();

  return (
    <Show when={!loading()} fallback={<div class="mx-auto max-w-6xl px-4 py-24" />}>
      <Show
        when={items().length > 0}
        fallback={
          <div class="mx-auto max-w-6xl px-4 py-24 text-center sm:px-6">
            <span class="mx-auto grid h-16 w-16 place-items-center rounded-full bg-surface ring-1 ring-line">
              <ShoppingBag size={26} stroke-width={1.6} class="text-soft" />
            </span>
            <h1 class="mt-6 text-2xl font-bold">{t("cart.title")}</h1>
            <p class="mt-2 text-soft">{t("cart.empty")}</p>
            <A
              href={`/${locale()}/shop`}
              class="mt-7 inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-accent/25 transition-all hover:bg-accent-dark active:scale-[0.98]"
            >
              {t("cart.emptyCta")}
              <ArrowRight size={16} />
            </A>
          </div>
        }
      >
      <div class="mx-auto max-w-6xl px-4 py-10 sm:px-6 md:py-16">
        <PageHeader title={t("cart.title")} />

        <div class="mt-8 grid gap-8 lg:grid-cols-[1fr_360px] lg:items-start">
          <ul class="divide-y divide-line rounded-card border border-line bg-surface px-5">
            <For each={items()}>
              {(item) => {
                const colorName = item.metadata?.color_name as string | undefined;
                const colorHex = item.metadata?.color_hex as string | undefined;
                const variantLabel = item.variant_title === "Default variant" ? null : item.variant_title;
                return (
                  <li class="flex gap-4 py-5">
                    <A
                      href={`/${locale()}/products/${item.product_handle}`}
                      class="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-paper to-line/40"
                    >
                      <Show when={item.thumbnail}>
                        <img src={item.thumbnail!} alt={item.product_title ?? item.title} class="h-full w-full object-cover" />
                      </Show>
                    </A>
                    <div class="flex flex-1 flex-col">
                      <div class="flex items-start justify-between gap-3">
                        <div class="min-w-0">
                          <A
                            href={`/${locale()}/products/${item.product_handle}`}
                            class="font-semibold leading-snug hover:underline"
                          >
                            {item.product_title ?? item.title}
                          </A>
                          <Show when={variantLabel}>
                            <p class="text-xs text-soft">{variantLabel}</p>
                          </Show>
                          <Show when={colorName}>
                            <p class="mt-0.5 flex items-center gap-1.5 text-xs text-soft">
                              <span
                                class="h-3 w-3 shrink-0 rounded-full border border-swatch-ring"
                                style={{ "background-color": colorHex }}
                              />
                              {colorName}
                            </p>
                          </Show>
                        </div>
                        <button
                          onClick={() => removeItem(item.id)}
                          aria-label={t("cart.remove")}
                          class="rounded-full p-1.5 text-soft transition-colors hover:bg-line/60 hover:text-accent"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div class="mt-auto flex items-center justify-between pt-3">
                        <div class="flex items-center gap-1 rounded-full border border-line">
                          <button
                            onClick={() => updateItem(item.id, item.quantity - 1)}
                            disabled={item.quantity <= 1}
                            aria-label={t("cart.decrease")}
                            class="grid h-8 w-8 place-items-center rounded-full transition-colors hover:bg-line/60 disabled:opacity-40"
                          >
                            <Minus size={14} />
                          </button>
                          <span class="w-6 text-center text-sm font-semibold tabular-nums">{item.quantity}</span>
                          <button
                            onClick={() => updateItem(item.id, item.quantity + 1)}
                            aria-label={t("cart.increase")}
                            class="grid h-8 w-8 place-items-center rounded-full transition-colors hover:bg-line/60"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                        <p class="font-semibold tabular-nums">
                          {formatChfAmount(item.unit_price * item.quantity, locale())}
                        </p>
                      </div>
                    </div>
                  </li>
                );
              }}
            </For>
          </ul>

          <aside class="rounded-card border border-line bg-surface p-6 lg:sticky lg:top-24">
            <dl class="space-y-3 text-sm">
              <div class="flex justify-between">
                <dt class="text-soft">{t("cart.subtotal")}</dt>
                <dd class="font-medium tabular-nums">{formatChfAmount(subtotal(), locale())}</dd>
              </div>
              <div class="flex justify-between">
                <dt class="text-soft">{t("cart.shipping")}</dt>
                <dd class="font-medium tabular-nums">
                  <Show when={shipping() === 0} fallback={formatChfAmount(shipping(), locale())}>
                    <span class="text-emerald-600 dark:text-emerald-400">{t("cart.shippingFree")}</span>
                  </Show>
                </dd>
              </div>
              <div class="flex justify-between border-t border-line pt-3 text-base font-bold">
                <dt>{t("cart.total")}</dt>
                <dd class="tabular-nums">{formatChfAmount(total(), locale())}</dd>
              </div>
            </dl>

            <div class="mt-4 rounded-xl bg-paper px-4 py-3">
              <div class="h-1.5 overflow-hidden rounded-full bg-line">
                <div
                  class="h-full rounded-full bg-accent transition-[width] duration-500"
                  style={{ width: `${Math.min(100, Math.round((subtotal() / FREE_SHIPPING_OVER_AMOUNT) * 100))}%` }}
                />
              </div>
              <p class="mt-2 text-xs font-medium text-soft">
                {remainingForFree() > 0
                  ? t("cart.freeShippingHint", { amount: formatChfAmount(remainingForFree(), locale()) })
                  : t("cart.freeShippingReached")}
              </p>
            </div>

            <A
              href={`/${locale()}/checkout`}
              class="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-accent/25 transition-all hover:bg-accent-dark active:scale-[0.98]"
            >
              {t("cart.checkout")}
              <ArrowRight size={16} />
            </A>
          </aside>
        </div>
      </div>
      </Show>
    </Show>
  );
}
