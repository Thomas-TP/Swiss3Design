import { A } from "@solidjs/router";
import { useI18n } from "../i18n/context";
import { formatChfAmount } from "../lib/format";

// Version simplifiée pour l'amorçage de la Phase 5 : couleurs/stock/
// multicolore (module materials + Product.metadata) seront branchés avec la
// page produit complète et la fiche catalogue — voir docs/plan Phase 5.
export interface StoreProductSummary {
  id: string;
  title: string;
  handle: string;
  thumbnail: string | null;
  priceAmount: number | null;
}

export function ProductCard(props: { product: StoreProductSummary }) {
  const { locale } = useI18n();

  return (
    <A
      href={`/${locale()}/products/${props.product.handle}`}
      class="group flex flex-col overflow-hidden rounded-card border border-line bg-surface transition-all duration-300 hover:-translate-y-1 hover:border-soft/30 hover:shadow-xl hover:shadow-ink/[0.07] dark:hover:shadow-black/40"
    >
      <div class="relative aspect-square overflow-hidden bg-gradient-to-br from-paper to-line/40">
        {props.product.thumbnail && (
          <img
            src={props.product.thumbnail}
            alt={props.product.title}
            loading="lazy"
            decoding="async"
            class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        )}
      </div>
      <div class="flex flex-1 flex-col gap-1 p-4">
        <h3 class="font-semibold leading-snug">{props.product.title}</h3>
        {props.product.priceAmount !== null && (
          <p class="mt-2 font-semibold tabular-nums">{formatChfAmount(props.product.priceAmount, locale())}</p>
        )}
      </div>
    </A>
  );
}
