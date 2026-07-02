import { ArrowRight, Truck, Factory, ShieldCheck, Info } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getProducts } from "@/db/queries";
import { formatChf } from "@/lib/format";
import { FREE_SHIPPING_OVER_CENTS } from "@/lib/shipping";
import { ProductCard } from "@/components/product-card";
import { MulticolorDots } from "@/components/multicolor-dots";
import { HeroScene } from "@/components/hero-scene";
import { Reveal } from "@/components/reveal";
import type { Metadata } from "next";
import { alternatesFor } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: alternatesFor(locale, "") };
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const [t, tNav, featured] = await Promise.all([
    getTranslations("home"),
    getTranslations("nav"),
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
      <section className="grid items-center gap-10 py-14 md:grid-cols-2 md:gap-14 md:py-24">
        <div>
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs font-medium text-soft">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              {t("heroBadge")}
            </span>
          </Reveal>
          <Reveal delay={0.08}>
            <h1 className="mt-6 text-[2.6rem] font-bold leading-[1.05] tracking-tight md:text-6xl">
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
                className="flex items-center gap-2 rounded-full bg-accent px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-accent/25 transition-all hover:bg-accent-dark hover:shadow-accent/30 active:scale-[0.98]"
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
              {/* « À propos » — mobile uniquement (sur PC il reste dans la navbar) */}
              <Link
                href="/a-propos"
                className="flex items-center gap-2 rounded-full border border-line bg-surface px-7 py-3.5 text-sm font-semibold transition-colors hover:border-ink md:hidden"
              >
                <Info size={16} />
                {tNav("about")}
              </Link>
            </div>
          </Reveal>
        </div>
        <Reveal delay={0.15}>
          {/* Scène d'impression animée — thémée, fini le pavé clair figé */}
          <div className="relative flex items-center justify-center overflow-hidden rounded-card border border-line bg-gradient-to-br from-surface to-paper p-4 shadow-xl shadow-ink/[0.06] ring-1 ring-line/60 dark:shadow-black/40 sm:p-6 md:min-h-[440px]">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-70"
              style={{
                backgroundImage:
                  "radial-gradient(60% 60% at 50% 42%, color-mix(in srgb, var(--color-accent) 8%, transparent), transparent 70%)",
              }}
            />
            <HeroScene className="relative w-full" />
          </div>
        </Reveal>
      </section>

      {/* Réassurance */}
      <section className="grid gap-3 border-t border-line py-10 sm:grid-cols-3 sm:gap-4">
        {trust.map(({ Icon, title, text }) => (
          <div
            key={title}
            className="flex items-start gap-3.5 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-soft/40"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-paper ring-1 ring-line">
              <Icon size={19} strokeWidth={1.8} className="text-accent" />
            </span>
            <div>
              <p className="text-sm font-semibold">{title}</p>
              <p className="mt-0.5 text-sm leading-snug text-soft">{text}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Multicolore — panneau « nuit » constant (lisible dans les deux thèmes) */}
      <Reveal inView>
        <section className="relative grid gap-8 overflow-hidden rounded-card bg-night p-8 text-white ring-1 ring-night-line md:grid-cols-[1.2fr_1fr] md:items-center md:p-14">
          {/* Lueur d'accent discrète */}
          <div
            aria-hidden
            className="pointer-events-none absolute -left-16 -top-16 h-64 w-64 rounded-full bg-accent/20 blur-3xl"
          />
          <div className="relative">
            <MulticolorDots size={12} onDark />
            <h2 className="mt-5 text-3xl font-bold tracking-tight md:text-4xl">
              {t("multicolorTitle")}
            </h2>
            <p className="mt-4 max-w-lg leading-relaxed text-night-soft">
              {t("multicolorText")}
            </p>
          </div>
          <div aria-hidden className="relative hidden h-44 items-end gap-3 md:flex">
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

      {/* Comment ça marche — 3 étapes numérotées, du choix à la livraison */}
      <Reveal inView>
        <section className="py-16">
          <span className="flex h-1 w-10 rounded-full bg-accent" />
          <h2 className="mt-3 text-2xl font-bold tracking-tight md:text-3xl">
            {t("processTitle")}
          </h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-3">
            {([1, 2, 3] as const).map((n) => (
              <li
                key={n}
                className="relative rounded-card border border-line bg-surface p-6"
              >
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent/10 text-base font-bold tabular-nums text-accent">
                  {n}
                </span>
                <p className="mt-4 font-semibold">{t(`processStep${n}Title`)}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-soft">
                  {t(`processStep${n}Text`, {
                    amount: formatChf(FREE_SHIPPING_OVER_CENTS, locale),
                  })}
                </p>
              </li>
            ))}
          </ol>
        </section>
      </Reveal>

      {/* Sélection */}
      <section className="pb-16">
        <div className="mb-7 flex items-end justify-between gap-4">
          <div>
            <span className="flex h-1 w-10 rounded-full bg-accent" />
            <h2 className="mt-3 text-2xl font-bold tracking-tight md:text-3xl">
              {t("featuredTitle")}
            </h2>
          </div>
          <Link
            href="/shop"
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold text-soft transition-colors hover:border-ink hover:text-ink"
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

      {/* Bandeau sur mesure — dernier appel avant le footer */}
      <Reveal inView>
        <section className="mb-16 rounded-card border border-line bg-surface p-8 text-center md:p-12">
          <span className="mx-auto flex h-1 w-10 rounded-full bg-accent" />
          <h2 className="mt-4 text-2xl font-bold tracking-tight md:text-3xl">
            {t("customBandTitle")}
          </h2>
          <p className="mx-auto mt-3 max-w-xl leading-relaxed text-soft">
            {t("customBandText")}
          </p>
          <Link
            href="/custom"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-accent/25 transition-all hover:bg-accent-dark active:scale-[0.98]"
          >
            {t("customBandCta")}
            <ArrowRight size={16} />
          </Link>
        </section>
      </Reveal>
    </div>
  );
}
