import type { Metadata } from "next";
import { ArrowRight, Mail } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { Reveal } from "@/components/reveal";
import { ContactForm } from "../a-propos/contact-form";

const CONTACT_EMAIL = "contact@swiss3design.ch";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contact" });
  return {
    title: t("pageTitle"),
    description: t("pageIntro"),
    openGraph: { title: t("pageTitle"), description: t("pageIntro"), type: "website" },
  };
}

export default async function ContactPage() {
  const t = await getTranslations("contact");

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 md:py-16">
      <Reveal>
        <span className="flex h-1 w-10 rounded-full bg-accent" />
        <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
          {t("pageTitle")}
        </h1>
        <p className="mt-3 max-w-lg leading-relaxed text-soft">
          {t("pageIntro")}
        </p>
      </Reveal>

      <Reveal delay={0.08}>
        <div className="mt-8 rounded-card border border-line bg-surface p-6 sm:p-8">
          <ContactForm />
        </div>
      </Reveal>

      <Reveal>
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
  );
}
