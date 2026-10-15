// Écritures du stock de filament : TOUJOURS dans une transaction, avec le
// mouvement qui les justifie. Le journal `filament_movements` est append-only
// (une correction est un nouveau mouvement) ; `filament_spools.remaining_grams`
// en est la somme, tenue à jour sous verrou de ligne.
import { and, asc, eq, inArray, isNull, notExists, sql } from "drizzle-orm";
import {
  filamentConsumptions,
  filamentHolders,
  filamentMovements,
  filamentPurchases,
  filamentRefs,
  filamentSpools,
} from "@/db/schema";
import { uncached } from "@/db/fresh";
import type { Transaction } from "@/lib/outbox";
import { remainingFromGross } from "./availability";
import { DEFAULT_TARES, type SpoolType } from "./constants";

type Kind = "receipt" | "consumption" | "weigh" | "adjust" | "empty" | "retire";

export interface MovementInput {
  spoolId: string;
  kind: Kind;
  /** Variation signée (consommation : négative). Ignorée si `absolute` est donné. */
  delta?: number;
  /** Nouveau restant absolu (pesée, bobine vide…). */
  absolute?: number;
  grossGrams?: number;
  tareGrams?: number;
  orderId?: string;
  quoteId?: string;
  /** Rejoue sans effet : une clé déjà journalisée n'écrit rien. */
  key?: string;
  note?: string;
  actorId?: string | null;
}

export interface MovementResult {
  duplicate: boolean;
  before: number;
  after: number;
  delta: number;
}

export class LedgerError extends Error {
  constructor(readonly code: "unknown_spool" | "already_consumed") {
    super(code);
  }
}

/** Écrit un mouvement et met à jour la bobine (verrou de ligne). Le restant ne descend jamais sous 0. */
export async function recordMovement(
  tx: Transaction,
  input: MovementInput,
): Promise<MovementResult> {
  const [spool] = await tx
    .select()
    .from(filamentSpools)
    .where(eq(filamentSpools.id, input.spoolId))
    .for("update");
  if (!spool) throw new LedgerError("unknown_spool");
  const before = spool.remainingGrams;
  const wanted =
    input.absolute !== undefined
      ? Math.round(input.absolute)
      : before + Math.round(input.delta ?? 0);
  const after = Math.max(0, wanted);
  const delta = after - before;
  const note =
    wanted < 0
      ? [input.note, "plafonné à 0 g"].filter(Boolean).join(" · ")
      : input.note;

  const inserted = await tx
    .insert(filamentMovements)
    .values({
      spoolId: input.spoolId,
      kind: input.kind,
      deltaGrams: delta,
      gramsAfter: after,
      grossGrams: input.grossGrams ?? null,
      tareGrams: input.tareGrams ?? null,
      orderId: input.orderId ?? null,
      quoteId: input.quoteId ?? null,
      idempotencyKey: input.key ?? null,
      note: note ?? null,
      actorId: input.actorId ?? null,
    })
    .onConflictDoNothing()
    .returning({ id: filamentMovements.id });
  if (inserted.length === 0)
    return { duplicate: true, before, after, delta: 0 };

  const status =
    input.kind === "empty"
      ? "empty"
      : input.kind === "retire"
        ? "retired"
        : input.kind === "receipt"
          ? "in_stock"
          : spool.status;
  await tx
    .update(filamentSpools)
    .set({
      remainingGrams: after,
      status,
      // Une bobine entamée n'est plus une réserve neuve (une pesée n'ouvre pas
      // une bobine : 20 g d'écart de balance ne comptent pas).
      sealed:
        input.kind === "receipt"
          ? true
          : input.kind === "empty" || input.kind === "retire"
            ? false
            : input.kind === "weigh"
              ? spool.sealed && after >= spool.initialGrams - 20
              : delta < 0
                ? false
                : spool.sealed,
      lastWeighedAt: input.kind === "weigh" ? new Date() : spool.lastWeighedAt,
    })
    .where(eq(filamentSpools.id, input.spoolId));
  return { duplicate: false, before, after, delta };
}

