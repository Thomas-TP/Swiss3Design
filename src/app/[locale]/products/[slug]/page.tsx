import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { ArrowLeft, Truck, Factory, ShieldCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
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
import { ProductCard } from "@/components/product-card";
import { StarRating } from "@/components/star-rating";

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
    tHome,
    tSeo,
    tShop,
    shippingSettings,
  ] = await Promise.all([
    getRelatedProducts(product.id, locale),
    getPublishedReviews(product.id),
    getRatingSummary(product.id),
    getTranslations("reviews"),
    getTranslations("home"),
    getTranslations("seo"),
    getTranslations("shop"),
    getShippingSettings(),
  ]);

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
    { label: t("material"), value: product.material },
    { label: t("dimensions"), value: product.dimensionsMm },
    {
      label: t("weight"),
      value: product.weightGrams ? `${product.weightGrams} g` : null,
    },
    {
      label: t("productionTime"),
      value:
        product.saleType === "on_demand"
          ? t("productionDays", { days: product.productionDays ?? 3 })
          : null,
    },
    { label: t("origin"), value: t("originValue") },
  ].filter((s) => s.value);
  // Paragraphes saisis à l'admin (ligne vide = nouveau paragraphe) : une
  // description structurée se lit mieux et se découpe mieux pour les moteurs.
  const paragraphs = product.description
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 md:py-16">
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
      <Link
        href="/shop"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-soft transition-colors hover:text-ink"
      >
        <ArrowLeft size={15} />
        {t("backToShop")}
      </Link>

      <ProductColorProvider colors={product.colors}>
        <div className="grid gap-8 md:grid-cols-2 md:gap-14">
          <div>
            <ProductGallery
              images={product.images}
              name={product.name}
              model3dUrl={product.model3dUrl}
            />
          </div>

          <div className="flex flex-col md:sticky md:top-24 md:self-start">
            {product.multicolor && (
              <span className="flex w-fit items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold">
                <MulticolorDots size={6} />
                {t("multicolorBadge")}
              </span>
            )}

            <h1 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
              {product.name}
            </h1>
            {/* Premier paragraphe = résumé (et meta description) : juste sous
                le titre ; la suite vient après l'achat, qui reste visible. */}
            {paragraphs[0] && (
              <p className="mt-4 leading-relaxed text-soft">{paragraphs[0]}</p>
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
              la page. Libellés partagés avec la homepage. */}
            <ul className="mt-6 grid gap-2 text-sm sm:grid-cols-3">
              {[
                { Icon: Truck, label: tHome("trustShippingTitle") },
                { Icon: Factory, label: tHome("trustMadeTitle") },
                { Icon: ShieldCheck, label: tHome("trustPaymentTitle") },
              ].map(({ Icon, label }) => (
                <li
                  key={label}
                  className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2.5"
                >
                  <Icon
                    size={16}
                    strokeWidth={1.8}
                    className="shrink-0 text-accent"
                  />
                  <span className="text-xs font-semibold leading-tight">
                    {label}
                  </span>
                </li>
              ))}
            </ul>

            {paragraphs.length > 1 && (
              <div className="mt-8 space-y-3 text-[15px] leading-relaxed text-soft">
                {paragraphs.slice(1).map((p) => (
                  <p key={p}>{p}</p>
                ))}
              </div>
            )}

            {specs.length > 0 && (
              <div className="mt-8 border-t border-line text-sm">
                <p className="border-b border-line pt-4 font-semibold">
                  {t("details")}
                </p>
                <dl aria-label={t("details")} className="divide-y divide-line">
                  {specs.map((s) => (
                    <div
                      key={s.label}
                      className="flex justify-between gap-4 py-3"
                    >
                      <dt className="shrink-0 text-soft">{s.label}</dt>
                      <dd className="text-right font-medium">{s.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>
        </div>
      </ProductColorProvider>

      {productReviews.length > 0 && (
        <section className="mt-16 md:mt-24">
          <span className="flex h-1 w-10 rounded-full bg-accent" />
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <h2 className="text-2xl font-bold tracking-tight">
              {tReviews("title")}
            </h2>
            <span className="flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1">
              <StarRating value={ratingSummary.average} size={14} />
              <span className="text-sm font-semibold tabular-nums">
                {ratingSummary.average.toFixed(1)}
              </span>
              <span className="text-xs text-soft">
                {tReviews("count", { count: ratingSummary.count })}
              </span>
            </span>
          </div>
          <ul className="mt-6 space-y-4">
            {productReviews.map((r) => (
              <li
                key={r.id}
                className="rounded-card border border-line bg-surface p-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold">{r.authorName}</span>
                  <StarRating value={r.rating} size={14} />
                </div>
                <p className="mt-1 text-xs text-soft">
                  {r.createdAt.toLocaleDateString(`${locale}-CH`)}
                </p>
                {r.body && (
                  <p className="mt-3 leading-relaxed text-soft">{r.body}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {related.length > 0 && (
        <section className="mt-16 md:mt-24">
          <span className="flex h-1 w-10 rounded-full bg-accent" />
          <h2 className="mt-3 text-2xl font-bold tracking-tight">
            {t("relatedTitle")}
          </h2>
          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
