import { For, Show, Suspense, createResource } from "solid-js";
import { A } from "@solidjs/router";
import { ArrowRight, Truck, Factory, ShieldCheck, Info } from "lucide-solid";
import { useI18n } from "../../i18n/context";
import { medusa } from "../../lib/medusa";
import { formatChfAmount } from "../../lib/format";
import { FREE_SHIPPING_OVER_CENTS } from "../../lib/shipping";
import { MulticolorDots } from "../../components/multicolor-dots";
import { ProductCard, type StoreProductSummary } from "../../components/product-card";

interface RawProduct {
  id: string;
  title: string;
  handle: string;
  thumbnail: string | null;
  metadata?: { featured?: boolean; featured_order?: number } | null;
  variants?: { calculated_price?: { calculated_amount?: number } | null }[];
}

async function fetchFeaturedProducts(): Promise<StoreProductSummary[]> {
  const { regions } = await medusa.store.region.list();
  const swiss = regions.find((r: { currency_code: string }) => r.currency_code === "chf") ?? regions[0];

  const { products } = (await medusa.store.product.list({
    region_id: swiss?.id,
    fields: "id,title,handle,thumbnail,metadata,*variants.calculated_price",
  })) as { products: RawProduct[] };

  return products
    .filter((p) => p.metadata?.featured)
    .sort((a, b) => (a.metadata?.featured_order ?? 0) - (b.metadata?.featured_order ?? 0))
    .map((p) => ({
      id: p.id,
      title: p.title,
      handle: p.handle,
      thumbnail: p.thumbnail,
      priceAmount: p.variants?.[0]?.calculated_price?.calculated_amount ?? null,
    }));
}

