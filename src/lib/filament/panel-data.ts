// Données du panneau « Filament » des pages admin commande et devis.
import { and, eq, inArray, isNotNull, or } from "drizzle-orm";
import type { getDb } from "@/db";
import { uncached } from "@/db/fresh";
import {
  filamentConsumptions,
  filamentQuoteDetails,
  filamentRefs,
  filamentSpools,
  orderItemFilaments,
  orderItems,
} from "@/db/schema";
import { filamentGramsOf } from "@/lib/studio/filament-need";
import { readStudioOrderLine } from "@/lib/studio/order-line";
import { PRICE_LOCALE } from "@/lib/studio/price";
import { shopNeedGrams } from "./shop";
import { hasShopReservationTable, isMissingTable } from "./stock-db";

type Db = Awaited<ReturnType<typeof getDb>>;

export interface PanelNeed {
  refId: string | null;
  /** Id de palette du Studio (commande) ou null (devis). */
  studioId: string | null;
  label: string;
  hexes: string[];
  grams: number;
}

export interface PanelSpool {
  id: string;
  refId: string;
  label: string;
  remainingGrams: number;
  location: string | null;
}

export interface FilamentPanel {
  needs: PanelNeed[];
  spools: PanelSpool[];
  consumedAt: Date | null;
}

async function spoolsFor(db: Db, refIds: string[]): Promise<PanelSpool[]> {
  if (refIds.length === 0) return [];
  const rows = await db
    .select()
    .from(filamentSpools)
    .where(
      and(
        uncached,
        eq(filamentSpools.status, "in_stock"),
        inArray(filamentSpools.refId, refIds),
      ),
    );
  return rows.map((s) => ({
    id: s.id,
    refId: s.refId,
    label: `${s.remainingGrams} g${s.sealed ? " · neuve" : ""}${s.location ? ` · ${s.location}` : ""}`,
    remainingGrams: s.remainingGrams,
    location: s.location,
  }));
}

const hexesOf = (r: {
  hex: string;
  hex2: string | null;
  hex3: string | null;
}) => [r.hex, r.hex2, r.hex3].filter((h): h is string => Boolean(h));

/**
 * Ce que la commande consomme par couleur, ou null s'il n'y a ni objet du Studio ni
 * article de la boutique à filament suivi. Une même bobine sert les deux familles
 * de lignes : une seule ligne du panneau par référence (grammes additionnés).
 */
