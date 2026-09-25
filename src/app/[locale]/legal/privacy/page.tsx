import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { pageMetadata } from "@/lib/seo";
import { LEGAL_UPDATED, LegalPage, Section } from "../legal-layout";
import { PRIVACY_CONTENT } from "./content";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "seo" });
  return pageMetadata({
    locale,
    path: "/legal/privacy",
    title: t("privacyTitle"),
    description: t("privacyDescription"),
    imageAlt: t("ogImageAlt"),
  });
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("footer");
  const sections = PRIVACY_CONTENT[locale] ?? PRIVACY_CONTENT.fr;

  return (
    <LegalPage
      locale={locale}
      title={t("privacy")}
      updated={LEGAL_UPDATED.privacy}
    >
      {sections.map((section, i) => (
        <Section key={section.title} n={i + 1} title={section.title}>
          {section.body}
        </Section>
      ))}
    </LegalPage>
  );
}
