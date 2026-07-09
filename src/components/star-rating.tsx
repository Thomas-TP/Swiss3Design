import { Star } from "lucide-react";

// Affichage statique d'une note 0–5 en étoiles (arrondie à l'entier le plus
// proche). Utilisé sur la fiche produit et la synthèse d'avis.
export function StarRating({
  value,
  size = 16,
}: {
  value: number;
  size?: number;
}) {
  const rounded = Math.round(value);
  return (
    <span
      role="img"
      className="inline-flex items-center"
      aria-label={`${value.toFixed(1)}/5`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={size}
          className={n <= rounded ? "fill-accent text-accent" : "text-line"}
        />
      ))}
    </span>
  );
}