/** Pesée rapide : le restant devient `brut − tare`. */
export async function weighSpool(
  tx: Transaction,
  spoolId: string,
  grossGrams: number,
  actorId: string | null,
) {
  const [spool] = await tx
    .select({ tare: filamentSpools.tareGrams })
    .from(filamentSpools)
    .where(and(uncached, eq(filamentSpools.id, spoolId)));
  if (!spool) throw new LedgerError("unknown_spool");
  return recordMovement(tx, {
    spoolId,
    kind: "weigh",
    absolute: remainingFromGross(grossGrams, spool.tare),
    grossGrams: Math.round(grossGrams),
    tareGrams: spool.tare,
    actorId,
  });
}

/** Répartit un montant en parts entières proportionnelles aux poids (la somme est exacte). */
export function allocateCents(
  totalCents: number,
  weights: readonly number[],
): number[] {
  const sum = weights.reduce((s, w) => s + w, 0);
  if (weights.length === 0) return [];
  if (sum <= 0)
    return allocateCents(
      totalCents,
      weights.map(() => 1),
    );
  const exact = weights.map((w) => (totalCents * w) / sum);
  const parts = exact.map(Math.floor);
  let rest = totalCents - parts.reduce((s, p) => s + p, 0);
  const order = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  for (const { i } of order) {
    if (rest <= 0) break;
    parts[i] += 1;
    rest -= 1;
  }
  return parts;
}

/**
 * Réception d'un achat : les bobines commandées entrent en stock (neuves, au
 * poids net d'origine), chaque bobine plastique Bambu crée son support, les
 * recharges prennent un support vide libre s'il y en a. Si `totalCents` (CHF
 * payés) est fourni, il est réparti entre les bobines au prorata du prix
 * catalogue de leur format (frais de port exclus : ils restent sur l'achat).
 */
export async function receivePurchase(
  tx: Transaction,
  purchaseId: string,
  options: { totalCents?: number | null; actorId: string | null },
) {
  const [purchase] = await tx
    .select()
    .from(filamentPurchases)
    .where(eq(filamentPurchases.id, purchaseId))
    .for("update");
  if (!purchase || purchase.status !== "ordered") return { received: 0 };
  const lines = await tx
    .select({ spool: filamentSpools, ref: filamentRefs })
    .from(filamentSpools)
    .innerJoin(filamentRefs, eq(filamentRefs.id, filamentSpools.refId))
    .where(
      and(
        uncached,
        eq(filamentSpools.purchaseId, purchaseId),
        eq(filamentSpools.status, "ordered"),
      ),
    )
    .orderBy(asc(filamentSpools.createdAt));

  const total = options.totalCents ?? purchase.totalCents;
  const shares =
    total !== null && total !== undefined
      ? allocateCents(
          total,
          lines.map(({ spool, ref }) =>
            spool.spoolType === "bambu_refill"
              ? (ref.priceRefillEurCents ?? 1)
              : (ref.priceSpoolEurCents ?? 1),
          ),
        )
      : lines.map(() => null);

  let index = 0;
  for (const { spool } of lines) {
    let holderId = spool.holderId;
    if (spool.spoolType === "bambu_reusable" && !holderId) {
      const [holder] = await tx
        .insert(filamentHolders)
        .values({ tareGrams: spool.tareGrams })
        .returning({ id: filamentHolders.id });
      holderId = holder.id;
    } else if (spool.spoolType === "bambu_refill" && !holderId) {
      holderId = await takeFreeHolder(tx);
    }
    await tx
      .update(filamentSpools)
      .set({
        holderId,
        costCents: shares[index] ?? spool.costCents,
        purchasedAt: purchase.orderedAt ?? new Date(),
      })
      .where(eq(filamentSpools.id, spool.id));
    await recordMovement(tx, {
      spoolId: spool.id,
      kind: "receipt",
      absolute: spool.initialGrams,
      key: `receipt:${spool.id}`,
      note: "Réception de l'achat",
      actorId: options.actorId,
    });
    index++;
  }
  await tx
    .update(filamentPurchases)
    .set({
      status: "received",
      receivedAt: new Date(),
      ...(total !== null && total !== undefined ? { totalCents: total } : {}),
    })
    .where(eq(filamentPurchases.id, purchaseId));
  return { received: lines.length };
}

