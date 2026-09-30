// Coefficients de l'estimation (brief « Strates », §6.5). VALEURS À VALIDER
// PAR LE PROPRIÉTAIRE (§11.2) : tant que `validated` vaut false, aucun prix
// n'est affiché, seulement grammes, durée et changements (règle « aucun CHF
// avant validation des coefficients »). Le serveur ne recalcule rien en v1
// (aucun paiement : tout passe par un devis relu par l'atelier).

export interface PricingParams {
  /** false : aucun CHF affiché. */
  validated: boolean;
  /** Plancher du prix (centimes CHF). */
  floorCents: number;
  /** Préparation du fichier et de la machine (centimes). */
  setupCents: number;
  centsPerGram: number;
  centsPerHour: number;
  centsPerChange: number;
  /** Multiplicateur de marge (1 = aucune). */
  margin: number;
  /** Demi-largeur de la fourchette (%) : ±15 avant calibration, ±8 après 3 pièces pesées. */
  rangePct: number;
  /** Arrondi des bornes (centimes) : 50 = 0,50 CHF. */
  roundToCents: number;
  densityGcm3: number;
  /** Débit volumique moyen (mm³/s). */
  flowMm3PerS: number;
  /** Surcoût par couche (s). */
  layerOverheadS: number;
  /** Durée d'un changement de filament (s). */
  changeSeconds: number;
  /** Purge par changement (g). */
  purgeGrams: number;
  /** Chauffe, nivellement, décollage (minutes). */
  setupMinutes: number;
}

export const PRICING = {
  validated: false, // false : aucun CHF affiché, seulement grammes, durée, changements
  floorCents: 900,
  setupCents: 400,
  centsPerGram: 8,
  centsPerHour: 300,
  centsPerChange: 60,
  margin: 1.0,
  rangePct: 15,
  roundToCents: 50,
  densityGcm3: 1.24,
  flowMm3PerS: 8,
  layerOverheadS: 1.5,
  changeSeconds: 110,
  purgeGrams: 0.8,
  setupMinutes: 6,
} as const satisfies PricingParams;
