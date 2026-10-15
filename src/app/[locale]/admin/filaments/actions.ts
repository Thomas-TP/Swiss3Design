"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { uncached } from "@/db/fresh";
import {
  filamentHolders,
  filamentPurchases,
  filamentRefs,
  filamentSpools,
  settings,
  SPOOL_LOCATIONS,
} from "@/db/schema";
import {
  DEFAULT_TARES,
  SPOOL_TYPE_LIST,
  TARE_TO_VERIFY,
  type SpoolType,
} from "@/lib/filament/constants";
import {
  LedgerError,
  receivePurchase,
  recordMovement,
  takeFreeHolder,
  tareFor,
  weighSpool,
} from "@/lib/filament/ledger";
import { remainingFromGross } from "@/lib/filament/availability";
import { invalidatePublicStock } from "@/lib/filament/public-stock";
import { FILAMENT_IDS } from "@/lib/studio/filaments";
import { requireFreshAdmin } from "@/lib/session";
import type { AdminFormState } from "./action-form";

// Server Actions du stock de filament. Jamais de redirect() (règle d'or 1) :
// un état `{ error | ok }` ; chaque écriture vide le cache public du stock.

const HEX_RE = /^#[0-9A-F]{6}$/;

function text(data: FormData, name: string, max = 200): string {
  return String(data.get(name) ?? "")
    .trim()
    .slice(0, max);
}
function optionalText(data: FormData, name: string, max = 200) {
  return text(data, name, max) || null;
}
function intField(data: FormData, name: string): number | null {
  const raw = text(data, name, 20).replace(",", ".");
  if (raw === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? Math.round(value) : null;
}
/** « 19,99 » → 1999 ; vide → null. */
function centsField(data: FormData, name: string): number | null {
  const raw = text(data, name, 20).replace(",", ".");
  if (raw === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) : null;
}
const flag = (data: FormData, name: string) => data.get(name) === "on";

async function done(message: string): Promise<AdminFormState> {
  await invalidatePublicStock();
  revalidatePath("/", "layout");
  return { ok: message };
}

function failure(error: unknown, fallback: string): AdminFormState {
  if (error instanceof LedgerError)
    return { error: `Mouvement refusé (${error.code}).` };
  const code = (error as { code?: string; cause?: { code?: string } })?.code;
  const cause = (error as { cause?: { code?: string } })?.cause?.code;
  if (code === "23505" || cause === "23505")
    return { error: "Cet élément existe déjà (doublon)." };
  console.error("[stock] action refusée", error);
  return { error: fallback };
}

// ── Références (couleurs) ────────────────────────────────────────────────────

export async function saveRef(
  _prev: AdminFormState,
  data: FormData,
): Promise<AdminFormState> {
  await requireFreshAdmin();
  const id = text(data, "id", 80);
  const brand = text(data, "brand", 60);
  const rangeName = text(data, "rangeName", 60);
  const officialName = text(data, "officialName", 80);
  const hex = text(data, "hex", 7).toUpperCase();
  const hex2 = optionalText(data, "hex2", 7)?.toUpperCase() ?? null;
  const hex3 = optionalText(data, "hex3", 7)?.toUpperCase() ?? null;
  if (!brand || !rangeName || !officialName)
    return { error: "Marque, gamme et nom officiel sont obligatoires." };
  if (
    !HEX_RE.test(hex) ||
    (hex2 && !HEX_RE.test(hex2)) ||
    (hex3 && !HEX_RE.test(hex3))
  )
    return { error: "Hex invalide (format #RRGGBB, majuscules)." };
  if (hex3 && !hex2) return { error: "La 3e teinte exige la 2e." };
  const studioId = optionalText(data, "studioId", 40);
  if (studioId && !(FILAMENT_IDS as readonly string[]).includes(studioId))
    return { error: "Identifiant de palette du Studio inconnu." };
  const values = {
    brand,
    rangeName,
    officialName,
    productCode: optionalText(data, "productCode", 40),
    hex,
    hex2,
    hex3,
    hexConfirmed: flag(data, "hexConfirmed"),
    studioId,
    customOk: flag(data, "customOk"),
    spoolNetGrams: Math.max(1, intField(data, "spoolNetGrams") ?? 1000),
    reorderBelowGrams: Math.max(0, intField(data, "reorderBelowGrams") ?? 300),
    minSpareSpools: Math.max(0, intField(data, "minSpareSpools") ?? 0),
    priceSpoolEurCents: centsField(data, "priceSpoolEur"),
    priceRefillEurCents: centsField(data, "priceRefillEur"),
    urlSpool: optionalText(data, "urlSpool", 500),
    urlRefill: optionalText(data, "urlRefill", 500),
    active: flag(data, "active"),
    note: optionalText(data, "note", 500),
  };
  try {
    const db = await getDb();
    if (id) {
      await db.update(filamentRefs).set(values).where(eq(filamentRefs.id, id));
    } else {
      await db.insert(filamentRefs).values(values);
    }
  } catch (error) {
    return failure(error, "Enregistrement impossible.");
  }
  return done(id ? "Référence enregistrée." : "Référence ajoutée.");
}

export async function saveTarePresets(
  _prev: AdminFormState,
  data: FormData,
): Promise<AdminFormState> {
  await requireFreshAdmin();
  const db = await getDb();
  for (const type of SPOOL_TYPE_LIST) {
    const value = intField(data, `tare:${type}`);
    if (value === null || value < 0 || value > 400)
      return { error: "Tare entre 0 et 400 g." };
    await db
      .insert(settings)
      .values({ key: `filament.tare.${type}`, value: String(value) })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: String(value) },
      });
  }
  return done(
    "Tares par défaut enregistrées (les bobines existantes gardent la leur).",
  );
}

