// Réservation de filament d'une ligne de la boutique (écriture, serveur). Une ligne
// d'article qui a un poids, de couleur suivie, écrit UNE ligne
// `order_item_filaments` (grammes d'une pièce) DANS la transaction de la commande ;
// ce que la commande réserve se dérive ensuite (`stock-db.ts`), rien n'est stocké en
// total. La migration 0011 peut manquer : le paiement ne dépend jamais d'elle.
import { and, inArray } from "drizzle-orm";
import type { getDb } from "@/db";
import { uncached } from "@/db/fresh";
import { filamentRefs, orderItemFilaments } from "@/db/schema";
import { hasShopReservationTable } from "./stock-db";

type Db = Awaited<ReturnType<typeof getDb>>;
/** Une connexion ou une transaction. */
type Writer = Pick<Db, "select" | "execute" | "insert">;

export interface ShopReservationInput {
  orderItemId: string;
  refId: string;
  gramsPerPiece: number;
}

/**
 * Écrit les réservations de la commande. Table absente (0011 pas appliquée) : on
 * le dit dans le journal et la vente continue, rien n'est réservé. Le sondage
 * `to_regclass` ne lève jamais d'erreur, donc ne ferme pas la transaction (25P02),
 * contrairement à un INSERT dans une table manquante. Une référence qui n'existe
 * plus (commande d'agent, SKU périmé) est écartée de la même façon : la clé
 * étrangère ferait échouer toute la commande, déjà payée.
 */
export async function recordShopReservations(
  tx: Writer,
  lines: readonly ShopReservationInput[],
): Promise<"recorded" | "nothing" | "untracked"> {
  if (lines.length === 0) return "nothing";
  if (!(await hasShopReservationTable(tx))) {
    console.warn(
      "[stock] table order_item_filaments absente : réservation de la boutique ignorée",
    );
    return "untracked";
  }
  const known = await tx
    .select({ id: filamentRefs.id })
    .from(filamentRefs)
    .where(
      and(
        uncached,
        inArray(filamentRefs.id, [...new Set(lines.map((l) => l.refId))]),
      ),
    );
  const knownIds = new Set(known.map((r) => r.id));
  const kept = lines.filter((line) => knownIds.has(line.refId));
  if (kept.length < lines.length)
    console.warn(
      "[stock] référence de filament inconnue : réservation de la boutique ignorée",
    );
  if (kept.length === 0) return "nothing";
  await tx.insert(orderItemFilaments).values(
    kept.map((line) => ({
      orderItemId: line.orderItemId,
      refId: line.refId,
      gramsPerPiece: line.gramsPerPiece,
    })),
  );
  return "recorded";
}
