import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { JsonLd } from "@/components/json-ld";
import { StudioApp } from "@/components/studio/studio-app";
import { TrackEvent } from "@/components/track-event";
import { ButtonLink } from "@/components/ui/button";
import { PageCut } from "@/components/ui/page-cut";
import { SiteLink } from "@/components/ui/site-link";
import type { Locale } from "@/i18n/routing";
import {
  breadcrumbJsonLd,
  faqJsonLd,
  pageMetadata,
  webPageJsonLd,
} from "@/lib/seo";
import { defaultConfig } from "@/lib/studio/presets";
import { isStudioObjectId, type StudioObjectId } from "@/lib/studio/types";
import {
  decodeSearchParams,
  type SearchParamsLike,
} from "@/lib/studio/url-state";
import { withDot } from "@/components/ui/dot-title";

// Objet du Studio (brief « Strates », §6.12, §7.7) : un nom inconnu est un 404
// avant tout calcul ; sinon le formulaire GET complet (contrôles natifs, valeurs
// par défaut ou celles de la requête), le poster 2D exact, la bande de mesure
// (computeStats), la fiche en <dl>, la FAQ et les données structurées.
// StudioApp reprend la main après l'hydratation. Pas de JSON-LD Product : un
// objet du Studio n'a pas de prix fixe, ce n'est pas une fiche marchande.
//
// Les paramètres GET ne portent JAMAIS de texte (decodeSearchParams refuse une
// clé de texte) ; une requête illisible donne les réglages par défaut et un mot.

export const dynamic = "force-dynamic";

const FAQ_KEYS = ["printable", "price", "text", "colors", "after"] as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; objet: string }>;
}): Promise<Metadata> {
  const { locale, objet } = await params;
  if (!isStudioObjectId(objet)) return {};
  const [t, tSeo] = await Promise.all([
    getTranslations({ locale, namespace: "studio" }),
    getTranslations({ locale, namespace: "seo" }),
  ]);
  return pageMetadata({
    locale,
    path: `/studio/${objet}`,
    title: t(`seo.objects.${objet}.title`),
    description: t(`seo.objects.${objet}.description`),
    imageAlt: tSeo("ogImageAlt"),
  });
}

export default async function StudioObjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale; objet: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, objet } = await params;
  if (!isStudioObjectId(objet)) notFound();
  const object: StudioObjectId = objet;
  const query = await searchParams;
  const defaults = defaultConfig(object);
  const hasQuery = Object.keys(query).length > 0;
  const decoded = hasQuery
    ? decodeSearchParams(object, query as SearchParamsLike, defaults)
    : null;
  const initialConfig = decoded?.ok ? decoded.config : defaults;
  // Une requête sans clé du Studio (suivi, publicité) n'est pas une erreur.
  const initialInvalid = decoded !== null && !decoded.ok;

  const [t, core] = await Promise.all([
    getTranslations({ locale, namespace: "studio" }),
    getTranslations({ locale, namespace: "studioCore" }),
  ]);
  const name = core(`objects.${object}.name`);
  const faq = FAQ_KEYS.map((key) => ({
    q: t(`faq.items.${key}.q`),
    a: t(`faq.items.${key}.a`),
  }));

  return (
    <PageCut>
      <div className="s3d-page pb-section pt-6 md:pt-10">
        <JsonLd
          data={webPageJsonLd({
            type: "WebPage",
            locale,
            path: `/studio/${object}`,
            name: t(`seo.objects.${object}.title`),
            description: t(`seo.objects.${object}.description`),
          })}
        />
        <JsonLd data={faqJsonLd(faq)} />
        <JsonLd
          data={breadcrumbJsonLd([
            { name: t("breadcrumb.home"), path: `/${locale}` },
            { name: t("breadcrumb.studio"), path: `/${locale}/studio` },
            { name, path: `/${locale}/studio/${object}` },
          ])}
        />
        <TrackEvent event="Studio Viewed" properties={{ object }} />

        <StudioApp
          object={object}
          initialConfig={initialConfig}
          initialInvalid={initialInvalid}
          action={`/${locale}/studio/${object}`}
          breadcrumb={
            <nav
              aria-label={t("breadcrumb.label")}
              className="s3d-label text-soft"
            >
              <ol className="flex flex-wrap items-center gap-2 normal-case">
                <li>
                  <SiteLink
                    href="/studio"
                    className="underline decoration-line decoration-1 underline-offset-4 hover:decoration-ink"
                  >
                    {t("breadcrumb.studio")}
                  </SiteLink>
                </li>
                <li aria-hidden="true">›</li>
                <li aria-current="page" className="text-ink">
                  {name}
                </li>
              </ol>
            </nav>
          }
          intro={
            <div>
              <h1 className="font-display text-display break-words text-ink lg:text-[clamp(2.25rem,3.1vw,3.5rem)]">
                {withDot(name)}
              </h1>
              <p className="mt-4 max-w-[46ch] text-lead text-soft">
                {t(`objects.${object}.lead`)}
              </p>
            </div>
          }
        />

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
