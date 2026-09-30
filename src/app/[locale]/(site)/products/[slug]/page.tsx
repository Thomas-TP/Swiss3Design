import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { ArrowLeft, Truck, Factory, ShieldCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import {
  getProductBySlug,
  getRelatedProducts,
  getPublishedReviews,
  getRatingSummary,
} from "@/db/queries";
import {
  breadcrumbJsonLd,
  clampText,
  pageMetadata,
  productJsonLd,
  type OgImage,
} from "@/lib/seo";
import { attributionFor } from "@/lib/attribution";
import { cfOgImage } from "@/lib/cf-image";
import { formatChf } from "@/lib/format";
import { getShippingSettings } from "@/lib/shipping-settings";
import { JsonLd } from "@/components/json-ld";
import { TrackEvent } from "@/components/track-event";
import { productProperties } from "@/lib/analytics";
import { MulticolorDots } from "@/components/multicolor-dots";
import { ProductGallery } from "@/components/product-gallery";
import { ProductColorProvider } from "@/components/product-color-context";
import { ProductPurchase } from "@/components/product-purchase";
import { ProductCard, type ProductCardItem } from "@/components/product-card";
import { StarRating } from "@/components/star-rating";
import { AttributionBlock } from "@/components/catalog/attribution-block";
import { getCardExtras } from "@/components/catalog/card-extras";
import { ProductMotion } from "@/components/catalog/product-motion";
import { ProductViewer } from "@/components/catalog/product-viewer";
import { Chapter } from "@/components/ui/chapter";
import { ChapterRail, type RailChapter } from "@/components/ui/chapter-rail";
import { ButtonLink } from "@/components/ui/button";
import { PageCut } from "@/components/ui/page-cut";
import { SiteLink } from "@/components/ui/site-link";
import { SpecTable } from "@/components/ui/spec-table";

export const dynamic = "force-dynamic";

// Mémoïse la lecture produit le temps de la requête : generateMetadata et le
// rendu de la page partagent ainsi UNE seule lecture D1 au lieu de deux.
const getProduct = cache(getProductBySlug);

// Description de la fiche pour les moteurs : le texte produit s'il est assez
// riche (≥ 110 caractères, seuil Ahrefs), sinon une phrase factuelle générée
// (nom, matière, prix, provenance) — la description saisie à l'admin peut
// n'être qu'un nom (« Vase spirale »), ce qui donnait une meta de 12 signes.
async function productMetaDescription(
  product: NonNullable<Awaited<ReturnType<typeof getProduct>>>,
  locale: Locale,
) {
  // Un premier paragraphe de 110–160 signes est un résumé rédigé pour ça :
  // repris tel quel, sans coupure au milieu du paragraphe suivant.
  const lead = product.description.split(/\n\s*\n/)[0]?.replace(/\s+/g, " ");
  if (lead && lead.trim().length >= 110 && lead.trim().length <= 160)
    return lead.trim();
  const own = product.description.replace(/\s+/g, " ").trim();
  if (own.length >= 110) return clampText(own);
  const t = await getTranslations({ locale, namespace: "seo" });
  const generated = t("productDescription", {
    name: product.name,
    material: product.material,
    price: formatChf(product.priceCents, locale),
  });
  const isJustTheName = own.toLowerCase() === product.name.toLowerCase();
  return clampText(own && !isJustTheName ? `${own} — ${generated}` : generated);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const [product, t] = await Promise.all([
    getProduct(slug, locale),
    getTranslations({ locale, namespace: "seo" }),
  ]);
  if (!product) return {};
  // Titre enrichi (« Vase spirale — imprimé en 3D en Suisse ») tant qu'il
  // tient dans ~60 caractères avec la marque ; un nom long reste seul.
  const title =
    product.name.length <= 20
      ? t("productTitle", { name: product.name })
      : product.name;
  // Les SVG (visuels de démo) ne sont lus par aucun réseau social : écartés,
  // l'image de partage par défaut prend alors le relais.
  const images: OgImage[] = product.images
    .filter((i) => !/\.svg(?:[?#]|$)/i.test(i.url))
    .slice(0, 4)
    .map((i) => {
      const og = cfOgImage(i.url);
      return og
        ? { url: og, width: 1200, height: 630, alt: i.alt ?? product.name }
        : { url: i.url, alt: i.alt ?? product.name };
    });
  return pageMetadata({
    locale,
    path: `/products/${slug}`,
    title,
    description: await productMetaDescription(product, locale),
    images,
    imageAlt: t("ogImageAlt"),
  });
}

// Modèle 3D : la photo qui le précède tant qu'il n'est pas rendu (et seule là où
// la 3D n'est pas possible). De préférence le « rendu 3D » de la galerie s'il y
// en a un (sa légende le dit), sinon la première photo.
function posterOf(images: { url: string; alt: string | null }[]) {
  return (
    images.find((i) => /\b(3d|rendu|render|rendering)\b/i.test(i.alt ?? "")) ??
    images[0] ??
    null
  );
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ locale: Locale; slug: string }>;
}) {
  const { locale, slug } = await params;
  const [t, product] = await Promise.all([
    getTranslations("product"),
    getProduct(slug, locale),
  ]);
  if (!product) notFound();

  const [
    related,
    productReviews,
    ratingSummary,
    tReviews,
    tCat,
    tSeo,
    tShop,
    shippingSettings,
  ] = await Promise.all([
    getRelatedProducts(product.id, locale),
    getPublishedReviews(product.id),
    getRatingSummary(product.id),
    getTranslations("reviews"),
    getTranslations("catalog"),
    getTranslations("seo"),
    getTranslations("shop"),
    getShippingSettings(),
  ]);

  // Dimensions et 2ᵉ photo des cartes des produits liés : une lecture groupée.
  const relatedExtras = await getCardExtras(related.map((p) => p.id));
  const relatedCards: ProductCardItem[] = related.map((p) => ({
    ...p,
    dimensionsMm: relatedExtras.get(p.id)?.dimensionsMm ?? null,
    secondImage: relatedExtras.get(p.id)?.secondImage ?? null,
  }));

  // Crédit de design (CC BY-ND 4.0 de Ian pour le Vase spirale) : null pour un
  // modèle de notre conception. Il alimente le bloc de crédit, la ligne courte
  // de la colonne d'achat et le nœud 3DModel des données structurées.
  const attribution = attributionFor(product.slug);

  // Données structurées Product (prix/dispo CHF, livraison, retours) →
  // résultats enrichis et fiches marchandes Google, et une fiche lisible sans
  // ambiguïté par les moteurs IA. Nonce CSP géré par <JsonLd>.
  const jsonLd = productJsonLd(
    {
      slug: product.slug,
      name: product.name,
      description: await productMetaDescription(product, locale),
      priceCents: product.priceCents,
      saleType: product.saleType,
      productionDays: product.productionDays,
      stock: product.stock,
      material: product.material,
      weightGrams: product.weightGrams,
      dimensionsMm: product.dimensionsMm,
      colors: product.colors.map((c) => c.name),
      imageUrls: product.images.map((i) => i.url),
      design: attribution ?? undefined,
    },
    locale,
    shippingSettings,
    ratingSummary,
  );
  const breadcrumb = breadcrumbJsonLd([
    { name: tSeo("breadcrumbHome"), path: `/${locale}` },
    { name: tShop("title"), path: `/${locale}/shop` },
    { name: product.name, path: `/${locale}/products/${product.slug}` },
  ]);

  const image = product.images[0];
  // Fiche technique rendue côté serveur : un bloc de faits nets (matière,
  // taille, poids, délai, provenance) que moteurs et assistants IA reprennent
  // tels quels, sans dépendre du sélecteur d'achat (composant client).
  const specs = [
    { term: t("material"), value: product.material },
    { term: t("dimensions"), value: product.dimensionsMm },
    {
      term: t("weight"),
      value: product.weightGrams ? `${product.weightGrams} g` : null,
    },
    {
      term: t("productionTime"),
      value:
        product.saleType === "on_demand"
          ? t("productionDays", { days: product.productionDays ?? 3 })
          : null,
    },
    { term: t("origin"), value: t("originValue") },
  ].filter((s) => s.value);
  // Paragraphes saisis à l'admin (ligne vide = nouveau paragraphe) : une
  // description structurée se lit mieux et se découpe mieux pour les moteurs.
  const paragraphs = product.description
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  // Chapitres (brief « Strates », §7.9) : 01 Objet, 02 Tourner, 03 Fiche
  // technique, 04 Crédit, 05 Avis, 06 « Un vase à vos couleurs ? », 07 Produits
  // liés. Numérotés dans l'ordre de ceux qui existent pour CE produit (sans
  // modèle 3D, ni crédit, ni avis, la suite se resserre), ce qui donne la
  // numérotation du brief pour le Vase spirale.
  const hasViewer = Boolean(product.model3dUrl);
  const hasSpecs = specs.length > 0 || paragraphs.length > 1;
  const sections = [
    { key: "object", id: "objet", present: true },
    { key: "turn", id: "tourner", present: hasViewer },
    { key: "specs", id: "mesures", present: hasSpecs },
    { key: "credit", id: "credit", present: attribution !== null },
    { key: "reviews", id: "avis", present: productReviews.length > 0 },
    { key: "cross", id: "studio", present: attribution !== null },
    { key: "related", id: "suite", present: relatedCards.length > 0 },
  ]
    .filter((s) => s.present)
    .map((s, index) => ({
      ...s,
      number: String(index + 1).padStart(2, "0"),
      label: tCat(`product.chapters.${s.key}`),
    }));
  const chapter = (key: string) => sections.find((s) => s.key === key)!;
  const rail: RailChapter[] = sections.map((s) => ({
    id: s.id,
    number: s.number,
    label: s.label,
  }));

  return (
    <PageCut>
      <JsonLd data={jsonLd} />
      <JsonLd data={breadcrumb} />
      <TrackEvent
        event="Product Viewed"
        properties={{
          ...productProperties({
            productId: product.id,
            slug: product.slug,
            name: product.name,
            priceCents: product.priceCents,
            saleType: product.saleType,
          }),
          in_stock: product.stock == null || product.stock > 0,
          rating: ratingSummary.count > 0 ? ratingSummary.average : null,
          reviews: ratingSummary.count,
        }}
      />
      {sections.length > 2 && (
        <ChapterRail chapters={rail} label={tCat("product.rail")} />
      )}

      <ProductColorProvider colors={product.colors}>
        {/* 01 · Objet : la galerie et, à côté, la colonne d'achat collante dès
          le premier écran (quand l'écran est assez haut pour qu'elle tienne :
          pas de colonne collante plus haute que la fenêtre). */}
        <section
          id="objet"
          data-chapter="01"
          aria-labelledby="product-title"
          className="s3d-page scroll-mt-24 pb-16 pt-6 md:pb-24 md:pt-10"
        >
          <SiteLink
            href="/shop"
            className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-soft transition-colors duration-150 hover:text-ink"
          >
            <ArrowLeft size={15} aria-hidden="true" />
            {tCat("product.back")}
          </SiteLink>

          <div className="s3d-grid items-start gap-y-10">
            <div className="col-span-full md:col-span-4 lg:col-span-7">
              <ProductGallery
                images={product.images}
                name={product.name}
                slug={product.slug}
              />
            </div>

            <div className="col-span-full flex flex-col md:col-span-4 md:[@media(min-height:800px)]:sticky md:[@media(min-height:800px)]:top-24 lg:col-span-5">
              {product.multicolor && (
                <span className="s3d-label flex w-fit items-center gap-1.5 rounded-hair border border-line bg-surface px-2 py-1 normal-case text-ink">
                  <MulticolorDots size={6} />
                  {t("multicolorBadge")}
                </span>
              )}

              <h1
                id="product-title"
                className={`font-display text-title text-ink ${product.multicolor ? "mt-4" : ""}`}
              >
                {product.name}
              </h1>
              {/* Premier paragraphe = résumé (et meta description) : juste sous
                le titre ; la suite vient au chapitre « Fiche technique », et
                l'achat reste visible. */}
              {paragraphs[0] && (
                <p className="mt-4 max-w-[65ch] leading-relaxed text-soft">
                  {paragraphs[0]}
                </p>
              )}

              {ratingSummary.count > 0 && (
                <div className="mt-3 flex items-center gap-2">
                  <StarRating value={ratingSummary.average} size={15} />
                  <span className="text-sm text-soft">
                    {tReviews("count", { count: ratingSummary.count })}
                  </span>
                </div>
              )}

              <ProductPurchase
                productId={product.id}
                slug={product.slug}
                name={product.name}
                basePriceCents={product.priceCents}
                saleType={product.saleType}
                productionDays={product.productionDays}
                productStock={product.stock}
                imageUrl={image?.url ?? null}
                variants={product.variants.map((v) => ({
                  id: v.id,
                  name: v.name,
                  priceCents: v.priceCents,
                  stock: v.stock,
                }))}
              />

              {/* Réassurance au plus près du bouton d'achat : lève les trois
                objections classiques (délai, provenance, paiement) sans quitter
                la page. Libellés copiés dans `catalog.trust` (découplés de
                `home.*`, que la refonte de l'accueil réécrit). */}
              <ul className="mt-6 grid gap-2 sm:grid-cols-3">
                {[
                  { Icon: Truck, label: tCat("trust.shippingTitle") },
                  { Icon: Factory, label: tCat("trust.madeTitle") },
                  { Icon: ShieldCheck, label: tCat("trust.paymentTitle") },
                ].map(({ Icon, label }) => (
                  <li
                    key={label}
                    className="flex items-center gap-2 rounded-field border border-line px-3 py-2.5"
                  >
                    <Icon
                      size={16}
                      strokeWidth={1.5}
                      aria-hidden="true"
                      className="shrink-0 text-iso-index"
                    />
                    <span className="text-xs font-semibold leading-tight">
                      {label}
                    </span>
                  </li>
                ))}
              </ul>

              {attribution && (
                <p className="s3d-label mt-5 normal-case text-soft">
                  {tCat("attribution.short", {
                    author: attribution.author,
                    license: attribution.license,
                  })}
                  {" · "}
                  <a
                    href="#credit"
                    className="underline decoration-iso-index decoration-1 underline-offset-4 hover:decoration-ink"
                  >
                    {tCat("attribution.seeCredit")} ↓
                  </a>
                </p>
              )}
            </div>
          </div>
        </section>

        {/* 02 · Tourner : le fichier original, que l'on fait tourner. */}
        {hasViewer && product.model3dUrl && (
          <Chapter
            id={chapter("turn").id}
            number={chapter("turn").number}
            title={tCat("product.titles.turn")}
            eyebrow={chapter("turn").label}
            className="border-t border-line"
          >
            <ProductViewer
              slug={product.slug}
              name={product.name}
              modelUrl={product.model3dUrl}
              poster={posterOf(product.images)}
              author={attribution?.author ?? "Swiss3Design"}
            />
          </Chapter>
        )}
      </ProductColorProvider>

      {/* 03 · Fiche technique : <dl> rendu serveur + la suite de la description. */}
      {hasSpecs && (
        <Chapter
          id={chapter("specs").id}
          number={chapter("specs").number}
          title={tCat("product.titles.specs")}
          eyebrow={chapter("specs").label}
          className="border-t border-line"
        >
          <div className="s3d-page mt-10">
            <div className="s3d-grid gap-y-10">
              {specs.length > 0 && (
                <SpecTable
                  className="col-span-full lg:col-span-6"
                  rows={specs.map((s) => ({ term: s.term, value: s.value }))}
                />
              )}
              {paragraphs.length > 1 && (
                <div className="col-span-full max-w-[65ch] space-y-4 leading-relaxed text-soft lg:col-span-5 lg:col-start-8">
                  {paragraphs.slice(1).map((p) => (
                    <p key={p}>{p}</p>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Chapter>
      )}

      {/* 04 · Crédit du design : obligation de la licence, rendue côté serveur. */}
      {attribution && (
        <Chapter
          id={chapter("credit").id}
          number={chapter("credit").number}
          title={tCat("product.titles.credit")}
          eyebrow={chapter("credit").label}
          className="border-t border-line"
        >
          <div className="s3d-page mt-10">
            <AttributionBlock attribution={attribution} locale={locale} />
          </div>
        </Chapter>
      )}

      {/* 05 · Avis */}
      {productReviews.length > 0 && (
        <Chapter
          id={chapter("reviews").id}
          number={chapter("reviews").number}
          title={tCat("product.titles.reviews")}
          eyebrow={chapter("reviews").label}
          className="border-t border-line"
        >
          <div className="s3d-page mt-10">
            <p className="flex items-center gap-2">
              <StarRating value={ratingSummary.average} size={16} />
              <span className="s3d-num font-semibold">
                {ratingSummary.average.toFixed(1)}
              </span>
              <span className="text-sm text-soft">
                {tReviews("count", { count: ratingSummary.count })}
              </span>
            </p>
            <ul className="mt-6 max-w-[46rem] divide-y divide-line border-y border-line">
              {productReviews.map((r) => (
                <li key={r.id} className="py-5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold">{r.authorName}</span>
                    <StarRating value={r.rating} size={14} />
                  </div>
                  <p className="s3d-label mt-1 normal-case text-soft">
                    {r.createdAt.toLocaleDateString(`${locale}-CH`)}
                  </p>
                  {r.body && (
                    <p className="mt-3 leading-relaxed text-soft">{r.body}</p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </Chapter>
      )}

      {/* 06 · « Un vase à vos couleurs ? » : le modèle de Ian reste tel qu'il l'a
        dessiné ; pour une variante à soi, le Studio propose NOS modèles. */}
      {attribution && (
        <Chapter
          id={chapter("cross").id}
          number={chapter("cross").number}
          title={tCat("cross.title")}
          eyebrow={chapter("cross").label}
          intro={tCat("cross.body", { author: attribution.author })}
          className="border-t border-line"
        >
          <div className="s3d-page mt-8">
            <ButtonLink href="/studio/lavaux" variant="secondary" size="md">
              {tCat("cross.cta")}
            </ButtonLink>
          </div>
        </Chapter>
      )}

      {/* 07 · Produits liés */}
      {relatedCards.length > 0 && (
        <Chapter
          id={chapter("related").id}
          number={chapter("related").number}
          title={tCat("product.titles.related")}
          eyebrow={chapter("related").label}
          className="border-t border-line"
        >
          <div className="s3d-page mt-10">
            <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4 md:gap-x-6">
              {relatedCards.map((p) => (
                <ProductCard key={p.id} product={p} heading="h3" />
              ))}
            </div>
          </div>
        </Chapter>
      )}

      <ProductMotion />
    </PageCut>
  );
}
