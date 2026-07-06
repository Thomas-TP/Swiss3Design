// Miroir de src/lib/shipping.ts côté app Next.js. Le calcul réel des frais de
// port au panier reste toujours Medusa (Price Rules Phase 2) — ces constantes
// ne servent qu'à l'affichage marketing ("Offert dès 60 CHF").
export const SHIPPING_CENTS = 890;
export const FREE_SHIPPING_OVER_CENTS = 6000;
