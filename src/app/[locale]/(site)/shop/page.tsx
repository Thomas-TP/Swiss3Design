import type { Metadata } from "next";
import { Search } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { getUsedFilters, getProducts, type ProductSort } from "@/db/queries";
import { collectionJsonLd, pageMetadata } from "@/lib/seo";
import { JsonLd } from "@/components/json-ld";
import { TrackEvent } from "@/components/track-event";
import { ProductCard, type ProductCardItem } from "@/components/product-card";
import { PageHeader } from "@/components/page-header";
import { PageCut } from "@/components/ui/page-cut";
import { SiteLink } from "@/components/ui/site-link";
import { ButtonLink } from "@/components/ui/button";
import { chipClass } from "@/components/ui/chip";
import { cx } from "@/components/ui/cx";
import { fieldClass } from "@/components/ui/field";
import { getCardExtras } from "@/components/catalog/card-extras";
import { ProductPlate } from "@/components/catalog/product-plate";
import { RegistryTable } from "@/components/catalog/registry-table";
import { ShopCollection } from "@/components/catalog/shop-collection";
import { FileLine, StudioRow } from "@/components/catalog/studio-row";

export const dynamic = "force-dynamic";

// Toutes les variantes filtrées/triées (?category=, ?sort=…) déclarent le
// catalogue nu comme canonical : une seule page indexable, pas de contenu
// dupliqué. Les combinaisons de facettes sont en plus fermées au crawl dans
// robots.ts (piège à robots : des centaines d'URL pour quelques produits).
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "seo" });
  return pageMetadata({
    locale,
    path: "/shop",
    title: t("shopTitle"),
    description: t("shopDescription"),
    imageAlt: t("ogImageAlt"),
  });
}

const SORTS: ProductSort[] = ["new", "price_asc", "price_desc"];

// Au plus N produits : une planche par produit plutôt qu'une grille presque
// vide (brief « Strates », §7.8). Au-delà, ou dès qu'un filtre est actif, la
// grille et ses filtres.
const PLATE_MAX = 2;

function hrefFor(query: Record<string, string | undefined>) {
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(query)) if (v) clean[k] = v;
  return { pathname: "/shop" as const, query: clean };
}

