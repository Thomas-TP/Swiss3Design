import { ViewTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatChf } from "@/lib/format";
import { cfImage } from "@/lib/cf-image";
import type { ProductCardItem } from "@/components/product-card";
import { SiteLink } from "@/components/ui/site-link";
import { registryRef } from "./specs";
import "./morph.css";

// Vue « Registre » de la boutique (brief « Strates », §7.8) : le catalogue en
// tableau à filets, une ligne par objet (réf., vignette, nom, matière,
// dimensions, prix), pour qui compare plutôt qu'il ne flâne. Même données que
// la grille, même lien vers la fiche ; la vignette porte le nom de transition
// `product-<slug>` (un seul des deux affichages est rendu à la fois, donc jamais
// deux fois le même nom). Un vrai <table> : en-têtes, portée des cellules, lu
// tel quel par les lecteurs d'écran. Sous sm, matière et dimensions passent
// dans la cellule du nom (une ligne reste lisible sur 375 px).
export function RegistryTable({ products }: { products: ProductCardItem[] }) {
  const t = useTranslations("catalog.shop.registry");
  const tp = useTranslations("product");
  const locale = useLocale();

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">{t("caption")}</caption>
        <thead>
          <tr className="s3d-label border-y border-ink text-soft">
            <th scope="col" className="py-3 pr-4 font-medium">
              {t("ref")}
            </th>
            {/* Colonne des vignettes : libellée pour les lecteurs d'écran. */}
            <th
              scope="col"
              aria-label={t("image")}
              className="py-3 pr-4 font-medium"
            />
            <th scope="col" className="py-3 pr-4 font-medium">
              {t("name")}
            </th>
            <th
              scope="col"
              className="hidden py-3 pr-4 font-medium sm:table-cell"
            >
              {tp("material")}
            </th>
            <th
              scope="col"
              className="hidden py-3 pr-4 font-medium md:table-cell"
            >
              {tp("dimensions")}
            </th>
            <th scope="col" className="py-3 text-right font-medium">
              {t("price")}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line border-b border-line">
          {products.map((product, index) => (
            <tr key={product.id} className="hover:bg-surface">
              <td className="s3d-label py-3 pr-4 align-middle text-soft">
                {registryRef(index)}
              </td>
              {/* oxlint-disable control-has-associated-label -- cellule de
                vignette décorative (alt vide) : le nom de l'objet est dans la
                cellule suivante, l'en-tête de colonne est libellé. */}
              <td className="w-20 py-3 pr-4 align-middle">
                {/* oxlint-enable control-has-associated-label */}
                <ViewTransition
                  name={`product-${product.slug}`}
                  share="morph"
                  default="none"
                >
                  <div className="aspect-square w-16 overflow-hidden rounded-field border border-line bg-surface">
                    {product.imageUrl && (
                      <img
                        src={cfImage(product.imageUrl, { width: 200 })}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                </ViewTransition>
              </td>
              <th
                scope="row"
                className="py-3 pr-4 align-middle font-display font-bold tracking-tight text-ink"
              >
                <SiteLink
                  href={`/products/${product.slug}`}
                  coupe={false}
                  className="underline decoration-line decoration-1 underline-offset-4 hover:decoration-ink"
                >
                  {product.name}
                </SiteLink>
                <span className="s3d-label mt-1 block font-normal normal-case text-soft sm:hidden">
                  {[product.material, product.dimensionsMm]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </th>
              <td className="hidden py-3 pr-4 align-middle text-sm sm:table-cell">
                {product.material}
              </td>
              <td className="s3d-num hidden py-3 pr-4 align-middle text-sm md:table-cell">
                {product.dimensionsMm ?? ""}
              </td>
              <td className="s3d-num py-3 text-right align-middle font-semibold text-ink">
                {formatChf(product.priceCents, locale)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
