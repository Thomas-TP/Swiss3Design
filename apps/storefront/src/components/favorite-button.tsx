import { Heart } from "lucide-solid";
import { useI18n } from "../i18n/context";
import { useFavorites, type FavoriteItem } from "../lib/favorites";

// Miroir de src/components/favorite-button.tsx côté app Next.js.
export function FavoriteButton(props: { item: FavoriteItem; size?: number; class?: string }) {
  const { t } = useI18n();
  const { has, toggle } = useFavorites();
  const active = () => has(props.item.productId);

  return (
    <button
      type="button"
      onClick={(e) => {
        // Le bouton vit parfois dans une carte-lien : on bloque la navigation.
        e.preventDefault();
        e.stopPropagation();
        toggle(props.item);
      }}
      aria-label={active() ? t("favorites.remove") : t("favorites.add")}
      aria-pressed={active()}
      class={`transition-all active:scale-90 ${props.class ?? ""}`}
    >
      <Heart
        size={props.size ?? 18}
        stroke-width={1.8}
        class={`transition-colors ${active() ? "fill-accent text-accent" : "text-soft hover:text-ink"}`}
      />
    </button>
  );
}
