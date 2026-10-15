// Valeurs par défaut, miroir de la table `settings` (modifiables via l'admin).
// Depuis le 14.10.2026 : livraison OFFERTE partout en Suisse, sans minimum, pour
// la boutique comme pour le Studio. Le mécanisme (tarif unique Poste suisse +
// livraison offerte dès un seuil) reste : un port à 0 et un seuil à 0 sont les
// défauts du code ; les réglages `shipping_cents` et `free_shipping_over_cents`
// de la base (admin → Réglages) les remplacent s'ils existent.
export const SHIPPING_CENTS = 0;
export const FREE_SHIPPING_OVER_CENTS = 0;

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

/**
 * Port d'une commande : seule la part BOUTIQUE entre dans le calcul. Le prix
 * d'un objet du Studio est ferme, livraison comprise : une ligne du Studio ne
 * porte jamais de port, quels que soient les réglages en base. Une commande du
 * Studio seul ne paie donc jamais de port, même si les réglages valent encore
 * un tarif (bascule SQL après le déploiement).
 */
export function shippingForOrder(
  parts: { shopCents: number; studioCents: number },
  config?: { shippingCents: number; freeOverCents: number },
): number {
  if (parts.shopCents <= 0) return 0;
  return shippingFor(parts.shopCents, config);
}
