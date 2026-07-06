import { createSignal, createMemo, For, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { Check, CreditCard, ShoppingBag } from "lucide-solid";
import { useI18n } from "../i18n/context";
import { formatChfAmount } from "../lib/format";
import { useCart } from "../lib/cart";
import { FavoriteButton } from "./favorite-button";
import { useProductColor } from "./product-color-context";

interface Variant {
  id: string;
  title: string;
  priceAmount: number;
  outOfStock: boolean;
}

// Bloc d'achat de la fiche produit - miroir de product-purchase.tsx côté app
// Next.js. Sélection couleur/variante puis ajout au panier réel Medusa
// (metadata de ligne color_name/color_hex, cf. plan Phase 2 - déjà vérifié
// que ça se reporte tel quel sur la commande à la complétion).
export function ProductPurchase(props: {
  productId: string;
  handle: string;
  name: string;
  imageUrl: string | null;
  saleType: "stock" | "on_demand";
  productionDays: number | null;
  variants: Variant[];
}) {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const { addItem } = useCart();

  const [selectedId, setSelectedId] = createSignal<string | null>(props.variants[0]?.id ?? null);
  const selected = createMemo(() => props.variants.find((v) => v.id === selectedId()) ?? null);
  const showVariantPicker = props.variants.length > 1;

  const { colors, selectedId: colorId, setSelectedId: setColorId, selected: selectedColor } =
    useProductColor();

  const [added, setAdded] = createSignal(false);
  const soldOut = createMemo(() => props.saleType === "stock" && (selected()?.outOfStock ?? false));

  const favoriteItem = createMemo(() => ({
    productId: props.productId,
    name: props.name,
    slug: props.handle,
    priceCents: Math.round((props.variants[0]?.priceAmount ?? 0) * 100),
    imageUrl: props.imageUrl,
  }));

  const badgeClass = createMemo(() =>
    props.saleType === "stock"
      ? soldOut()
        ? "bg-red-500/15 text-red-600 dark:text-red-300"
        : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
      : "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  );

  async function handleAdd() {
    const variant = selected();
    if (!variant || soldOut()) return;
    const color = selectedColor();
    await addItem(variant.id, 1, color ? { color_name: color.name, color_hex: color.hex } : undefined);
    setAdded(true);
    setTimeout(() => setAdded(false), 1600);
  }

  async function handleBuyNow() {
    const variant = selected();
    if (!variant || soldOut()) return;
    const color = selectedColor();
    await addItem(variant.id, 1, color ? { color_name: color.name, color_hex: color.hex } : undefined);
    navigate(`/${locale()}/checkout`);
  }

  return (
    <div class="mt-5">
      <span class={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${badgeClass()}`}>
        {props.saleType === "stock"
          ? soldOut()
            ? t("product.outOfStock")
            : t("product.inStock")
          : t("product.onDemand", { days: props.productionDays ?? 3 })}
      </span>

      <p class="mt-3 text-2xl font-semibold tabular-nums">
        {formatChfAmount(selected()?.priceAmount ?? props.variants[0]?.priceAmount ?? 0, locale())}
      </p>

      <Show when={colors.length > 0}>
        <div class="mt-5">
          <p class="mb-2 text-sm font-semibold">
            {t("product.color")}
            <Show when={selectedColor()}>
              {(c) => <span class="ml-1.5 font-normal text-soft">· {c().name}</span>}
            </Show>
          </p>
          <div class="flex flex-wrap gap-2.5">
            <For each={colors}>
              {(c) => {
                const active = () => c.id === colorId();
                return (
                  <button
                    type="button"
                    onClick={() => setColorId(c.id)}
                    aria-pressed={active()}
                    aria-label={c.name}
                    title={c.name}
                    class={`h-9 w-9 rounded-full border transition-transform ${
                      active()
                        ? "border-ink ring-2 ring-ink ring-offset-2 ring-offset-paper"
                        : "border-swatch-ring hover:scale-110"
                    }`}
                    style={{ "background-color": c.hex }}
                  />
                );
              }}
            </For>
          </div>
        </div>
      </Show>

      <Show when={showVariantPicker}>
        <div class="mt-5">
          <p class="mb-2 text-sm font-semibold">{t("product.variant")}</p>
          <div class="flex flex-wrap gap-2">
            <For each={props.variants}>
              {(v) => {
                const active = () => v.id === selectedId();
                const vSoldOut = props.saleType === "stock" && v.outOfStock;
                return (
                  <button
                    type="button"
                    onClick={() => setSelectedId(v.id)}
                    aria-pressed={active()}
                    class={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                      active() ? "border-ink bg-ink text-paper" : "border-line bg-surface hover:border-ink"
                    } ${vSoldOut ? "opacity-50" : ""}`}
                  >
                    {v.title}
                    {vSoldOut ? ` · ${t("product.outOfStock")}` : ""}
                  </button>
                );
              }}
            </For>
          </div>
        </div>
      </Show>

      <div class="mt-8 space-y-3">
        <div class="flex items-stretch gap-3">
          <div class="flex-1">
            <Show
              when={!soldOut()}
              fallback={
                <button
                  disabled
                  class="flex w-full items-center justify-center gap-2 rounded-full bg-line px-6 py-3.5 text-sm font-semibold text-soft"
                >
                  {t("product.outOfStock")}
                </button>
              }
            >
              <button
                onClick={handleAdd}
                class={`flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold transition-all active:scale-[0.98] ${
                  added() ? "bg-ink text-paper" : "bg-accent text-white shadow-lg shadow-accent/25 hover:bg-accent-dark"
                }`}
              >
                {added() ? <Check size={18} /> : <ShoppingBag size={18} />}
                {added() ? t("product.added") : t("product.addToCart")}
              </button>
            </Show>
          </div>
          <FavoriteButton
            item={favoriteItem()}
            size={20}
            class="grid w-[50px] shrink-0 place-items-center rounded-full border border-line bg-surface hover:border-ink/30"
          />
        </div>
        <Show when={!soldOut()}>
          <button
            onClick={handleBuyNow}
            class="flex w-full items-center justify-center gap-2 rounded-full bg-ink px-6 py-3.5 text-sm font-semibold text-paper transition-all hover:bg-ink/85 active:scale-[0.98]"
          >
            <CreditCard size={18} />
            {t("product.buyNow")}
          </button>
        </Show>
      </div>
    </div>
  );
}
