import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ArrowDown } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import { getMaterials } from "@/db/queries";
import { customServiceJsonLd, pageMetadata } from "@/lib/seo";
import { JsonLd } from "@/components/json-ld";
import { QuoteForm } from "./quote-form";
import { PageHeader } from "@/components/page-header";
import { PageCut } from "@/components/ui/page-cut";
import { ButtonLink, buttonClass } from "@/components/ui/button";
import { SpecTable } from "@/components/ui/spec-table";

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
  const [t, tCustom, tShell, tSeo, materials] = await Promise.all([
    getTranslations("quote"),
    getTranslations("custom"),
    getTranslations("shell.cta"),
    getTranslations("seo"),
    getMaterials(),
  ]);

  return (
    <PageCut>
      <div className="s3d-page pb-section pt-10 md:pt-16">
        {/* Service d'impression sur mesure, rattaché à l'entreprise. */}
        <JsonLd
          data={customServiceJsonLd({
            locale,
            name: tSeo("customServiceName"),
            description: tSeo("customDescription"),
          })}
        />
        <PageHeader title={tCustom("title")} intro={tCustom("intro")} />

        {/* Deux entrées, séparées par un filet : avec un fichier, sans fichier. */}
        <ul className="mt-12 grid grid-cols-1 divide-y divide-line border-y border-line md:mt-16 md:grid-cols-2 md:divide-x md:divide-y-0">
          <li className="flex flex-col items-start gap-4 py-8 md:pr-10">
            <p className="s3d-label text-soft">{t("entries.file.kicker")}</p>
            <h2 className="font-display text-title text-ink">
              {t("entries.file.title")}
            </h2>
            <p className="max-w-[45ch] text-soft">{t("entries.file.body")}</p>
            {/* Ancre sur la fiche : Lenis (ou le navigateur) fait défiler. */}
            <a
              href="#demande"
              className={buttonClass({
                variant: "secondary",
                className: "mt-auto",
              })}
            >
              {t("entries.file.cta")}
              <ArrowDown size={16} strokeWidth={1.5} aria-hidden="true" />
            </a>
          </li>
          <li className="flex flex-col items-start gap-4 py-8 md:pl-10">
            <p className="s3d-label text-soft">{t("entries.studio.kicker")}</p>
            <h2 className="font-display text-title text-ink">
              {t("entries.studio.title")}
            </h2>
            <p className="max-w-[45ch] text-soft">{t("entries.studio.body")}</p>
            <ButtonLink href="/studio" variant="secondary" className="mt-auto">
              {tShell("studio")}
            </ButtonLink>
          </li>
        </ul>

        {/* La fiche de demande : faits à gauche, formulaire à droite (desktop). */}
        <section
          id="demande"
          aria-labelledby="demande-title"
          className="s3d-grid mt-16 scroll-mt-24 gap-y-10"
        >
          <div className="col-span-full lg:col-span-4">
            <p className="s3d-label text-soft">{t("sheet.kicker")}</p>
            <h2
              id="demande-title"
              className="mt-3 font-display text-title text-ink"
            >
              {t("sheet.title")}
            </h2>
            <SpecTable
              className="mt-6"
              rows={[
                { term: t("facts.formats"), value: t("facts.formatsValue") },
                { term: t("facts.size"), value: t("facts.sizeValue") },
                { term: t("facts.answer"), value: t("facts.answerValue") },
              ]}
            />
          </div>
          <div className="col-span-full max-w-2xl lg:col-span-8 lg:max-w-none">
            <QuoteForm materials={materials} />
          </div>
        </section>
      </div>
    </PageCut>
  );
}
