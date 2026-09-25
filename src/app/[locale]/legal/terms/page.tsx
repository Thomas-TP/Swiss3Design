import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { pageMetadata } from "@/lib/seo";
import { LEGAL_UPDATED, LegalPage, Section } from "../legal-layout";
import { TERMS_CONTENT } from "./content";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "seo" });
  return pageMetadata({
    locale,
    path: "/legal/terms",
    title: t("termsTitle"),
    description: t("termsDescription"),
    imageAlt: t("ogImageAlt"),
  });
}

export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("footer");
  const sections = TERMS_CONTENT[locale] ?? TERMS_CONTENT.fr;

  return (
    <LegalPage locale={locale} title={t("terms")} updated={LEGAL_UPDATED.terms}>
      {sections.map((section, i) => (
        <Section key={section.title} n={i + 1} title={section.title}>
          {section.body}
        </Section>
      ))}
    </LegalPage>
  );
}
