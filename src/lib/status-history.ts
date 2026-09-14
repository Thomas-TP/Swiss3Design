import { statusEvents } from "@/db/schema";
import type { Transaction } from "./outbox";

export type StatusEntity = "order" | "quote";
export type StatusSource =
  | "checkout"
  | "payment"
  | "admin"
  | "customer"
  | "system";

interface StatusTransition {
  entityType: StatusEntity;
  entityId: string;
  fromStatus: string | null;
  toStatus: string;
  source: StatusSource;
  actorId?: string | null;
}

// L'événement partage la transaction qui change l'état : impossible d'avoir
// le nouveau statut sans sa trace, ou l'inverse.
export async function recordStatusTransition(
  db: Pick<Transaction, "insert">,
  transition: StatusTransition,
) {
  if (transition.fromStatus === transition.toStatus) return;
  await db.insert(statusEvents).values({
    ...transition,
    actorId: transition.actorId ?? null,
  });
}
