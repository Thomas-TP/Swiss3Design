// Lecture des mesures d'un produit pour l'affichage « l'unité réelle d'abord »
// (brief « Strates », §1.6 : « Hauteur 209 mm » avant tout clin d'œil
// cartographique). `products.dimensions_mm` est un TEXTE libre saisi à l'admin
// (« 79×79×209 mm » en production, « 120 × 120 × 220 mm » dans la démo) : on
// n'invente rien, on n'affiche une hauteur que si le texte en contient une.

const NUMBER = /\d+(?:[.,]\d+)?/g;

/**
 * Hauteur en mm d'un texte de dimensions « L × l × H » (séparateur libre :
 * ×, x, *), ou null s'il n'y a pas trois valeurs : avec deux, rien ne dit
 * laquelle serait la hauteur, et une hauteur devinée est un chiffre décoratif.
 * « cm » dans le texte met les trois valeurs à l'échelle.
 */
export function heightMmOf(
  dimensions: string | null | undefined,
): number | null {
  if (!dimensions) return null;
  const values = (dimensions.match(NUMBER) ?? []).map((v) =>
    Number(v.replace(",", ".")),
  );
  if (values.length !== 3 || values.some((v) => !Number.isFinite(v) || v <= 0))
    return null;
  const scale = /\bcm\b/i.test(dimensions) ? 10 : 1;
  const height = values[2] * scale;
  // Une « hauteur » au-delà de 5 m est une faute de saisie, pas une mesure.
  return height <= 5000 ? height : null;
}

/** Référence de planche ou de ligne du Registre : « 001 », « 012 ». */
export function registryRef(index: number): string {
  return String(index + 1).padStart(3, "0");
}
