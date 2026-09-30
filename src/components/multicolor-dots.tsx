// Signature visuelle « jusqu'à 4 couleurs » (badge Multicolore des cartes et de
// la fiche). Trois teintes indicatives de la palette de filaments de la
// refonte (brief « Strates », §2.1 : Rouge Signal, Bleu Léman, Ambre) ; la
// quatrième est l'encre du thème (jeton `ink`) : noire en thème clair, blanc
// névé en thème sombre, où une encre fixe disparaîtrait sur la carte.
const HUES = ["#e5231c", "#2e6a9e", "#d98e1f"];

export function MulticolorDots({
  size = 8,
  onDark = false,
}: {
  size?: number;
  /** Fond sombre quel que soit le thème : la quatrième pastille reste claire. */
  onDark?: boolean;
}) {
  return (
    <span aria-hidden="true" className="inline-flex items-center gap-1">
      {HUES.map((hue) => (
        <span
          key={hue}
          className="rounded-full"
          style={{ width: size, height: size, backgroundColor: hue }}
        />
      ))}
      <span
        className={`rounded-full ${onDark ? "bg-night-soft" : "bg-ink"}`}
        style={{ width: size, height: size }}
      />
    </span>
  );
}
