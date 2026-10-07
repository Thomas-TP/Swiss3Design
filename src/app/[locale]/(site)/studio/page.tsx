import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { JsonLd } from "@/components/json-ld";
import { PageHeader } from "@/components/page-header";
import { ObjectCard } from "@/components/studio/object-card";
import { ButtonLink } from "@/components/ui/button";
import { PageCut } from "@/components/ui/page-cut";
import type { Locale } from "@/i18n/routing";
import {
  breadcrumbJsonLd,
  faqJsonLd,
  pageMetadata,
  webPageJsonLd,
} from "@/lib/seo";
import {
  formatChfRange,
  formatDuration,
  formatGrams,
  formatMm,
} from "@/lib/studio/format";
import { PRICING } from "@/lib/studio/pricing-params";
import { DEFAULT_CONFIGS } from "@/lib/studio/presets";
import { computeStats } from "@/lib/studio/stats";
import { OBJECT_TEXT_FIELDS } from "@/lib/studio/text/fields";
import { STUDIO_OBJECT_IDS, type StudioTexts } from "@/lib/studio/types";

// Index du Studio (brief « Strates », §6.12, §7.6) : h1 « Le Studio », chapeau
// « Personnalisez-le. On l'imprime. », quatre cartes (l'aperçu de l'objet dans
// ses couleurs, une ligne, les chiffres de l'objet par défaut, « Sur devis » ou
// la fourchette), comment ça marche en quatre étapes (numérotées, sans
// pictogramme), FAQ, lien vers /custom. Aucune vue WebGL ni composant client :
// la page reste légère, les chiffres sortent de la même fonction pure que le
// Studio (computeStats).

export const dynamic = "force-dynamic";

const FAQ_KEYS = ["printable", "price", "text", "colors", "after"] as const;
const STEP_KEYS = ["adjust", "check", "send", "receive"] as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const [t, tSeo] = await Promise.all([
    getTranslations({ locale, namespace: "studio" }),
    getTranslations({ locale, namespace: "seo" }),
  ]);
  return pageMetadata({
    locale,
    path: "/studio",
    title: t("seo.index.title"),
    description: t("seo.index.description"),
    imageAlt: tSeo("ogImageAlt"),
  });
}

export default async function StudioIndexPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const [t, core] = await Promise.all([
    getTranslations({ locale, namespace: "studio" }),
    getTranslations({ locale, namespace: "studioCore" }),
  ]);

  const faq = FAQ_KEYS.map((key) => ({
    q: t(`faq.items.${key}.q`),
    a: t(`faq.items.${key}.a`),
  }));
  const cards = STUDIO_OBJECT_IDS.map((object) => {
    const config = DEFAULT_CONFIGS[object];
    // Les textes d'exemple de la langue : le visiteur n'a rien saisi ici.
    const texts: StudioTexts = {};
    for (const field of OBJECT_TEXT_FIELDS[object])
      texts[field] = core(`examples.${field}`);
    const stats = computeStats(config, texts, PRICING, locale);
    const size =
      object === "lavaux"
        ? `H ${formatMm(stats.heightMm, locale, 0)} · Ø ${formatMm(stats.widthMm, locale, 0)}`
        : core("units.dimensions", {
            width: stats.widthMm,
            depth: stats.depthMm,
            height: stats.heightMm,
          });
    return {
      object,
      texts,
      name: core(`objects.${object}.name`),
      tagline: core(`objects.${object}.tagline`),
      figures: `${size} · ≈ ${formatGrams(stats.grams, locale)} · ≈ ${formatDuration(stats.minutes, locale)}`,
      price: stats.estimate
        ? formatChfRange(
            stats.estimate.lowCents,
            stats.estimate.highCents,
            locale,
          )
        : core("measure.onQuote"),
    };
  });

  return (
    <PageCut>
      <div className="s3d-page pb-section pt-10 md:pt-16">
        <JsonLd
          data={webPageJsonLd({
            type: "WebPage",
            locale,
            path: "/studio",
            name: t("seo.index.title"),
            description: t("seo.index.description"),
          })}
        />
        <JsonLd data={faqJsonLd(faq)} />
        <JsonLd
          data={breadcrumbJsonLd([
            { name: t("breadcrumb.home"), path: `/${locale}` },
            { name: t("breadcrumb.studio"), path: `/${locale}/studio` },
          ])}
        />
        <PageHeader
          eyebrow={t("index.eyebrow")}
          title={t("index.title")}
          intro={t("index.intro")}
        />
        <p className="mt-6 max-w-[62ch] text-soft">{t("index.lead")}</p>

        <ul className="s3d-grid mt-12 gap-y-6 md:mt-16">
          {cards.map((card) => (
            <li
              key={card.object}
              // Deux cartes par rangée de 640 px à 1279 px (grille à 8 puis 12
              // colonnes), quatre au-delà : des aperçus en grand, jamais en vignette.
              className="col-span-full sm:col-span-4 lg:col-span-6 xl:col-span-3"
            >
              <ObjectCard
                object={card.object}
                locale={locale}
                texts={card.texts}
                name={card.name}
                tagline={card.tagline}
                figures={card.figures}
                price={card.price}
                cta={t("index.adjust")}
                level={2}
              />
            </li>
          ))}
        </ul>

        <section aria-labelledby="studio-how" className="mt-section">
          <h2 id="studio-how" className="font-display text-title text-ink">
            {t("how.title")}
          </h2>
          <ol className="s3d-grid mt-8 gap-y-8">
            {STEP_KEYS.map((key, index) => (
              <li
                key={key}
                className="col-span-full flex flex-col gap-2 border-t border-line pt-4 sm:col-span-4 lg:col-span-3"
              >
                <p className="s3d-label text-iso-index">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <h3 className="font-display text-[1.0625rem] font-bold text-ink">
                  {t(`how.steps.${key}.title`)}
                </h3>
                <p className="text-sm text-soft">
                  {t(`how.steps.${key}.text`)}
                </p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="studio-faq" className="mt-section max-w-3xl">
          <h2 id="studio-faq" className="font-display text-title text-ink">
            {t("faq.title")}
          </h2>
          <div className="mt-6 divide-y divide-line border-y border-line">
            {faq.map((item) => (
              <details key={item.q} className="group py-4">
                <summary className="cursor-pointer list-none font-medium text-ink marker:hidden">
                  {item.q}
                </summary>
                <p className="mt-3 max-w-[62ch] text-soft">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section
          aria-labelledby="studio-custom"
          className="mt-section flex flex-wrap items-center justify-between gap-x-8 gap-y-4 border-y border-line py-8"
        >
          <div className="max-w-[46rem]">
            <h2 id="studio-custom" className="font-display text-title text-ink">
              {t("custom.title")}
            </h2>
            <p className="mt-3 text-soft">{t("custom.text")}</p>
          </div>
          <ButtonLink href="/custom" variant="secondary">
            {t("custom.cta")}
          </ButtonLink>
        </section>
      </div>
    </PageCut>
  );
}
