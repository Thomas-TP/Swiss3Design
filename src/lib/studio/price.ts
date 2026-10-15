// Prix FERME d'un objet du Studio (décision du propriétaire du 14.10.2026 :
// achat direct, panier puis paiement, comme un produit de la boutique ; il
// remplace la fourchette et le devis). Livraison comprise (voir shipping.ts :
// une ligne du Studio ne porte jamais de port).
//
// Pour une ligne de quantité q (1 à 20), avec les chiffres d'UNE pièce
// (`computeStats` : grammes et changements de couleur), en centimes CHF :
//
//   brut par pièce = (F + changements × 150) / q + U + grammes × r
//
//   F : fixe par ligne (préparation, une fois), U : par pièce, r : centimes par
//   gramme, 150 centimes par changement de couleur, comptés UNE FOIS par ligne.
//
//   q = 1 : prix arrondi au « ,90 » le plus proche, round((x − 90) / 100) × 100 + 90
//   q ≥ 2 : prix unitaire arrondi aux 10 centimes les plus proches
//   total de la ligne = prix unitaire × q
//
// Ce module est PUR et LÉGER (aucun import de `computeStats` ni de géométrie) :
// le panier du navigateur s'en sert pour recalculer le prix d'une ligne quand
// la quantité change, sans moteur. Le serveur, lui, ne croit jamais un prix du
// navigateur : il refait tout (purchase.ts → price-figures.ts → ce module).
//
// Arithmétique ENTIÈRE (règle d'or 5) : on calcule R = 10 × q × brut, un entier
// (les grammes ont une décimale, donc grammes × 10 est entier). Les arrondis
// « au plus proche, 0,5 vers le haut » deviennent des divisions entières, sans
// la moindre dérive de virgule flottante entre le Worker et le navigateur.
import type { StudioObjectId } from "./types";

/** Version du barème, écrite dans la ligne de commande (traçabilité). */
export const PRICE_VERSION = 1;

/** Quantité maximale d'une ligne ; au-delà : demande particulière (devis). */
export const STUDIO_QTY_MAX = 20;

/** Lignes du Studio distinctes au plus, dans un panier et dans une commande. */
export const STUDIO_MAX_LINES = 10;

/**
 * Langue des chiffres qui servent au PRIX. L'étiquette d'altitude de la Montagne
 * s'écrit selon la langue (« 2 566 » en français, « 2’566 » ailleurs) : les
 * grammes changent de quelques dixièmes. Le prix ne doit pas dépendre de la
 * langue de la page : on calcule toujours en français.
 */
export const PRICE_LOCALE = "fr" as const;

/** Surcoût d'un changement de couleur (centimes), une fois par ligne. */
export const CHANGE_CENTS = 150;

/** Barème par objet : F fixe par ligne, U par pièce (centimes), r centimes par gramme. */
export const STUDIO_RATES: Readonly<
  Record<StudioObjectId, { F: number; U: number; r: number }>
> = {
  lavaux: { F: 1200, U: 1050, r: 21 },
  montagne: { F: 1200, U: 1050, r: 62 },
  cartouche: { F: 1250, U: 250, r: 10 },
  borne: { F: 950, U: 1310, r: 30 },
};

/** Les seuls chiffres du prix : ceux d'une pièce (grammes à 0,1 g près, changements). */
export interface PriceFigures {
  grams: number;
  changes: number;
}

/** Quantité entière de la ligne, ramenée à 1..STUDIO_QTY_MAX. */
export function clampQuantity(quantity: number): number {
  const q = Math.trunc(quantity);
  if (!Number.isFinite(q) || q < 1) return 1;
  return Math.min(STUDIO_QTY_MAX, q);
}

/** Prix unitaire (centimes entiers CHF) d'une ligne de `quantity` pièces. */
export function studioUnitCents(
  object: StudioObjectId,
  figures: PriceFigures,
  quantity: number,
): number {
  const q = clampQuantity(quantity);
  const { F, U, r } = STUDIO_RATES[object];
  // Dixièmes de gramme : les grammes sont déjà arrondis à 0,1 g par computeStats.
  const tenthsOfGram = Math.round(figures.grams * 10);
  // R = 10 × q × brut (centimes) : entier.
  const scaled =
    10 * (F + CHANGE_CENTS * figures.changes) +
    10 * q * U +
    q * tenthsOfGram * r;
  if (q === 1) {
    // brut = scaled / 10 ; round((brut − 90) / 100) = floor((scaled − 400) / 1000).
    return Math.floor((scaled - 400) / 1000) * 100 + 90;
  }
  // round(brut / 10) = floor((scaled + 50 q) / (100 q)).
  return Math.floor((scaled + 50 * q) / (100 * q)) * 10;
}

/** Total de la ligne (centimes) : prix unitaire × quantité. */
export function studioLineCents(
  object: StudioObjectId,
  figures: PriceFigures,
  quantity: number,
): number {
  const q = clampQuantity(quantity);
  return studioUnitCents(object, figures, q) * q;
}