export default function HomePage() {
  const { t, locale } = useI18n();
  const [featured] = createResource(fetchFeaturedProducts);

  const trust = () => [
    {
      Icon: Truck,
      title: t("home.trustShippingTitle"),
      text: t("home.trustShippingText", { amount: formatChfAmount(FREE_SHIPPING_OVER_CENTS / 100, locale()) }),
    },
    { Icon: Factory, title: t("home.trustMadeTitle"), text: t("home.trustMadeText") },
    { Icon: ShieldCheck, title: t("home.trustPaymentTitle"), text: t("home.trustPaymentText") },
  ];

  const bars = [
    { color: "#e5231c", h: 55 },
    { color: "#1d4ed8", h: 70 },
    { color: "#f59e0b", h: 85 },
    { color: "#fafaf9", h: 100 },
  ];

  return (
    <div class="mx-auto max-w-6xl px-4 sm:px-6">
      {/* Hero — sans la scène 3D (Three.js) pour l'instant, cf. plan Phase 5 */}
      <section class="grid items-center gap-10 py-14 md:grid-cols-2 md:gap-14 md:py-24">
        <div>
          <span class="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs font-medium text-soft">
            <span class="h-1.5 w-1.5 rounded-full bg-accent" />
            {t("home.heroBadge")}
          </span>
          <h1 class="mt-6 text-[2.6rem] font-bold leading-[1.05] tracking-tight md:text-6xl">
            {t("home.heroTitle")}
          </h1>
          <p class="mt-5 max-w-md text-lg leading-relaxed text-soft">{t("home.heroSubtitle")}</p>
          <div class="mt-8 flex flex-wrap gap-3">
            <A
              href={`/${locale()}/shop`}
              class="flex items-center gap-2 rounded-full bg-accent px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-accent/25 transition-all hover:bg-accent-dark hover:shadow-accent/30 active:scale-[0.98]"
            >
              {t("home.ctaShop")}
              <ArrowRight size={16} />
            </A>
            <A
              href={`/${locale()}/custom`}
              class="flex items-center rounded-full border border-line bg-surface px-7 py-3.5 text-sm font-semibold transition-colors hover:border-ink"
            >
              {t("home.ctaCustom")}
            </A>
            <A
              href={`/${locale()}/a-propos`}
              class="flex items-center gap-2 rounded-full border border-line bg-surface px-7 py-3.5 text-sm font-semibold transition-colors hover:border-ink md:hidden"
            >
              <Info size={16} />
              {t("nav.about")}
            </A>
          </div>
        </div>
        <div class="relative flex min-h-[260px] items-center justify-center overflow-hidden rounded-card border border-line bg-gradient-to-br from-surface to-paper p-6 shadow-xl shadow-ink/[0.06] ring-1 ring-line/60 dark:shadow-black/40 md:min-h-[440px]">
          <div
            aria-hidden
            class="pointer-events-none absolute inset-0 opacity-70"
            style={{
              "background-image":
                "radial-gradient(60% 60% at 50% 42%, color-mix(in srgb, var(--accent) 8%, transparent), transparent 70%)",
            }}
          />
          <MulticolorDots size={28} />
        </div>
      </section>

      {/* Réassurance */}
      <section class="grid gap-3 border-t border-line py-10 sm:grid-cols-3 sm:gap-4">
        <For each={trust()}>
          {(item) => (
            <div class="flex items-start gap-3.5 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-soft/40">
              <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-paper ring-1 ring-line">
                <item.Icon size={19} stroke-width={1.8} class="text-accent" />
              </span>
              <div>
                <p class="text-sm font-semibold">{item.title}</p>
                <p class="mt-0.5 text-sm leading-snug text-soft">{item.text}</p>
              </div>
            </div>
          )}
        </For>
      </section>

      {/* Multicolore */}
      <section class="relative grid gap-8 overflow-hidden rounded-card bg-night p-8 text-white ring-1 ring-night-line md:grid-cols-[1.2fr_1fr] md:items-center md:p-14">
        <div
          aria-hidden
          class="pointer-events-none absolute -left-16 -top-16 h-64 w-64 rounded-full bg-accent/20 blur-3xl"
        />
        <div class="relative">
          <MulticolorDots size={12} onDark />
          <h2 class="mt-5 text-3xl font-bold tracking-tight md:text-4xl">{t("home.multicolorTitle")}</h2>
          <p class="mt-4 max-w-lg leading-relaxed text-night-soft">{t("home.multicolorText")}</p>
        </div>
        <div aria-hidden class="relative hidden h-44 items-end gap-3 md:flex">
          <For each={bars}>
            {(bar) => <span class="flex-1 rounded-t-xl" style={{ "background-color": bar.color, height: `${bar.h}%` }} />}
          </For>
        </div>
      </section>

      {/* Comment ça marche */}
      <section class="py-16">
        <span class="flex h-1 w-10 rounded-full bg-accent" />
        <h2 class="mt-3 text-2xl font-bold tracking-tight md:text-3xl">{t("home.processTitle")}</h2>
        <ol class="mt-8 grid gap-4 sm:grid-cols-3">
          <For each={[1, 2, 3] as const}>
            {(n) => (
              <li class="relative rounded-card border border-line bg-surface p-6">
                <span class="grid h-9 w-9 place-items-center rounded-xl bg-accent/10 text-base font-bold tabular-nums text-accent">
                  {n}
                </span>
                <p class="mt-4 font-semibold">{t(`home.processStep${n}Title`)}</p>
                <p class="mt-1.5 text-sm leading-relaxed text-soft">
                  {t(`home.processStep${n}Text`, { amount: formatChfAmount(FREE_SHIPPING_OVER_CENTS / 100, locale()) })}
                </p>
              </li>
            )}
          </For>
        </ol>
      </section>

      {/* Sélection du moment */}
      <section class="pb-16">
        <div class="mb-7 flex items-end justify-between gap-4">
          <div>
            <span class="flex h-1 w-10 rounded-full bg-accent" />
            <h2 class="mt-3 text-2xl font-bold tracking-tight md:text-3xl">{t("home.featuredTitle")}</h2>
          </div>
          <A
            href={`/${locale()}/shop`}
            class="flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold text-soft transition-colors hover:border-ink hover:text-ink"
          >
            {t("home.featuredAll")}
            <ArrowRight size={15} />
          </A>
        </div>
        <Suspense fallback={<p class="text-sm text-soft">{t("common.loading")}</p>}>
          <Show when={featured()}>
            <div class="grid grid-cols-2 gap-4 lg:grid-cols-3 lg:gap-6">
              <For each={featured()}>{(product) => <ProductCard product={product} />}</For>
            </div>
          </Show>
        </Suspense>
      </section>

      {/* Bandeau sur mesure */}
      <section class="mb-16 rounded-card border border-line bg-surface p-8 text-center md:p-12">
        <span class="mx-auto flex h-1 w-10 rounded-full bg-accent" />
        <h2 class="mt-4 text-2xl font-bold tracking-tight md:text-3xl">{t("home.customBandTitle")}</h2>
        <p class="mx-auto mt-3 max-w-xl leading-relaxed text-soft">{t("home.customBandText")}</p>
        <A
          href={`/${locale()}/custom`}
          class="mt-6 inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-accent/25 transition-all hover:bg-accent-dark active:scale-[0.98]"
        >
          {t("home.customBandCta")}
          <ArrowRight size={16} />
        </A>
      </section>
    </div>
  );
}
