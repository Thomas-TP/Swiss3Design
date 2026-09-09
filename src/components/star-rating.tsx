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
    // oxlint-disable prefer-tag-over-role -- graphique composite (5 icones Star), aucune balise <img> n'existe pour ca ; role="img" + aria-label est le pattern WAI-ARIA standard pour l'annoncer comme une seule image
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
    // oxlint-enable prefer-tag-over-role
  );
}
