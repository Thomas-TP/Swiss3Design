import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getProducts } from "@/db/queries";
import { ChapterAtelier } from "@/components/home/chapter-atelier";
import { ChapterFile } from "@/components/home/chapter-file";
import { ChapterMap } from "@/components/home/chapter-map";
import { ChapterShop } from "@/components/home/chapter-shop";
import { ChapterStudio } from "@/components/home/chapter-studio";
import { ChapterSummit } from "@/components/home/chapter-summit";
import { Hero } from "@/components/home/hero";
import { buildHeroData } from "@/components/home/hero-data-build";
import { HomeConfigProvider } from "@/components/home/home-config-context";
import { HomeMotion } from "@/components/home/home-motion";
import { TrustStrip } from "@/components/home/trust-strip";
import { ChapterRail, type RailChapter } from "@/components/ui/chapter-rail";
import { PageCut } from "@/components/ui/page-cut";
import { ClientMessages } from "@/i18n/client-messages";
import type { Locale } from "@/i18n/routing";
import { formatChf } from "@/lib/format";
import { pageMetadata } from "@/lib/seo";
import { getShippingSettings } from "@/lib/shipping-settings";

// Accueil « Strates » (brief §7.5) : sept chapitres, de « Tout relief commence
// par une couche. » (le héros : l'impression réglable) à « Vous avez déjà un
// fichier ? ». Tout le contenu est rendu par le serveur (h1 compris : c'est
// l'élément LCP) ; le mouvement n'enrichit qu'un DOM déjà complet.
//
// Données dynamiques gardées de l'ancienne page : `force-dynamic`, les produits
// vedettes et les réglages de livraison (le seuil de livraison offerte n'est
// jamais écrit en dur). Les chiffres du héros sortent de `computeStats` et de
// `bandStats` (hero-data-build.ts), les mêmes fonctions que le Studio.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "landing.seo" });
  return pageMetadata({
    locale,
    path: "",
    title: t("title"),
    description: t("description"),
    imageAlt: t("imageAlt"),
    absoluteTitle: true,
  });
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const [rail, featured, shipping] = await Promise.all([
    getTranslations({ locale, namespace: "landing.rail" }),
    getProducts(locale, { featuredOnly: true }),
    getShippingSettings(),
  ]);
  const heroData = buildHeroData();
  const freeOver = formatChf(shipping.freeOverCents, locale);

  const chapters: RailChapter[] = [
    { id: "relief", number: "00", label: rail("hero") },
    { id: "carte", number: "01", label: rail("map") },
    { id: "sommet", number: "02", label: rail("summit") },
    { id: "studio", number: "03", label: rail("studio") },
    { id: "boutique", number: "04", label: rail("shop") },
    { id: "atelier", number: "05", label: rail("atelier") },
    { id: "fichier", number: "06", label: rail("file") },
  ];

  return (
    <PageCut>
      {/* Messages lus par les composants client de l'accueil (héros, éclaté,
          sommet) : le navigateur ne reçoit que ceux-là. */}
      <ClientMessages
        namespaces={[
          "landing.hero",
          "landing.map",
          "landing.summit",
          "studioCore.units",
          "studioCore.bands",
          "studioCore.filaments",
          "studioCore.palettes",
          "studioCore.patterns",
          "studioCore.examples",
        ]}
      >
        <HomeConfigProvider data={heroData}>
          <ChapterRail chapters={chapters} label={rail("label")} />
          <Hero />
          <TrustStrip freeOver={freeOver} />
          <ChapterMap data={heroData} />
          <ChapterSummit />
          <ChapterStudio freeOver={freeOver} />
          <ChapterShop products={featured} />
          <ChapterAtelier freeOver={freeOver} />
          <ChapterFile />
          <HomeMotion />
        </HomeConfigProvider>
      </ClientMessages>
    </PageCut>
  );
}
