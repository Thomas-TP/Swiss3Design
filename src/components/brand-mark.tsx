// Swiss3Design logomark — pic géométrique en couches (impression 3D additive),
// rouge de marque uniquement (pas de blanc/noir dans le mark) : un seul asset
// fonctionne aussi bien en thème clair qu'en thème sombre.

export function BrandMark({
  className,
  title,
}: {
  className?: string;
  title?: string;
}) {
  return (
    <img src="/brand/webp/mark.webp" alt={title ?? ""} className={className} />
  );
}
