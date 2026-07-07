// Valeurs par défaut, miroir de la table `settings` (modifiables via l'admin).
// Tarif unique Poste suisse + livraison offerte dès un seuil.
export const SHIPPING_CENTS = 890;
export const FREE_SHIPPING_OVER_CENTS = 6000;

export function shippingFor(subtotalCents: number): number {
  return subtotalCents >= FREE_SHIPPING_OVER_CENTS ? 0 : SHIPPING_CENTS;
}

// Medusa exprime les montants du panier en unité décimale (ex. 24), pas en
// centimes — estimation d'affichage avant que Medusa n'ajoute une méthode de
// livraison réelle au panier (ça n'arrive qu'au checkout).
export const SHIPPING_AMOUNT = SHIPPING_CENTS / 100;
export const FREE_SHIPPING_OVER_AMOUNT = FREE_SHIPPING_OVER_CENTS / 100;

export function estimateShippingAmount(subtotalAmount: number): number {
  return subtotalAmount >= FREE_SHIPPING_OVER_AMOUNT ? 0 : SHIPPING_AMOUNT;
}
