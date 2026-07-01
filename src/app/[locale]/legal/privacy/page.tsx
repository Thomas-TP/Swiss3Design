import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { LegalPage, Section } from "../legal-layout";
import { PRIVACY_CONTENT } from "./content";

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("footer");
  const sections = PRIVACY_CONTENT[locale] ?? PRIVACY_CONTENT.fr;

  return (
    <LegalPage locale={locale} title={t("privacy")} updated="2026-07-01">
      {sections.map((section, i) => (
        <Section key={section.title} n={i + 1} title={section.title}>
          {section.body}
        </Section>
      ))}
    </LegalPage>
  );
}
