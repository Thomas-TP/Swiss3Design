// Valeurs par défaut, miroir de la table `settings` (modifiables via l'admin).
// Tarif unique Poste suisse + livraison offerte dès un seuil.
export const SHIPPING_CENTS = 890;
export const FREE_SHIPPING_OVER_CENTS = 6000;

export function shippingFor(
  subtotalCents: number,
  config = {
    shippingCents: SHIPPING_CENTS,
    freeOverCents: FREE_SHIPPING_OVER_CENTS,
  },
): number {
  return subtotalCents >= config.freeOverCents ? 0 : config.shippingCents;
}
