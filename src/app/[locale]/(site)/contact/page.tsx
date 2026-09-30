import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { JsonLd } from "@/components/json-ld";
import { PageHeader } from "@/components/page-header";
import { PageCut } from "@/components/ui/page-cut";
import { pageMetadata, webPageJsonLd } from "@/lib/seo";
import { ContactForm } from "../a-propos/contact-form";
import { ContactLinks } from "../a-propos/contact-links";
import { Workshops } from "./workshops";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "seo" });
  return pageMetadata({
    locale,
    path: "/contact",
    title: t("contactTitle"),
    description: t("contactDescription"),
    imageAlt: t("ogImageAlt"),
  });
}

// /contact (brief « Strates », §7.12) : un PageHeader, le formulaire en fiche
// à gauche, les deux ateliers (isolignes et points rouges) à droite. Aucun
// contenu animé : le h1 est là au premier paint, sans révélation (§3.1), et
// cette page n'enregistre aucune vue 3D, donc ne télécharge jamais three.
export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const [t, tSeo, tAtelier] = await Promise.all([
    getTranslations("contact"),
    getTranslations("seo"),
    getTranslations("atelier"),
  ]);

  return (
    <PageCut>
      <div className="s3d-page pb-section pt-10 md:pt-16">
        <JsonLd
          data={webPageJsonLd({
            type: "ContactPage",
            locale,
            path: "/contact",
            name: tSeo("contactTitle"),
            description: tSeo("contactDescription"),
          })}
        />
        <PageHeader
          eyebrow={tAtelier("contact.eyebrow")}
          title={t("pageTitle")}
          intro={t("pageIntro")}
        />

        <div className="s3d-grid mt-12 gap-y-10 md:mt-16">
          <section
            aria-labelledby="contact-form-title"
            className="col-span-full lg:col-span-7"
          >
            <h2 id="contact-form-title" className="sr-only">
              {tAtelier("form.label")}
            </h2>
            <div className="rounded-card border border-line bg-surface p-6 sm:p-8">
              <ContactForm />
            </div>
            <ContactLinks className="mt-6" />
          </section>
          <Workshops className="col-span-full lg:col-span-5" />
        </div>
      </div>
    </PageCut>
  );
}
