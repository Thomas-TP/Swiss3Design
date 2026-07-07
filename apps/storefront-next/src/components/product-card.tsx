import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { formatChfAmount } from "@/lib/format";
import { MulticolorDots } from "./multicolor-dots";
import { FavoriteButton } from "./favorite-button";

// Miroir de src/components/product-card.tsx côté app Next.js racine, adapté
// aux données Medusa. **Scope volontairement réduit pour l'amorçage** :
// pastilles de couleur et ajout rapide au panier nécessitent une requête
// supplémentaire par produit (route Store /store/products/:id/colors,
// Phase 5) - listing en masse (catalogue, page d'accueil) en ferait du N+1 ;
// à batcher proprement avant de les réintroduire ici.
export interface StoreProductSummary {
  id: string;
  title: string;
  handle: string;
  thumbnail: string | null;
  priceAmount: number | null;
  multicolor: boolean;
}

export function ProductCard({ product }: { product: StoreProductSummary }) {
  const t = useTranslations("product");
  const locale = useLocale();

  const favoriteItem = {
    productId: product.id,
    name: product.title,
    slug: product.handle,
    priceAmount: product.priceAmount ?? 0,
    imageUrl: product.thumbnail,
  };

  return (
    <Link
      href={`/products/${product.handle}`}
      className="group flex flex-col overflow-hidden rounded-card border border-line bg-surface transition-all duration-300 hover:-translate-y-1 hover:border-soft/30 hover:shadow-xl hover:shadow-ink/[0.07] dark:hover:shadow-black/40"
    >
      <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-paper to-line/40">
        {product.thumbnail && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.thumbnail}
            alt={product.title}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        )}
        {product.multicolor && (
          <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-surface/90 px-2.5 py-1 text-[11px] font-semibold backdrop-blur">
            <MulticolorDots size={6} />
            {t("multicolorBadge")}
          </span>
        )}
        <FavoriteButton
          item={favoriteItem}
          className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-surface/90 backdrop-blur"
        />
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <h3 className="font-semibold leading-snug">{product.title}</h3>
        {product.priceAmount !== null && (
          <p className="mt-2 font-semibold tabular-nums">{formatChfAmount(product.priceAmount, locale)}</p>
        )}
      </div>
    </Link>
  );
}
