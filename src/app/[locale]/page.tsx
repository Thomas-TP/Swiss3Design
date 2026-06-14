import { ArrowRight, Truck, Factory, ShieldCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getProducts } from "@/db/queries";
import { formatChf } from "@/lib/format";
import { FREE_SHIPPING_OVER_CENTS } from "@/lib/shipping";
import { ProductCard } from "@/components/product-card";
import { MulticolorDots } from "@/components/multicolor-dots";
import { Reveal } from "@/components/reveal";

export const dynamic = "force-dynamic";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const [t, featured] = await Promise.all([
    getTranslations("home"),
    getProducts(locale, { featuredOnly: true }),
  ]);

  const trust = [
    {
      Icon: Truck,
      title: t("trustShippingTitle"),
      text: t("trustShippingText", {
        amount: formatChf(FREE_SHIPPING_OVER_CENTS, locale),
      }),
    },
    { Icon: Factory, title: t("trustMadeTitle"), text: t("trustMadeText") },
    {
      Icon: ShieldCheck,
      title: t("trustPaymentTitle"),
      text: t("trustPaymentText"),
    },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      {/* Hero */}
      <section className="grid items-center gap-10 py-14 md:grid-cols-2 md:py-24">
        <div>
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs font-medium text-soft">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              {t("heroBadge")}
            </span>
          </Reveal>
          <Reveal delay={0.08}>
            <h1 className="mt-5 text-4xl font-bold leading-[1.08] tracking-tight md:text-6xl">
              {t("heroTitle")}
            </h1>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-soft">
              {t("heroSubtitle")}
            </p>
          </Reveal>
          <Reveal delay={0.24}>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/shop"
                className="flex items-center gap-2 rounded-full bg-accent px-7 py-3.5 text-sm font-semibold text-white transition-all hover:bg-accent-dark active:scale-[0.98]"
              >
                {t("ctaShop")}
                <ArrowRight size={16} />
              </Link>
              <Link
                href="/custom"
                className="flex items-center rounded-full border border-line bg-surface px-7 py-3.5 text-sm font-semibold transition-colors hover:border-ink"
              >
                {t("ctaCustom")}
              </Link>
            </div>
          </Reveal>
        </div>
        <Reveal delay={0.15} className="hidden md:block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/hero.svg"
            alt=""
            className="w-full rounded-card border border-line"
          />
        </Reveal>
      </section>

      {/* Réassurance */}
      <section className="grid gap-4 border-t border-line py-10 sm:grid-cols-3">
        {trust.map(({ Icon, title, text }) => (
          <div key={title} className="flex items-start gap-3.5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface ring-1 ring-line">
              <Icon size={19} strokeWidth={1.8} className="text-ink" />
            </span>
            <div>
              <p className="text-sm font-semibold">{title}</p>
              <p className="mt-0.5 text-sm leading-snug text-soft">{text}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Multicolore */}
      <Reveal inView>
        <section className="grid gap-8 rounded-card bg-ink p-8 text-white md:grid-cols-[1.2fr_1fr] md:items-center md:p-14">
          <div>
            <MulticolorDots size={12} />
            <h2 className="mt-5 text-3xl font-bold tracking-tight md:text-4xl">
              {t("multicolorTitle")}
            </h2>
            <p className="mt-4 max-w-lg leading-relaxed text-white/70">
              {t("multicolorText")}
            </p>
          </div>
          <div
            aria-hidden
            className="hidden h-44 items-end gap-3 md:flex"
          >
            {["#e5231c", "#1d4ed8", "#f59e0b", "#fafaf9"].map((c, i) => (
              <span
                key={c}
                className="flex-1 rounded-t-xl"
                style={{ backgroundColor: c, height: `${55 + i * 15}%` }}
              />
            ))}
          </div>
        </section>
      </Reveal>

      {/* Sélection */}
      <section className="py-16">
        <div className="mb-7 flex items-end justify-between">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
            {t("featuredTitle")}
          </h2>
          <Link
            href="/shop"
            className="flex items-center gap-1.5 text-sm font-semibold text-soft transition-colors hover:text-ink"
          >
            {t("featuredAll")}
            <ArrowRight size={15} />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 lg:gap-6">
          {featured.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>
    </div>
  );
}