// ── Supports plastique vides ─────────────────────────────────────────────────

export async function addHolder(
  _prev: AdminFormState,
  data: FormData,
): Promise<AdminFormState> {
  await requireFreshAdmin();
  const tare = intField(data, "tareGrams") ?? DEFAULT_TARES.bambu_reusable;
  if (tare < 50 || tare > 400) return { error: "Tare entre 50 et 400 g." };
  try {
    const db = await getDb();
    await db
      .insert(filamentHolders)
      .values({ tareGrams: tare, note: optionalText(data, "note", 200) });
  } catch (error) {
    return failure(error, "Ajout impossible.");
  }
  return done("Support ajouté.");
}

export async function retireHolder(
  _prev: AdminFormState,
  data: FormData,
): Promise<AdminFormState> {
  await requireFreshAdmin();
  const id = text(data, "id", 80);
  const db = await getDb();
  await db
    .update(filamentHolders)
    .set({ retiredAt: new Date() })
    .where(eq(filamentHolders.id, id));
  return done("Support retiré.");
}

// ── Bobines ──────────────────────────────────────────────────────────────────

function spoolTypeOf(raw: string): SpoolType | null {
  return (SPOOL_TYPE_LIST as readonly string[]).includes(raw)
    ? (raw as SpoolType)
    : null;
}

