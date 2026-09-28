// Swiss3Design logomark — pic géométrique en couches (impression 3D additive),
// rouge de marque uniquement (pas de blanc/noir dans le mark) : un seul asset
// fonctionne aussi bien en thème clair qu'en thème sombre.
//
// Règles du brief « Strates » (§2.4) : raster public/brand/webp/mark.webp
// (224 × 224), jamais recoloré ni déformé (object-contain, rapport 1:1 figé),
// 24 px minimum, zone de protection de 0,5 × sa hauteur autour (à laisser par
// l'appelant), animé seulement en opacité ou en échelle. Largeur et hauteur
// intrinsèques posées : le navigateur réserve le carré avant le décodage
// (aucun décalage de mise en page, CLS), la classe de l'appelant fixe la
// taille affichée. Décoratif par défaut (alt vide) : le lien qui l'entoure
// porte déjà « Swiss3Design ».

const MARK_SIZE = 224;

export function BrandMark({
  className,
  title,
}: {
  className?: string;
  title?: string;
}) {
  return (
    <img
      src="/brand/webp/mark.webp"
      alt={title ?? ""}
      width={MARK_SIZE}
      height={MARK_SIZE}
      decoding="async"
      draggable={false}
      className={`aspect-square shrink-0 object-contain ${className ?? ""}`}
    />
  );
}
