// Numéro de commande lisible (horodatage base 36 + 4 caractères aléatoires),
// partagé par le checkout web et les commandes d'agents IA. La contrainte
// UNIQUE de `orders.order_number` tranche en dernier recours. Préfixe KRY-
// depuis le passage à Kreya ; les commandes antérieures gardent S3D- (toujours
// reconnu : ORDER_NUMBER_PATTERN).
export function makeOrderNumber(): string {
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `KRY-${Date.now().toString(36).toUpperCase()}${rand}`;
}

/** Numéro de commande Kreya (KRY-) ou d'avant le renommage (S3D-). */
export const ORDER_NUMBER_PATTERN = /\b(?:KRY|S3D)-[A-Z0-9]{8,16}\b/i;