async function tarePresets(): Promise<Record<string, string>> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(settings)
    .where(and(uncached, sql`${settings.key} LIKE 'filament.tare.%'`));
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function addSpool(
  _prev: AdminFormState,
  data: FormData,
): Promise<AdminFormState> {
  const session = await requireFreshAdmin();
  const refId = text(data, "refId", 80);
  const type = spoolTypeOf(text(data, "spoolType", 40));
  if (!refId || !type)
    return { error: "Couleur et type de bobine obligatoires." };
  const presets = await tarePresets();
  const tare = intField(data, "tareGrams") ?? tareFor(type, presets);
  const gross = intField(data, "gross");
  const status =
    text(data, "status", 20) === "ordered" ? "ordered" : "in_stock";
  const location = text(data, "location", 20);
  try {
    const db = await getDb();
    await db.transaction(async (tx) => {
      const [ref] = await tx
        .select({ net: filamentRefs.spoolNetGrams })
        .from(filamentRefs)
        .where(and(uncached, eq(filamentRefs.id, refId)));
      if (!ref) throw new Error("unknown_ref");
      const remaining =
        gross !== null
          ? remainingFromGross(gross, tare)
          : (intField(data, "remaining") ?? ref.net);
      let holderId: string | null = null;
      if (type === "bambu_reusable" && status === "in_stock") {
        const [holder] = await tx
          .insert(filamentHolders)
          .values({ tareGrams: tare })
          .returning({ id: filamentHolders.id });
        holderId = holder.id;
      } else if (type === "bambu_refill" && status === "in_stock") {
        holderId = await takeFreeHolder(tx);
      }
      const [spool] = await tx
        .insert(filamentSpools)
        .values({
          refId,
          holderId,
          spoolType: type,
          tareGrams: tare,
          tareConfirmed:
            !TARE_TO_VERIFY.has(type) || flag(data, "tareConfirmed"),
          initialGrams: ref.net,
          remainingGrams: 0,
          status,
          sealed: flag(data, "sealed"),
          location: (SPOOL_LOCATIONS as readonly string[]).includes(location)
            ? (location as (typeof SPOOL_LOCATIONS)[number])
            : null,
          slot: optionalText(data, "slot", 20),
          costCents: centsField(data, "costChf"),
          purchasedAt: data.get("purchasedAt")
            ? new Date(String(data.get("purchasedAt")))
            : null,
          toConfirm: flag(data, "toConfirm"),
          note: optionalText(data, "note", 300),
        })
        .returning({ id: filamentSpools.id });
      if (status === "in_stock")
        await recordMovement(tx, {
          spoolId: spool.id,
          kind: gross !== null ? "weigh" : "adjust",
          absolute: remaining,
          grossGrams: gross ?? undefined,
          tareGrams: gross !== null ? tare : undefined,
          note: "Inventaire initial",
          actorId: session.user.id,
        });
    });
  } catch (error) {
    return failure(error, "Ajout de la bobine impossible.");
  }
  return done("Bobine ajoutée.");
}

export async function updateSpool(
  _prev: AdminFormState,
  data: FormData,
): Promise<AdminFormState> {
  await requireFreshAdmin();
  const id = text(data, "id", 80);
  const location = text(data, "location", 20);
  const tare = intField(data, "tareGrams");
  const db = await getDb();
  const [current] = await db
    .select({ tare: filamentSpools.tareGrams })
    .from(filamentSpools)
    .where(and(uncached, eq(filamentSpools.id, id)));
  if (!current) return { error: "Bobine introuvable." };
  try {
    await db
      .update(filamentSpools)
      .set({
        location: (SPOOL_LOCATIONS as readonly string[]).includes(location)
          ? (location as (typeof SPOOL_LOCATIONS)[number])
          : null,
        slot: optionalText(data, "slot", 20),
        ...(tare !== null && tare >= 0 && tare <= 400
          ? {
              tareGrams: tare,
              tareConfirmed:
                flag(data, "tareConfirmed") || tare !== current.tare,
            }
          : {}),
        toConfirm: flag(data, "toConfirm"),
        note: optionalText(data, "note", 300),
        ...(text(data, "refId", 80) ? { refId: text(data, "refId", 80) } : {}),
      })
      .where(eq(filamentSpools.id, id));
  } catch (error) {
    return failure(error, "Enregistrement impossible.");
  }
  return done("Bobine mise à jour.");
}

export async function weighOne(
  _prev: AdminFormState,
  data: FormData,
): Promise<AdminFormState> {
  const session = await requireFreshAdmin();
  const gross = intField(data, "gross");
  if (gross === null || gross < 0) return { error: "Poids brut invalide." };
  try {
    const db = await getDb();
    const result = await db.transaction((tx) =>
      weighSpool(tx, text(data, "id", 80), gross, session.user.id),
    );
    return done(`Restant : ${result.after} g.`);
  } catch (error) {
    return failure(error, "Pesée impossible.");
  }
}

