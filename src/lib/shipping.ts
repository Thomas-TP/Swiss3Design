// Valeurs par défaut, miroir de la table `settings` (modifiables via l'admin).
// Tarif unique Poste suisse + livraison offerte dès un seuil.
export const SHIPPING_CENTS = 890;
export const FREE_SHIPPING_OVER_CENTS = 6000;

// Délai annoncé, en jours : préparation avant remise à la Poste (1 à 3 jours
// ouvrés pour une pièce en stock, cf. /legal/shipping ; délai de production de
// la fiche + 2 de marge pour une impression à la demande), puis acheminement.
// Une seule promesse, partagée par le JSON-LD Google et le flux des agents IA.
export const TRANSIT_DAYS = { min: 1, max: 3 } as const;

export function handlingDays(p: {
  saleType: "stock" | "on_demand";
  productionDays: number | null;
}) {
  const production = p.saleType === "on_demand" ? (p.productionDays ?? 3) : 1;
  return { min: production, max: production + 2 };
}

export function deliveryDays(p: {
  saleType: "stock" | "on_demand";
  productionDays: number | null;
}) {
  const handling = handlingDays(p);
  return {
    min: handling.min + TRANSIT_DAYS.min,
    max: handling.max + TRANSIT_DAYS.max,
  };
}

export function shippingFor(
  subtotalCents: number,
  config = {
    shippingCents: SHIPPING_CENTS,
    freeOverCents: FREE_SHIPPING_OVER_CENTS,
  },
): number {
  return subtotalCents >= config.freeOverCents ? 0 : config.shippingCents;
}
