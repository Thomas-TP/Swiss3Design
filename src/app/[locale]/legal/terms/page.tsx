import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { LegalPage, Section } from "../legal-layout";
import { TERMS_CONTENT } from "./content";

export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("footer");
  const sections = TERMS_CONTENT[locale] ?? TERMS_CONTENT.fr;

  return (
    <LegalPage locale={locale} title={t("terms")} updated="2026-07-10">
      {sections.map((section, i) => (
        <Section key={section.title} n={i + 1} title={section.title}>
          {section.body}
        </Section>
      ))}
    </LegalPage>
  );
}
