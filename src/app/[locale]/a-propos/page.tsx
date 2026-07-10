import type { Metadata } from "next";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Lock,
  Mail,
  MapPin,
  Printer,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { Reveal } from "@/components/reveal";
import { ContactForm } from "./contact-form";
import { ABOUT_CONTENT } from "./about-content";
import { AboutNav } from "./about-nav";

const CONTACT_EMAIL = "contact@swiss3design.ch";
const TRUST_ICONS = [MapPin, ShieldCheck, Lock, Truck] as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const c = ABOUT_CONTENT[locale] ?? ABOUT_CONTENT.fr;
  return {
    title: c.metaTitle,
    description: c.metaDescription,
    openGraph: {
      title: c.metaTitle,
      description: c.metaDescription,
      type: "website",
    },
  };
}

function SectionHeading({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="mb-8">
      <span className="flex h-1 w-10 rounded-full bg-accent" />
      <p className="mt-3 text-sm font-semibold uppercase tracking-wide text-accent">
        {kicker}
      </p>
      <h2 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">
        {title}
      </h2>
    </div>
  );
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const c = ABOUT_CONTENT[locale] ?? ABOUT_CONTENT.fr;
  const t = await getTranslations("contact");

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6">
      {/* Hero */}
      <section className="py-14 md:py-20">
        <Reveal>
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs font-medium text-soft">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            {c.badge}
          </span>
        </Reveal>
        <Reveal delay={0.08}>
          <h1 className="mt-6 max-w-3xl text-[2.3rem] font-bold leading-[1.08] tracking-tight md:text-5xl">
            {c.title}
          </h1>
        </Reveal>
        <Reveal delay={0.16}>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-soft">
            {c.intro}
          </p>
        </Reveal>
      </section>

      {/* Chiffres clés */}
      <Reveal inView>
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {c.stats.map((s) => (
            <div
              key={s.label}
              className="rounded-2xl border border-line bg-surface p-5 text-center"
            >
              <p className="text-2xl font-bold tracking-tight text-ink md:text-3xl">
                {s.value}
              </p>
              <p className="mt-1 text-xs leading-snug text-soft">{s.label}</p>
            </div>
          ))}
        </section>
      </Reveal>

      {/* Navigation rapide : reste visible au défilement, met en avant la
          section lue (voir about-nav.tsx). Page volontairement longue et
          complète — cette barre en est le sommaire, pas un raccourci qui
          en retire le contenu. */}
      <div className="mt-10">
        <AboutNav
          items={[
            { id: "equipment", label: c.equipmentKicker },
            { id: "process", label: c.processKicker },
            { id: "materials", label: c.materialsKicker },
            { id: "trust", label: c.trustKicker },
            { id: "faq", label: c.faqKicker },
            { id: "contact", label: c.contactKicker },
          ]}
        />
      </div>

      {/* Notre matériel */}
      <section id="equipment" className="scroll-mt-32 py-16 md:py-20">
        <Reveal inView>
          <SectionHeading kicker={c.equipmentKicker} title={c.equipmentTitle} />
        </Reveal>
        <div className="grid gap-8 md:grid-cols-2 md:gap-10 md:items-start">
          <Reveal inView>
            <figure className="overflow-hidden rounded-card border border-line bg-white shadow-sm shadow-ink/[0.06] dark:shadow-black/30">
              {/* Photo produit officielle Bambu Lab, recadrée (badge promo retiré).
                  Remplaçable par une vraie photo de l'atelier : déposer le fichier
                  dans public/about/ et adapter le src. */}
              <img
                src="/about/p1s-ams2-pro.jpg"
                alt={c.equipmentTitle}
                width={1340}
                height={1420}
                loading="lazy"
                className="block h-auto w-full"
              />
            </figure>
          </Reveal>
          <Reveal inView delay={0.1}>
            <p className="text-[15px] leading-relaxed text-soft">
              {c.equipmentText}
            </p>
            <div className="mt-6 rounded-card border border-line bg-elevated p-6 shadow-sm shadow-ink/[0.04]">
              <div className="mb-4 flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-paper ring-1 ring-line">
                  <Printer
                    size={19}
                    strokeWidth={1.8}
                    className="text-accent"
                  />
                </span>
                <div>
                  <p className="text-sm font-semibold">Bambu Lab P1S</p>
                  <p className="text-xs text-soft">+ AMS 2 Pro</p>
                </div>
              </div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-soft">
                {c.specsTitle}
              </p>
              <dl className="divide-y divide-line">
                {c.specs.map((spec) => (
                  <div
                    key={spec.label}
                    className="flex items-center justify-between gap-4 py-2.5"
                  >
                    <dt className="text-sm text-soft">{spec.label}</dt>
                    <dd className="text-right text-sm font-medium">
                      {spec.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Le procédé */}
      <section
        id="process"
        className="scroll-mt-32 border-t border-line py-16 md:py-20"
      >
        <Reveal inView>
          <SectionHeading kicker={c.processKicker} title={c.processTitle} />
        </Reveal>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
          {c.steps.map((step, i) => (
            <Reveal key={step.title} inView delay={i * 0.06}>
              <div className="flex h-full flex-col rounded-2xl border border-line bg-surface p-5">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-accent/10 text-sm font-bold text-accent">
                  {i + 1}
                </span>
                <p className="mt-4 text-sm font-semibold">{step.title}</p>
                <p className="mt-1.5 text-sm leading-snug text-soft">
                  {step.text}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Nos matières */}
      <section
        id="materials"
        className="scroll-mt-32 border-t border-line py-16 md:py-20"
      >
        <Reveal inView>
          <SectionHeading kicker={c.materialsKicker} title={c.materialsTitle} />
        </Reveal>
        <Reveal inView>
          <p className="mb-7 max-w-2xl text-[15px] leading-relaxed text-soft">
            {c.materialsText}
          </p>
        </Reveal>
        <Reveal inView delay={0.08}>
          <div className="grid gap-8 rounded-card border border-line bg-elevated p-7 md:grid-cols-[0.8fr_1.2fr] md:items-center md:p-9">
            <div>
              <p className="text-5xl font-bold tracking-tight md:text-6xl">
                {c.plaName}
              </p>
              <p className="mt-2 text-sm font-medium text-accent">
                {c.plaTagline}
              </p>
            </div>
            <ul className="space-y-3">
              {c.plaPoints.map((point) => (
                <li key={point} className="flex items-start gap-2.5">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent/10">
                    <Check
                      size={13}
                      strokeWidth={2.5}
                      className="text-accent"
                    />
                  </span>
                  <span className="text-sm leading-snug text-ink">{point}</span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
        <Reveal inView>
          <p className="mt-5 text-sm leading-relaxed text-soft">
            {c.materialsNote}
          </p>
        </Reveal>
      </section>

      {/* Qualité & engagements */}
      <section
        id="trust"
        className="scroll-mt-32 border-t border-line py-16 md:py-20"
      >
        <Reveal inView>
          <SectionHeading kicker={c.trustKicker} title={c.trustTitle} />
        </Reveal>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {c.trust.map((item, i) => {
            const Icon = TRUST_ICONS[i] ?? ShieldCheck;
            return (
              <Reveal key={item.title} inView delay={i * 0.06}>
                <div className="flex h-full flex-col rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-soft/40">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-paper ring-1 ring-line">
                    <Icon size={19} strokeWidth={1.8} className="text-accent" />
                  </span>
                  <p className="mt-4 text-sm font-semibold">{item.title}</p>
                  <p className="mt-1 text-sm leading-snug text-soft">
                    {item.text}
                  </p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* FAQ */}
      <section
        id="faq"
        className="scroll-mt-32 border-t border-line py-16 md:py-20"
      >
        <div className="mx-auto max-w-3xl">
          <Reveal inView>
            <SectionHeading kicker={c.faqKicker} title={c.faqTitle} />
          </Reveal>
          <div className="space-y-3">
            {c.faq.map((item) => (
              <details
                key={item.q}
                className="faq-item rounded-2xl border border-line bg-surface px-5 transition-colors hover:border-soft/40"
              >
                <summary className="flex cursor-pointer items-center justify-between gap-4 py-4 text-[15px] font-semibold">
                  {item.q}
                  <ChevronDown
                    size={18}
                    className="faq-chevron shrink-0 text-soft transition-transform duration-200"
                  />
                </summary>
                <div className="pb-5 text-[15px] leading-relaxed text-soft">
                  {item.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section
        id="contact"
        className="scroll-mt-32 border-t border-line py-16 md:py-20"
      >
        <div className="mx-auto max-w-2xl">
          <Reveal inView>
            <div className="text-center">
              <span className="mx-auto flex h-1 w-10 rounded-full bg-accent" />
              <p className="mt-3 text-sm font-semibold uppercase tracking-wide text-accent">
                {c.contactKicker}
              </p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">
                {c.contactTitle}
              </h2>
              <p className="mx-auto mt-3 max-w-md leading-relaxed text-soft">
                {c.contactText}
              </p>
            </div>
          </Reveal>

          <Reveal inView delay={0.08}>
            <div className="mt-8 rounded-card border border-line bg-surface p-6 sm:p-8">
              <ContactForm />
            </div>
          </Reveal>

          <Reveal inView>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 text-sm text-soft sm:flex-row sm:gap-6">
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="inline-flex items-center gap-2 transition-colors hover:text-ink"
              >
                <Mail size={15} />
                {t("directEmail")} {CONTACT_EMAIL}
              </a>
              <Link
                href="/custom"
                className="inline-flex items-center gap-1.5 font-medium text-ink transition-colors hover:text-accent"
              >
                {t("quoteCta")}
                <ArrowRight size={15} />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
