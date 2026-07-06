import { For } from "solid-js";
import { Star } from "lucide-solid";

// Affichage statique d'une note 0-5 en étoiles (arrondie à l'entier le plus
// proche) - miroir de src/components/star-rating.tsx côté app Next.js.
export function StarRating(props: { value: number; size?: number }) {
  const rounded = () => Math.round(props.value);
  return (
    <span class="inline-flex items-center" aria-label={`${props.value.toFixed(1)}/5`}>
      <For each={[1, 2, 3, 4, 5]}>
        {(n) => (
          <Star
            size={props.size ?? 16}
            class={n <= rounded() ? "fill-accent text-accent" : "text-line"}
          />
        )}
      </For>
    </span>
  );
}
