// Numéro de commande lisible (horodatage base 36 + 4 caractères aléatoires),
// partagé par le checkout web et les commandes d'agents IA. La contrainte
// UNIQUE de `orders.order_number` tranche en dernier recours.
export function makeOrderNumber(): string {
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `S3D-${Date.now().toString(36).toUpperCase()}${rand}`;
}
