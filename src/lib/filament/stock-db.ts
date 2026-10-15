// Lectures du stock de filament (Postgres) : bobines, réservations dérivées des
// commandes du Studio et des devis, disponible par référence, contrôle du
// paiement. Règle d'or 6c : toute lecture qui doit voir une écriture récente
// (réservation, paiement) passe par `uncached` ou `now()`, jamais par le cache
// Hyperdrive de 60 s.
import { and, asc, inArray, isNotNull, sql } from "drizzle-orm";
import type { getDb } from "@/db";
import { uncached } from "@/db/fresh";
import { filamentRefs, filamentSpools } from "@/db/schema";
import {
  computeAvailability,
  covers,
  type RefAvailability,
  type Reservations,
} from "./availability";
import { STOCK_LOCK_KEY } from "./constants";

type Db = Awaited<ReturnType<typeof getDb>>;
/** Une connexion ou une transaction : ce dont les lectures ont besoin. */
export type Queryable = Pick<Db, "select" | "execute">;

export type RefRow = typeof filamentRefs.$inferSelect;
export type SpoolRow = typeof filamentSpools.$inferSelect;

/**
 * Vrai si l'erreur est « table absente » (code Postgres 42P01) : la migration du
 * stock n'est pas encore appliquée. Le paiement et la boutique ne doivent alors
 * jamais échouer : la couleur est traitée comme non suivie, avec un log.
 */
export function isMissingTable(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current; depth++) {
    if ((current as { code?: unknown }).code === "42P01") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

const RE_NUMBER = "^[0-9]+(\\.[0-9]+)?$";

/**
 * Grammes réservés. Studio : commandes payées, en production, ou en attente
 * de paiement dont la réservation n'a pas expiré (comme le stock de la
 * boutique), sans décompte fait. Devis : acceptés, payés, en production, avec
 * les grammes saisis par l'admin, sans décompte fait.
 */
export async function loadReservations(db: Queryable): Promise<Reservations> {
  const studioRows = await db.execute(sql`
    SELECT f.key AS id, SUM(CEIL(f.value::numeric) * oi.quantity)::int AS grams
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    CROSS JOIN LATERAL jsonb_each_text(COALESCE(oi.studio -> 'filamentGrams', '{}'::jsonb)) f
    WHERE oi.studio IS NOT NULL
      AND f.value ~ ${RE_NUMBER}
      AND NOT EXISTS (SELECT 1 FROM filament_consumptions c WHERE c.order_id = o.id)
      AND (o.status IN ('paid', 'in_production')
           OR (o.status = 'pending' AND o.reservation_expires_at > now()))
    GROUP BY f.key`);
  const quoteRows = await db.execute(sql`
    SELECT p.key AS id, SUM(CEIL(p.value::numeric))::int AS grams
    FROM filament_quote_details d
    JOIN quote_requests q ON q.id = d.quote_id
    CROSS JOIN LATERAL jsonb_each_text(COALESCE(d.plan, '{}'::jsonb)) p
    WHERE ${uncached}
      AND p.value ~ ${RE_NUMBER}
      AND q.status IN ('accepted', 'paid', 'in_production')
      AND NOT EXISTS (SELECT 1 FROM filament_consumptions c WHERE c.quote_id = q.id)
    GROUP BY p.key`);
  const toMap = (rows: { rows: Record<string, unknown>[] }) =>
    Object.fromEntries(
      rows.rows.map((r) => [String(r.id), Number(r.grams) || 0]),
    );
  return { studio: toMap(studioRows), quote: toMap(quoteRows) };
}

/** Supports plastique vides libres : non retirés et sans bobine active dessus. */
export async function countFreeHolders(db: Queryable): Promise<number> {
  const result = await db.execute(sql`
    SELECT count(*)::int AS n FROM filament_holders h
    WHERE ${uncached}
      AND h.retired_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM filament_spools s
        WHERE s.holder_id = h.id AND s.status IN ('ordered', 'in_stock'))`);
  return Number(result.rows[0]?.n ?? 0);
}

export interface StockSnapshot {
  refs: RefRow[];
  /** Bobines commandées ou en stock. */
  spools: SpoolRow[];
  reservations: Reservations;
  availability: Map<string, RefAvailability>;
}

/** Références (toutes, ou celles de ces ids Studio) avec leur disponible, lecture fraîche. */
export async function loadStockSnapshot(
  db: Queryable,
  options: { studioIds?: readonly string[] } = {},
): Promise<StockSnapshot> {
  const refs = await db
    .select()
    .from(filamentRefs)
    .where(
      and(
        uncached,
        options.studioIds
          ? inArray(filamentRefs.studioId, [...options.studioIds])
          : isNotNull(filamentRefs.id),
      ),
    )
    .orderBy(asc(filamentRefs.brand), asc(filamentRefs.officialName));
  if (refs.length === 0)
    return {
      refs,
      spools: [],
      reservations: { studio: {}, quote: {} },
      availability: new Map(),
    };
  const [spools, reservations] = await Promise.all([
    db
      .select()
      .from(filamentSpools)
      .where(
        and(
          uncached,
          inArray(filamentSpools.status, ["ordered", "in_stock"]),
          inArray(
            filamentSpools.refId,
            refs.map((r) => r.id),
          ),
        ),
      ),
    loadReservations(db),
  ]);
  return {
    refs,
    spools,
    reservations,
    availability: computeAvailability(refs, spools, reservations),
  };
}

/** Verrou consultatif de transaction : sérialise les contrôles de stock du paiement. */
export async function lockStockChecks(tx: Pick<Db, "execute">) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(${STOCK_LOCK_KEY})`);
}

export interface Shortfall {
  studioId: string;
  needGrams: number;
  availableGrams: number;
}

export type StudioStockCheck =
  | { status: "ok" }
  /** Migration absente : couleurs non suivies, la vente continue. */
  | { status: "untracked" }
  | { status: "short"; short: Shortfall[] };

/**
 * Le stock couvre-t-il ces besoins (grammes par id de palette du Studio) ?
 * Une couleur sans référence en base n'est pas suivie : elle passe.
 */
export async function checkStudioStock(
  db: Queryable,
  needs: Readonly<Record<string, number>>,
): Promise<StudioStockCheck> {
  const ids = Object.keys(needs).filter((id) => needs[id] > 0);
  if (ids.length === 0) return { status: "ok" };
  let snapshot: StockSnapshot;
  try {
    snapshot = await loadStockSnapshot(db, { studioIds: ids });
  } catch (error) {
    if (!isMissingTable(error)) throw error;
    console.warn("[stock] tables du stock absentes : couleurs non suivies");
    return { status: "untracked" };
  }
  const short: Shortfall[] = [];
  for (const ref of snapshot.refs) {
    if (!ref.studioId) continue;
    const available = snapshot.availability.get(ref.id)?.available ?? 0;
    const need = needs[ref.studioId] ?? 0;
    if (!covers(available, need))
      short.push({
        studioId: ref.studioId,
        needGrams: need,
        availableGrams: available,
      });
  }
  return short.length > 0 ? { status: "short", short } : { status: "ok" };
}
