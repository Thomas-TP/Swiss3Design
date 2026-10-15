// Capacité publique de chaque couleur du Studio (`GET /api/stock/colors`) : les
// grammes que l'atelier peut engager, arrondis à 10 g et plafonnés à 1500 g,
// jamais le niveau exact. Module léger (aucun moteur du Studio) : le panier s'en
// sert sans charger la géométrie. Le paiement revérifie toujours côté serveur.
import { CAPACITY_MAX_GRAMS } from "./constants";

export type Capacity = Readonly<Record<string, number>>;

/** Le besoin dépasse-t-il la capacité ? Sans capacité connue, ou plafonnée, jamais. */
export function isShort(
  capacity: Capacity | null,
  id: string,
  needGrams: number,
): boolean {
  if (!capacity) return false;
  const cap = capacity[id];
  if (cap === undefined || cap >= CAPACITY_MAX_GRAMS) return false;
  return needGrams > cap;
}

/** Couleurs épuisées pour la somme des besoins (grammes par couleur, toutes lignes). */
export function shortColors(
  capacity: Capacity | null,
  needs: readonly Readonly<Record<string, number | undefined>>[],
): Set<string> {
  const totals = new Map<string, number>();
  for (const grams of needs)
    for (const [id, g] of Object.entries(grams))
      totals.set(id, (totals.get(id) ?? 0) + (g ?? 0));
  const out = new Set<string>();
  for (const [id, total] of totals)
    if (isShort(capacity, id, total)) out.add(id);
  return out;
}
