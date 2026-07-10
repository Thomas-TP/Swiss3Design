import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { LegalPage, Section } from "../legal-layout";
import { SHIPPING_CONTENT } from "./content";

const META_DESCRIPTION: Record<Locale, string> = {
  fr: "Zone de livraison, délais, frais de port et politique de retour de Swiss3Design — livraison en Suisse uniquement.",
  de: "Liefergebiet, Fristen, Versandkosten und Rückgaberichtlinie von Swiss3Design — Lieferung nur in die Schweiz.",
  it: "Zona di consegna, tempi, spese di spedizione e politica di reso di Swiss3Design — consegna solo in Svizzera.",
  en: "Delivery area, timelines, shipping cost and return policy for Swiss3Design — Switzerland-only shipping.",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "footer" });
  const title = t("shippingReturns");
  return {
    title,
    description: META_DESCRIPTION[locale] ?? META_DESCRIPTION.fr,
    openGraph: { title, description: META_DESCRIPTION[locale], type: "website" },
  };
}

export default async function ShippingPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("footer");
  const sections = SHIPPING_CONTENT[locale] ?? SHIPPING_CONTENT.fr;

  return (
    <LegalPage locale={locale} title={t("shippingReturns")} updated="2026-07-10">
      {sections.map((section, i) => (
        <Section key={section.title} n={i + 1} title={section.title}>
          {section.body}
        </Section>
      ))}
    </LegalPage>
  );
}