/** Pesée rapide : tous les champs `gross:<id>` remplis, en une transaction. */
export async function weighMany(
  _prev: AdminFormState,
  data: FormData,
): Promise<AdminFormState> {
  const session = await requireFreshAdmin();
  const entries: { id: string; gross: number; tare: number | null }[] = [];
  for (const [name, value] of data.entries()) {
    if (!name.startsWith("gross:") || String(value).trim() === "") continue;
    const id = name.slice(6);
    const gross = Number(String(value).replace(",", "."));
    if (!Number.isFinite(gross) || gross < 0)
      return { error: "Un poids brut est invalide." };
    const tareRaw = String(data.get(`tare:${id}`) ?? "").trim();
    entries.push({
      id,
      gross: Math.round(gross),
      tare: tareRaw === "" ? null : Math.round(Number(tareRaw)),
    });
  }
  if (entries.length === 0) return { error: "Aucun poids saisi." };
  try {
    const db = await getDb();
    await db.transaction(async (tx) => {
      for (const entry of entries) {
        if (entry.tare !== null && entry.tare >= 0 && entry.tare <= 400)
          await tx
            .update(filamentSpools)
            .set({ tareGrams: entry.tare, tareConfirmed: true })
            .where(eq(filamentSpools.id, entry.id));
        await weighSpool(tx, entry.id, entry.gross, session.user.id);
      }
    });
  } catch (error) {
    return failure(error, "Pesée impossible.");
  }
  return done(`${entries.length} pesée(s) enregistrée(s).`);
}

export async function adjustSpool(
  _prev: AdminFormState,
  data: FormData,
): Promise<AdminFormState> {
  const session = await requireFreshAdmin();
  const delta = intField(data, "grams");
  if (delta === null || delta === 0)
    return { error: "Grammes à ajouter ou retirer (±)." };
  try {
    const db = await getDb();
    await db.transaction((tx) =>
      recordMovement(tx, {
        spoolId: text(data, "id", 80),
        kind: "adjust",
        delta,
        note: optionalText(data, "note", 300) ?? undefined,
        actorId: session.user.id,
      }),
    );
  } catch (error) {
    return failure(error, "Ajustement impossible.");
  }
  return done("Ajustement enregistré.");
}

async function closeSpool(data: FormData, kind: "empty" | "retire") {
  const session = await requireFreshAdmin();
  try {
    const db = await getDb();
    await db.transaction((tx) =>
      recordMovement(tx, {
        spoolId: text(data, "id", 80),
        kind,
        absolute: 0,
        note: optionalText(data, "note", 300) ?? undefined,
        actorId: session.user.id,
      }),
    );
  } catch (error) {
    return failure(error, "Action impossible.");
  }
  return done(
    kind === "empty"
      ? "Bobine vide : le support est libre."
      : "Bobine retirée.",
  );
}
export async function emptySpool(_prev: AdminFormState, data: FormData) {
  return closeSpool(data, "empty");
}
export async function retireSpool(_prev: AdminFormState, data: FormData) {
  return closeSpool(data, "retire");
}

/** Monte une recharge sur un support vide libre. */
export async function mountRefill(
  _prev: AdminFormState,
  data: FormData,
): Promise<AdminFormState> {
  await requireFreshAdmin();
  const db = await getDb();
  const mounted = await db.transaction(async (tx) => {
    const holderId = await takeFreeHolder(tx);
    if (!holderId) return false;
    await tx
      .update(filamentSpools)
      .set({ holderId })
      .where(eq(filamentSpools.id, text(data, "id", 80)));
    return true;
  });
  if (!mounted) return { error: "Aucun support vide libre." };
  return done("Recharge montée sur un support.");
}

// ── Achats ───────────────────────────────────────────────────────────────────

