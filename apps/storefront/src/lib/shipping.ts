// Miroir de src/lib/shipping.ts côté app Next.js. Le calcul réel des frais de
// port au panier reste toujours Medusa (Price Rules Phase 2) — ces constantes
// ne servent qu'à l'affichage marketing ("Offert dès 60 CHF").
export const SHIPPING_CENTS = 890;
export const FREE_SHIPPING_OVER_CENTS = 6000;

// Medusa exprime les montants du panier en unité décimale (ex. 24), pas en
// centimes — estimation d'affichage avant que Medusa n'ajoute une méthode de
// livraison réelle au panier (ça n'arrive qu'au checkout, Phase 2).
export const SHIPPING_AMOUNT = SHIPPING_CENTS / 100;
export const FREE_SHIPPING_OVER_AMOUNT = FREE_SHIPPING_OVER_CENTS / 100;

export function estimateShippingAmount(subtotalAmount: number): number {
  return subtotalAmount >= FREE_SHIPPING_OVER_AMOUNT ? 0 : SHIPPING_AMOUNT;
}
