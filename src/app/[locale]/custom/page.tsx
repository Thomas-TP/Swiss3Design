import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { getMaterials } from "@/db/queries";
import { customServiceJsonLd, pageMetadata } from "@/lib/seo";
import { JsonLd } from "@/components/json-ld";
import { QuoteForm } from "./quote-form";
import { PageHeader } from "@/components/page-header";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "seo" });
  return pageMetadata({
    locale,
    path: "/custom",
    title: t("customTitle"),
    description: t("customDescription"),
    imageAlt: t("ogImageAlt"),
  });
}

export default async function CustomPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const [t, tSeo, materials] = await Promise.all([
    getTranslations("custom"),
    getTranslations("seo"),
    getMaterials(),
  ]);

  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:px-6 md:py-16">
      {/* Service d'impression sur mesure, rattaché à l'entreprise. */}
      <JsonLd
        data={customServiceJsonLd({
          locale,
          name: tSeo("customServiceName"),
          description: tSeo("customDescription"),
        })}
      />
      <PageHeader title={t("title")} intro={t("intro")} />

      <div className="mt-8">
        <QuoteForm materials={materials} />
      </div>
    </div>
  );
}