export async function loadOrderPanel(
  db: Db,
  orderId: string,
): Promise<FilamentPanel | null> {
  try {
    const items = await db
      .select({ studio: orderItems.studio, quantity: orderItems.quantity })
      .from(orderItems)
      .where(
        and(
          eq(orderItems.orderId, orderId),
          isNotNull(orderItems.studio),
          uncached,
        ),
      );
    const totals = new Map<string, number>();
    for (const item of items) {
      const line = readStudioOrderLine(item.studio);
      if (!line) continue;
      // Les commandes d'avant le stock n'ont pas `filamentGrams` : recalcul d'après la configuration.
      const grams =
        line.filamentGrams ??
        filamentGramsOf(line.config, line.texts, PRICE_LOCALE);
      for (const [id, g] of Object.entries(grams))
        totals.set(id, (totals.get(id) ?? 0) + (g ?? 0) * item.quantity);
    }
    // Articles de la boutique imprimés à la demande : grammes d'une pièce enregistrés
    // à la commande, × quantité + 10 % de perte (même calcul que la réservation).
    const shopTotals = new Map<string, number>();
    if (await hasShopReservationTable(db)) {
      const rows = await db
        .select({
          refId: orderItemFilaments.refId,
          gramsPerPiece: orderItemFilaments.gramsPerPiece,
          quantity: orderItems.quantity,
        })
        .from(orderItemFilaments)
        .innerJoin(
          orderItems,
          eq(orderItems.id, orderItemFilaments.orderItemId),
        )
        .where(and(eq(orderItems.orderId, orderId), uncached));
      for (const row of rows)
        shopTotals.set(
          row.refId,
          (shopTotals.get(row.refId) ?? 0) +
            (shopNeedGrams(row.gramsPerPiece, row.quantity) ?? 0),
        );
    }
    if (totals.size === 0 && shopTotals.size === 0) return null;
    const refs = await db
      .select()
      .from(filamentRefs)
      .where(
        or(
          totals.size
            ? inArray(filamentRefs.studioId, [...totals.keys()])
            : undefined,
          shopTotals.size
            ? inArray(filamentRefs.id, [...shopTotals.keys()])
            : undefined,
        ),
      );
    const byStudio = new Map(refs.map((r) => [r.studioId, r]));
    const byId = new Map(refs.map((r) => [r.id, r]));
    const [done] = await db
      .select()
      .from(filamentConsumptions)
      .where(and(eq(filamentConsumptions.orderId, orderId), uncached));
    // Une ligne par référence ; une couleur du Studio sans référence reste « non suivie ».
    const merged = new Map<string, PanelNeed>();
    const add = (key: string, need: PanelNeed) => {
      const current = merged.get(key);
      if (current) current.grams += need.grams;
      else merged.set(key, need);
    };
    for (const [studioId, grams] of totals) {
      const ref = byStudio.get(studioId);
      add(ref?.id ?? `studio:${studioId}`, {
        refId: ref?.id ?? null,
        studioId,
        label: ref
          ? `${ref.officialName} (${studioId})`
          : `${studioId} (non suivie)`,
        hexes: ref ? hexesOf(ref) : [],
        grams,
      });
    }
    for (const [refId, grams] of shopTotals) {
      const ref = byId.get(refId);
      add(refId, {
        refId,
        studioId: ref?.studioId ?? null,
        label: ref
          ? `${ref.brand} ${ref.rangeName} · ${ref.officialName}`
          : "Couleur supprimée du stock",
        hexes: ref ? hexesOf(ref) : [],
        grams,
      });
    }
    const needs = [...merged.values()];
    return {
      needs,
      spools: await spoolsFor(
        db,
        needs.map((n) => n.refId).filter((id): id is string => Boolean(id)),
      ),
      consumedAt: done?.consumedAt ?? null,
    };
  } catch (error) {
    if (isMissingTable(error)) return null;
    throw error;
  }
}

export interface QuotePanel extends FilamentPanel {
  quantity: number;
  estGrams: number | null;
  /** Couleurs choisies par le client (pour saisir les grammes). */
  chosen: { refId: string; label: string; hexes: string[]; planned: number }[];
}

/** Devis : couleurs choisies, estimation du client, grammes saisis par l'admin. */
export async function loadQuotePanel(
  db: Db,
  quoteId: string,
): Promise<QuotePanel | null> {
  try {
    const [details] = await db
      .select()
      .from(filamentQuoteDetails)
      .where(and(eq(filamentQuoteDetails.quoteId, quoteId), uncached));
    const plan = details?.plan ?? {};
    const refIds = [
      ...new Set([...(details?.colorRefs ?? []), ...Object.keys(plan)]),
    ];
    const refs = refIds.length
      ? await db
          .select()
          .from(filamentRefs)
          .where(inArray(filamentRefs.id, refIds))
      : [];
    const [done] = await db
      .select()
      .from(filamentConsumptions)
      .where(and(eq(filamentConsumptions.quoteId, quoteId), uncached));
    const chosen = refs.map((r) => ({
      refId: r.id,
      label: `${r.brand} ${r.rangeName} · ${r.officialName}`,
      hexes: hexesOf(r),
      planned: plan[r.id] ?? 0,
    }));
    return {
      quantity: details?.quantity ?? 1,
      estGrams: details?.estGrams ?? null,
      chosen,
      needs: chosen
        .filter((c) => c.planned > 0)
        .map((c) => ({
          refId: c.refId,
          studioId: null,
          label: c.label,
          hexes: c.hexes,
          grams: c.planned,
        })),
      spools: await spoolsFor(db, refIds),
      consumedAt: done?.consumedAt ?? null,
    };
  } catch (error) {
    if (isMissingTable(error)) return null;
    throw error;
  }
}