export default async function ShopPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{
    category?: string;
    material?: string;
    color?: string;
    multicolor?: string;
    sort?: string;
    q?: string;
  }>;
}) {
  const { locale } = await params;
  const { category, material, color, multicolor, sort, q } = await searchParams;
  const searchParam = q?.trim() || undefined;
  const multicolorOn = multicolor === "1";
  // Le filtre multicolore n'apparaît que si un produit l'utilise — ou s'il est
  // déjà actif, pour pouvoir le désélectionner.
  const activeSort: ProductSort = SORTS.includes(sort as ProductSort)
    ? (sort as ProductSort)
    : "new";
  const sortParam = activeSort === "new" ? undefined : activeSort;
  const multicolorParam = multicolorOn ? "1" : undefined;

  // Tous les liens de filtre conservent la recherche courante (?q=).
  const linkFor = (query: Parameters<typeof hrefFor>[0]) =>
    hrefFor({ ...query, q: searchParam });

  const [t, tc, tSeo, filters, listed] = await Promise.all([
    getTranslations("shop"),
    getTranslations("catalog.shop"),
    getTranslations("seo"),
    getUsedFilters(locale),
    getProducts(locale, {
      categorySlug: category,
      material,
      color,
      multicolor: multicolorOn,
      sort: activeSort,
      q: searchParam,
    }),
  ]);

  // Dimensions, poids et 2ᵉ photo : une lecture groupée pour toute la liste.
  const extras = await getCardExtras(listed.map((p) => p.id));
  const products: ProductCardItem[] = listed.map((p) => ({
    ...p,
    dimensionsMm: extras.get(p.id)?.dimensionsMm ?? null,
    secondImage: extras.get(p.id)?.secondImage ?? null,
  }));

  // Le schéma ItemList ne décrit que le catalogue complet (la page canonique),
  // pas une vue filtrée. Même critère pour la planche éditoriale : un filtre
  // actif donne toujours la grille et sa liste de résultats.
  const isFullCatalog =
    !category && !material && !color && !multicolorOn && !searchParam;
  const plates = isFullCatalog && products.length <= PLATE_MAX;

  return (
    <PageCut>
      <div className="s3d-page pb-section pt-10 md:pt-16">
        {isFullCatalog && (
          <JsonLd
            data={collectionJsonLd({
              locale,
              name: tSeo("shopTitle"),
              description: tSeo("shopDescription"),
              products: listed,
            })}
          />
        )}
        <PageHeader
          eyebrow={tc("eyebrow")}
          title={tc("title")}
          intro={t("subtitle")}
        />
        {/* Recherches sans résultat = produits que les visiteurs attendent. */}
        {searchParam && (
          <TrackEvent
            event="Products Searched"
            properties={{ query: searchParam, results: products.length }}
          />
        )}
        {(category || material || color || multicolorOn || sortParam) && (
          <TrackEvent
            event="Product List Filtered"
            properties={{
              category,
              material,
              color,
              multicolor: multicolorOn || undefined,
              sort: sortParam,
              results: products.length,
            }}
          />
        )}

        {plates ? (
          <div className="mt-12 md:mt-16">
            {products.length === 0 ? (
              <p className="max-w-[46rem] text-lead text-soft">
                {tc("emptyCatalog")}
              </p>
            ) : (
              <div className="space-y-12 md:space-y-16">
                {products.map((p, index) => (
                  <ProductPlate
                    key={p.id}
                    product={p}
                    index={index}
                    primary={index === 0}
                    weightGrams={extras.get(p.id)?.weightGrams ?? null}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Filtres en puces : des LIENS (rendu serveur, sans JS), la
              recherche un formulaire GET dont les champs cachés gardent les
              filtres actifs. Aucun paramètre d'URL de plus (robots, analytics). */}
            <div className="mt-10 border-t border-line pt-6">
              <form
                action={`/${locale}/shop`}
                className="relative mb-5 max-w-[32rem]"
              >
                <Search
                  aria-hidden="true"
                  size={16}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-soft"
                />
                <input
                  type="search"
                  name="q"
                  defaultValue={searchParam ?? ""}
                  placeholder={t("searchPlaceholder")}
                  aria-label={t("searchPlaceholder")}
                  className={cx(fieldClass, "pl-10")}
                />
                {category && (
                  <input type="hidden" name="category" value={category} />
                )}
                {material && (
                  <input type="hidden" name="material" value={material} />
                )}
                {color && <input type="hidden" name="color" value={color} />}
                {multicolorParam && (
                  <input
                    type="hidden"
                    name="multicolor"
                    value={multicolorParam}
                  />
                )}
                {sortParam && (
                  <input type="hidden" name="sort" value={sortParam} />
                )}
              </form>
              <div className="flex flex-wrap gap-2">
                <SiteLink
                  href={linkFor({
                    material,
                    color,
                    multicolor: multicolorParam,
                    sort: sortParam,
                  })}
                  aria-current={!category ? "true" : undefined}
                  className={chipClass(!category)}
                >
                  {t("all")}
                </SiteLink>
                {filters.categories.map((c) => (
                  <SiteLink
                    key={c.id}
                    href={linkFor({
                      category: c.slug,
                      material,
                      color,
                      multicolor: multicolorParam,
                      sort: sortParam,
                    })}
                    aria-current={category === c.slug ? "true" : undefined}
                    className={chipClass(category === c.slug)}
                  >
                    {c.name}
                  </SiteLink>
                ))}
                {(filters.materials.length > 0 ||
                  filters.multicolor ||
                  multicolorOn) && (
                  <span
                    aria-hidden="true"
                    className="mx-1 hidden w-px self-stretch bg-line sm:block"
                  />
                )}
                {filters.materials.map((m) => (
                  <SiteLink
                    key={m}
                    href={linkFor({
                      category,
                      material: material === m ? undefined : m,
                      color,
                      multicolor: multicolorParam,
                      sort: sortParam,
                    })}
                    aria-current={material === m ? "true" : undefined}
                    className={chipClass(material === m)}
                  >
                    {m}
                  </SiteLink>
                ))}
                {(filters.multicolor || multicolorOn) && (
                  <SiteLink
                    href={linkFor({
                      category,
                      material,
                      color,
                      multicolor: multicolorOn ? undefined : "1",
                      sort: sortParam,
                    })}
                    aria-current={multicolorOn ? "true" : undefined}
                    className={chipClass(multicolorOn)}
                  >
                    {t("filterMulticolor")}
                  </SiteLink>
                )}
              </div>

              {(filters.colors.length > 0 || color) && (
                <div className="mt-4 flex flex-wrap items-center gap-2.5">
                  <span className="s3d-label text-soft">
                    {t("filterColor")}
                  </span>
                  {filters.colors.map((c) => {
                    const active = color === c.name;
                    return (
                      <SiteLink
                        key={c.name}
                        href={linkFor({
                          category,
                          material,
                          color: active ? undefined : c.name,
                          multicolor: multicolorParam,
                          sort: sortParam,
                        })}
                        title={c.name}
                        aria-current={active ? "true" : undefined}
                        className={cx(
                          "h-7 w-7 rounded-full border transition-transform duration-300 ease-purge hover:scale-105",
                          active
                            ? "border-ink ring-2 ring-ink ring-offset-2 ring-offset-paper"
                            : "border-swatch-ring",
                        )}
                        style={{ backgroundColor: c.hex }}
                      >
                        {/* Texte d'ancre réel (masqué) plutôt qu'un aria-label :
                          lecteurs d'écran ET robots (Semrush signale les liens
                          sans ancre) lisent le nom de la couleur. */}
                        <span className="sr-only">{c.name}</span>
                      </SiteLink>
                    );
                  })}
                </div>
              )}
            </div>

            {products.length === 0 ? (
              <div className="mt-10">
                <div className="border-y border-line py-12">
                  <p className="text-lead text-soft">{t("empty")}</p>
                  <ButtonLink
                    href="/shop"
                    variant="secondary"
                    size="md"
                    className="mt-6"
                  >
                    {t("all")}
                  </ButtonLink>
                </div>
              </div>
            ) : (
              <div className="mt-8">
                <ShopCollection
                  summary={
                    <p className="s3d-label normal-case text-soft">
                      {t("results", { count: products.length })}
                    </p>
                  }
                  sort={
                    <div className="flex items-center gap-2">
                      <span className="s3d-label text-soft">
                        {t("sortLabel")}
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {SORTS.map((s) => (
                          <SiteLink
                            key={s}
                            href={linkFor({
                              category,
                              material,
                              color,
                              multicolor: multicolorParam,
                              sort: s === "new" ? undefined : s,
                            })}
                            aria-current={activeSort === s ? "true" : undefined}
                            className={cx(
                              chipClass(activeSort === s),
                              "min-h-8 px-3 py-1 text-xs",
                            )}
                          >
                            {t(
                              s === "new"
                                ? "sortNew"
                                : s === "price_asc"
                                  ? "sortPriceAsc"
                                  : "sortPriceDesc",
                            )}
                          </SiteLink>
                        ))}
                      </div>
                    </div>
                  }
                  grid={
                    <div className="grid grid-cols-1 gap-x-4 gap-y-10 min-[480px]:grid-cols-2 lg:grid-cols-3 lg:gap-x-6">
                      {products.map((p, index) => (
                        <ProductCard
                          key={p.id}
                          product={p}
                          priority={index < 3}
                        />
                      ))}
                    </div>
                  }
                  registry={<RegistryTable products={products} />}
                />
              </div>
            )}
          </>
        )}

        {/* À régler au Studio : des objets de l'atelier, pas des produits (aucun
          prix fixe). Rangée et lien « J'ai un fichier » hors d'une vue filtrée,
          sauf si elle ne donne rien : c'est alors l'état vide utile. */}
        {(isFullCatalog || products.length === 0) && (
          <>
            <StudioRow className="mt-16 md:mt-24" />
            <FileLine className="mt-12 md:mt-16" />
          </>
        )}
      </div>
    </PageCut>
  );
}
