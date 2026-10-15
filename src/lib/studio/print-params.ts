// Coefficients PHYSIQUES de l'impression (brief « Strates », §6.5 et annexe B) :
// densité du PLA, débit, purge, durées. Ils nourrissent les statistiques
// (grammes, durée, changements de `stats.ts` et `band-stats.ts`), jamais
// l'argent : le prix ferme d'un objet du Studio est dans `price.ts` (barème
// fixé par le propriétaire le 14.10.2026, achat direct au panier).

export interface PrintParams {
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

export const PRINT = {
  densityGcm3: 1.24,
  flowMm3PerS: 8,
  layerOverheadS: 1.5,
  changeSeconds: 110,
  purgeGrams: 0.8,
  setupMinutes: 6,
} as const satisfies PrintParams;