/** Un support plastique vide libre (le plus ancien), ou null. */
export async function takeFreeHolder(tx: Transaction): Promise<string | null> {
  const [holder] = await tx
    .select({ id: filamentHolders.id })
    .from(filamentHolders)
    .where(
      and(
        uncached,
        isNull(filamentHolders.retiredAt),
        notExists(
          tx
            .select({ one: sql`1` })
            .from(filamentSpools)
            .where(
              and(
                eq(filamentSpools.holderId, filamentHolders.id),
                inArray(filamentSpools.status, ["ordered", "in_stock"]),
              ),
            ),
        ),
      ),
    )
    .orderBy(asc(filamentHolders.createdAt))
    .limit(1)
    .for("update");
  return holder?.id ?? null;
}

export type Source = { orderId: string } | { quoteId: string };

/**
 * Décompte d'une commande ou d'un devis : retire les grammes des bobines
 * choisies. Une seule fois par source (`filament_consumptions` est unique) ;
 * déjà fait, rien n'est écrit et on le dit.
 */
export async function consumeForSource(
  tx: Transaction,
  source: Source,
  allocations: readonly { spoolId: string; grams: number }[],
  actorId: string | null,
) {
  const [row] = await tx
    .insert(filamentConsumptions)
    .values({
      orderId: "orderId" in source ? source.orderId : null,
      quoteId: "quoteId" in source ? source.quoteId : null,
      actorId,
    })
    .onConflictDoNothing()
    .returning({ id: filamentConsumptions.id });
  if (!row) throw new LedgerError("already_consumed");
  const sourceKey = "orderId" in source ? source.orderId : source.quoteId;
  for (const allocation of allocations) {
    if (allocation.grams <= 0) continue;
    await recordMovement(tx, {
      spoolId: allocation.spoolId,
      kind: "consumption",
      delta: -Math.round(allocation.grams),
      orderId: "orderId" in source ? source.orderId : undefined,
      quoteId: "quoteId" in source ? source.quoteId : undefined,
      key: `consume:${sourceKey}:${allocation.spoolId}`,
      actorId,
    });
  }
}

/** Annule un décompte : un mouvement d'ajustement par consommation, puis la source réserve de nouveau. */
export async function undoConsumption(
  tx: Transaction,
  source: Source,
  actorId: string | null,
) {
  const sourceKey = "orderId" in source ? source.orderId : source.quoteId;
  const column =
    "orderId" in source ? filamentMovements.orderId : filamentMovements.quoteId;
  const movements = await tx
    .select()
    .from(filamentMovements)
    .where(
      and(
        uncached,
        eq(column, sourceKey),
        eq(filamentMovements.kind, "consumption"),
      ),
    );
  for (const movement of movements) {
    await recordMovement(tx, {
      spoolId: movement.spoolId,
      kind: "adjust",
      delta: -movement.deltaGrams,
      key: `undo:${movement.id}`,
      note: "Décompte annulé",
      orderId: "orderId" in source ? source.orderId : undefined,
      quoteId: "quoteId" in source ? source.quoteId : undefined,
      actorId,
    });
  }
  await tx
    .delete(filamentConsumptions)
    .where(
      "orderId" in source
        ? eq(filamentConsumptions.orderId, source.orderId)
        : eq(filamentConsumptions.quoteId, source.quoteId),
    );
}

/** Tare par défaut d'un type de bobine (réglages `filament.tare.<type>` par-dessus les défauts). */
export function tareFor(
  type: SpoolType,
  overrides: Readonly<Record<string, string>> = {},
): number {
  const raw = Number(overrides[`filament.tare.${type}`]);
  return Number.isFinite(raw) && raw >= 0 && raw <= 400
    ? Math.round(raw)
    : DEFAULT_TARES[type];
}