interface PurchaseLine {
  refId: string;
  format: "spool" | "refill";
  qty: number;
}

export async function createPurchase(
  _prev: AdminFormState,
  data: FormData,
): Promise<AdminFormState> {
  await requireFreshAdmin();
  let lines: PurchaseLine[];
  try {
    const parsed = JSON.parse(String(data.get("lines") ?? "[]"));
    lines = (Array.isArray(parsed) ? parsed : [])
      .filter(
        (l): l is PurchaseLine =>
          typeof l?.refId === "string" &&
          (l.format === "spool" || l.format === "refill") &&
          Number.isInteger(l.qty) &&
          l.qty > 0 &&
          l.qty <= 50,
      )
      .slice(0, 60);
  } catch {
    return { error: "Panier illisible." };
  }
  if (lines.length === 0) return { error: "Panier vide." };
  const presets = await tarePresets();
  try {
    const db = await getDb();
    await db.transaction(async (tx) => {
      const refs = await tx
        .select()
        .from(filamentRefs)
        .where(
          and(
            uncached,
            inArray(
              filamentRefs.id,
              lines.map((l) => l.refId),
            ),
          ),
        );
      const byId = new Map(refs.map((r) => [r.id, r]));
      const [purchase] = await tx
        .insert(filamentPurchases)
        .values({
          supplier: text(data, "supplier", 80) || "Bambu Lab Europe",
          reference: optionalText(data, "reference", 80),
          status: "ordered",
          orderedAt: new Date(),
          totalEurCents: centsField(data, "totalEur"),
          shippingCents: 0,
          note: optionalText(data, "note", 300),
        })
        .returning({ id: filamentPurchases.id });
      for (const line of lines) {
        const ref = byId.get(line.refId);
        if (!ref) throw new Error("unknown_ref");
        const type: SpoolType =
          line.format === "spool" ? "bambu_reusable" : "bambu_refill";
        await tx.insert(filamentSpools).values(
          Array.from({ length: line.qty }, () => ({
            refId: ref.id,
            purchaseId: purchase.id,
            spoolType: type,
            tareGrams: tareFor(type, presets),
            tareConfirmed: !TARE_TO_VERIFY.has(type),
            initialGrams: ref.spoolNetGrams,
            remainingGrams: 0,
            status: "ordered" as const,
            sealed: true,
          })),
        );
      }
    });
  } catch (error) {
    return failure(error, "Création de l'achat impossible.");
  }
  return done("Achat enregistré (commandé).");
}

export async function receivePurchaseAction(
  _prev: AdminFormState,
  data: FormData,
): Promise<AdminFormState> {
  const session = await requireFreshAdmin();
  try {
    const db = await getDb();
    const result = await db.transaction((tx) =>
      receivePurchase(tx, text(data, "id", 80), {
        totalCents: centsField(data, "totalChf"),
        actorId: session.user.id,
      }),
    );
    if (result.received === 0) return { error: "Rien à réceptionner." };
    return done(`${result.received} bobine(s) entrée(s) en stock.`);
  } catch (error) {
    return failure(error, "Réception impossible.");
  }
}

export async function cancelPurchase(
  _prev: AdminFormState,
  data: FormData,
): Promise<AdminFormState> {
  await requireFreshAdmin();
  const id = text(data, "id", 80);
  const db = await getDb();
  await db.transaction(async (tx) => {
    const changed = await tx
      .update(filamentPurchases)
      .set({ status: "cancelled" })
      .where(
        sql`${filamentPurchases.id} = ${id} AND ${filamentPurchases.status} = 'ordered'`,
      )
      .returning({ id: filamentPurchases.id });
    if (changed.length)
      await tx
        .update(filamentSpools)
        .set({ status: "retired" })
        .where(
          sql`${filamentSpools.purchaseId} = ${id} AND ${filamentSpools.status} = 'ordered'`,
        );
  });
  return done("Achat annulé.");
}
