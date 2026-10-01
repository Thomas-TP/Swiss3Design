import { useTranslations } from "next-intl";
import { ProductCard } from "@/components/product-card";
import { ButtonLink } from "@/components/ui/button";
import { Chapter } from "@/components/ui/chapter";
import { cx } from "@/components/ui/cx";
import type { ProductListItem } from "@/db/queries";
import { attributionFor } from "@/lib/attribution";

// Chapitre 04 « Des objets choisis, imprimés à la commande. » (brief
// « Strates », §7.5) : N = 1 → une grande carte ; N = 2–3 → une rangée ;
// N ≥ 4 → une grille. Le catalogue live compte aujourd'hui un seul produit (le
// Vase spirale de Ian) : sa carte porte la légende d'attribution courte
// (« Design : Ian · CC BY-ND 4.0 »), le crédit complet est sur sa fiche. Les
// cartes gardent tous leurs comportements (h3 + lien étiré, favori, ajout
// rapide avec `Product Added`, source `catalog`).
const CELL: Record<"one" | "few" | "many", string> = {
  one: "col-span-full sm:col-span-6 lg:col-span-6",
  few: "col-span-full sm:col-span-4 lg:col-span-4",
  many: "col-span-full sm:col-span-4 lg:col-span-3",
};

export function ChapterShop({ products }: { products: ProductListItem[] }) {
  const t = useTranslations("landing.shop");
  const ta = useTranslations("catalog.attribution");
  const size = products.length === 1 ? "one" : products.length <= 3 ? "few" : "many";

  return (
    <Chapter
      id="boutique"
      number="04"
      title={t("title")}
      eyebrow={t("eyebrow")}
      intro={t("intro")}
    >
      <div className="s3d-page mt-12 lg:mt-16">
        {products.length === 0 ? (
          <p className="max-w-[52ch] text-soft">{t("empty")}</p>
        ) : (
          <ul className="s3d-grid gap-y-8">
            {products.map((product) => {
              const attribution = attributionFor(product.slug);
              return (
                <li key={product.id} className={cx("s3d-print", CELL[size])}>
                  <ProductCard product={product} heading="h3" />
                  {attribution ? (
                    <p className="s3d-label mt-2 normal-case text-soft">
                      {ta("short", {
                        author: attribution.author,
                        license: attribution.license,
                      })}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        <ButtonLink href="/shop" variant="secondary" className="mt-10">
          {t("all")}
        </ButtonLink>
      </div>
    </Chapter>
  );
}
