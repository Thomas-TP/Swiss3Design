// Données de l'écran admin « Stock de filament » (lectures fraîches : l'admin
// voit tout de suite ce qu'il vient d'écrire).
import { and, desc, eq, ne, sql } from "drizzle-orm";
import type { getDb } from "@/db";
import { uncached } from "@/db/fresh";
import {
  filamentColors,
  filamentHolders,
  filamentMovements,
  filamentPurchases,
  filamentRefs,
  filamentSpools,
  settings,
} from "@/db/schema";
import type { RefAvailability } from "./availability";
import { DEFAULT_TARES, SPOOL_TYPE_LIST, type SpoolType } from "./constants";
import {
  countFreeHolders,
  loadStockSnapshot,
  type RefRow,
  type SpoolRow,
} from "./stock-db";

type Db = Awaited<ReturnType<typeof getDb>>;

export interface AdminStock {
  refs: RefRow[];
  /** Bobines non retirées (commandées, en stock, vides). */
  spools: SpoolRow[];
  availability: Map<string, RefAvailability>;
  freeHolders: number;
  holders: (typeof filamentHolders.$inferSelect & { inUse: boolean })[];
  purchases: (typeof filamentPurchases.$inferSelect & { spoolCount: number })[];
  tarePresets: Record<SpoolType, number>;
  /** Consommation moyenne des 90 derniers jours, en g/jour, par référence. */
  gramsPerDay: Record<string, number>;
  shopColors: { id: string; name: string; hex: string }[];
}

export async function loadAdminStock(db: Db): Promise<AdminStock> {
  const snapshot = await loadStockSnapshot(db);
  const [spools, holders, purchases, presets, usage, shopColors, freeHolders] =
    await Promise.all([
      db
        .select()
        .from(filamentSpools)
        .where(and(uncached, ne(filamentSpools.status, "retired"))),
      db.select().from(filamentHolders).where(uncached),
      db
        .select({
          purchase: filamentPurchases,
          spoolCount: sql<number>`count(${filamentSpools.id})::int`,
        })
        .from(filamentPurchases)
        .leftJoin(
          filamentSpools,
          eq(filamentSpools.purchaseId, filamentPurchases.id),
        )
        .where(uncached)
        .groupBy(filamentPurchases.id)
        .orderBy(desc(filamentPurchases.createdAt))
        .limit(30),
      db
        .select()
        .from(settings)
        .where(and(uncached, sql`${settings.key} LIKE 'filament.tare.%'`)),
      db.execute(sql`
        SELECT s.ref_id AS id, SUM(-m.delta_grams)::int AS grams
        FROM filament_movements m JOIN filament_spools s ON s.id = m.spool_id
        WHERE m.kind = 'consumption' AND m.created_at > now() - interval '90 days'
        GROUP BY s.ref_id`),
      db
        .select({
          id: filamentColors.id,
          name: filamentColors.name,
          hex: filamentColors.hex,
        })
        .from(filamentColors)
        .orderBy(filamentColors.name),
      countFreeHolders(db),
    ]);
  const tarePresets = { ...DEFAULT_TARES } as Record<SpoolType, number>;
  for (const row of presets) {
    const type = row.key.slice("filament.tare.".length) as SpoolType;
    const value = Number(row.value);
    if (
      (SPOOL_TYPE_LIST as readonly string[]).includes(type) &&
      Number.isFinite(value)
    )
      tarePresets[type] = value;
  }
  const activeHolderIds = new Set(
    spools
      .filter(
        (s) =>
          s.holderId && (s.status === "ordered" || s.status === "in_stock"),
      )
      .map((s) => s.holderId as string),
  );
  return {
    refs: snapshot.refs,
    spools,
    availability: snapshot.availability,
    freeHolders,
    holders: holders.map((h) => ({ ...h, inUse: activeHolderIds.has(h.id) })),
    purchases: purchases.map((p) => ({
      ...p.purchase,
      spoolCount: p.spoolCount,
    })),
    tarePresets,
    gramsPerDay: Object.fromEntries(
      usage.rows.map((r) => [String(r.id), Number(r.grams) / 90]),
    ),
    shopColors,
  };
}

export interface MovementRow {
  id: string;
  createdAt: Date;
  kind: string;
  deltaGrams: number;
  gramsAfter: number;
  grossGrams: number | null;
  tareGrams: number | null;
  orderId: string | null;
  quoteId: string | null;
  note: string | null;
  spoolId: string;
  refLabel: string;
}

export async function loadMovements(
  db: Db,
  filter: { kind?: string; refId?: string; limit?: number } = {},
): Promise<MovementRow[]> {
  const rows = await db
    .select({
      movement: filamentMovements,
      brand: filamentRefs.brand,
      name: filamentRefs.officialName,
      range: filamentRefs.rangeName,
    })
    .from(filamentMovements)
    .innerJoin(filamentSpools, eq(filamentSpools.id, filamentMovements.spoolId))
    .innerJoin(filamentRefs, eq(filamentRefs.id, filamentSpools.refId))
    .where(
      and(
        uncached,
        filter.kind
          ? eq(filamentMovements.kind, filter.kind as "receipt")
          : undefined,
        filter.refId ? eq(filamentRefs.id, filter.refId) : undefined,
      ),
    )
    .orderBy(desc(filamentMovements.createdAt))
    .limit(filter.limit ?? 200);
  return rows.map(({ movement, brand, name, range }) => ({
    id: movement.id,
    createdAt: movement.createdAt,
    kind: movement.kind,
    deltaGrams: movement.deltaGrams,
    gramsAfter: movement.gramsAfter,
    grossGrams: movement.grossGrams,
    tareGrams: movement.tareGrams,
    orderId: movement.orderId,
    quoteId: movement.quoteId,
    note: movement.note,
    spoolId: movement.spoolId,
    refLabel: `${brand} ${range} · ${name}`,
  }));
}

/** Toutes les consommations (mouvements `consumption`), pour la valorisation mensuelle. */
export async function loadConsumptions(db: Db) {
  const rows = await db
    .select({
      spoolId: filamentMovements.spoolId,
      delta: filamentMovements.deltaGrams,
      at: filamentMovements.createdAt,
    })
    .from(filamentMovements)
    .where(and(uncached, eq(filamentMovements.kind, "consumption")));
  return rows.map((r) => ({ spoolId: r.spoolId, grams: -r.delta, at: r.at }));
}
