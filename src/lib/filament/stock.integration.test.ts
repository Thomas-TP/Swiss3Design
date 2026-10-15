import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, inArray } from "drizzle-orm";
import * as schema from "@/db/schema";
import { scaleGrams, sumGrams } from "@/lib/studio/filament-need";
import { BORNE_DEFAULT } from "@/lib/studio/presets";
import {
  studioLineInputSchema,
  validateStudioLine,
} from "@/lib/studio/purchase";
import type { StudioOrderLine } from "@/lib/studio/order-line";
import { covers } from "./availability";
import {
  allocateCents,
  consumeForSource,
  LedgerError,
  receivePurchase,
  recordMovement,
  undoConsumption,
  weighSpool,
} from "./ledger";
import {
  checkStudioStock,
  countFreeHolders,
  loadStockSnapshot,
  lockStockChecks,
} from "./stock-db";

// Tests d'intégration du stock de filament sur la branche Neon PREVIEW isolée
// (migration 0010 appliquée). Ils mesurent des DIFFÉRENCES (disponible avant /
// après) : ils passent donc avec ou sans le stock réel du propriétaire déjà semé,
// et nettoient tout ce qu'ils créent.
vi.mock("@/db", () => ({ getDb: async () => undefined }));
const url = process.env.INTEGRATION_DATABASE_URL;

describe.skipIf(!url)("Stock de filament sur Postgres preview isolé", () => {
  const pool = new Pool({ connectionString: url, max: 6 });
  const db = drizzle(pool, { schema });
  const tag = "it-" + crypto.randomUUID().slice(0, 8);
  const ids = {
    refs: [] as string[],
    spools: [] as string[],
    holders: [] as string[],
    purchases: [] as string[],
    orders: [] as string[],
    quotes: [] as string[],
  };
  const STUDIO_ID = "gres";

  beforeAll(() => {
    if (
      !url ||
      new URL(url).hostname !==
        "ep-green-tooth-aswk3vbr.c-4.eu-central-1.aws.neon.tech"
    )
      if (
        !(
          process.env.CI === "true" &&
          new URL(url ?? "http://x").hostname === "127.0.0.1"
        )
      )
        throw new Error(
          "Tests autorisés uniquement sur la branche preview identifiée",
        );
  });

  /** La référence Studio `gres` : celle du stock réel si elle existe, sinon une de test. */
  async function studioRef(studioId: string = STUDIO_ID) {
    const [existing] = await db
      .select()
      .from(schema.filamentRefs)
      .where(eq(schema.filamentRefs.studioId, studioId));
    if (existing) return existing;
    const [created] = await db
      .insert(schema.filamentRefs)
      .values({
        id: `${tag}-ref-${studioId}`,
        brand: "Test",
        rangeName: tag,
        officialName: studioId,
        hex: "#D3B7A7",
        studioId,
        customOk: true,
      })
      .returning();
    ids.refs.push(created.id);
    return created;
  }

  async function newSpool(
    refId: string,
    grams: number,
    over: Partial<typeof schema.filamentSpools.$inferInsert> = {},
  ) {
    const [spool] = await db
      .insert(schema.filamentSpools)
      .values({
        refId,
        spoolType: "bambu_reusable",
        tareGrams: 212,
        initialGrams: 1000,
        remainingGrams: 0,
        status: "in_stock",
        note: tag,
        ...over,
      })
      .returning();
    ids.spools.push(spool.id);
    if (grams > 0)
      await db.transaction((tx) =>
        recordMovement(tx, {
          spoolId: spool.id,
          kind: "adjust",
          absolute: grams,
          note: tag,
        }),
      );
    return spool.id;
  }

  async function available(refId: string) {
    const snap = await loadStockSnapshot(db);
    return snap.availability.get(refId)!.available;
  }

  async function studioOrder(
    grams: Record<string, number>,
    status: "pending" | "paid" | "in_production" = "paid",
    quantity = 1,
  ) {
    const id = `${tag}-o-${ids.orders.length}`;
    ids.orders.push(id);
    await db.insert(schema.orders).values({
      id,
      orderNumber: id,
      email: "stock@example.invalid",
      status,
      subtotalCents: 1000,
      shippingCents: 0,
      totalCents: 1000,
      shippingAddress: "{}",
      reservationExpiresAt: new Date(Date.now() + 3600_000),
    });
    await db.insert(schema.orderItems).values({
      orderId: id,
      nameSnapshot: "Test Studio",
      priceCentsSnapshot: 1000,
      quantity,
      studio: { v: 1, filamentGrams: grams } as unknown as StudioOrderLine,
    });
    return id;
  }

  it("une pesée écrit un mouvement daté et la somme des mouvements égale le restant", async () => {
    const ref = await studioRef();
    const spoolId = await newSpool(ref.id, 0);
    await db.transaction((tx) => weighSpool(tx, spoolId, 463, "admin-test"));
    await db.transaction((tx) => weighSpool(tx, spoolId, 300, "admin-test"));
    const [spool] = await db
      .select()
      .from(schema.filamentSpools)
      .where(eq(schema.filamentSpools.id, spoolId));
    expect(spool.remainingGrams).toBe(88); // 300 − 212
    const movements = await db
      .select()
      .from(schema.filamentMovements)
      .where(eq(schema.filamentMovements.spoolId, spoolId));
    expect(movements.reduce((s, m) => s + m.deltaGrams, 0)).toBe(88);
    expect(movements.find((m) => m.grossGrams === 463)).toMatchObject({
      tareGrams: 212,
      gramsAfter: 251,
    });
    expect(spool.lastWeighedAt).toBeTruthy();
  });

  it("une consommation plus grande que le restant s'arrête à zéro, une clé rejouée n'écrit rien", async () => {
    const ref = await studioRef();
    const spoolId = await newSpool(ref.id, 50);
    const first = await db.transaction((tx) =>
      recordMovement(tx, {
        spoolId,
        kind: "consumption",
        delta: -80,
        key: `${tag}-k1`,
      }),
    );
    expect(first).toMatchObject({ after: 0, delta: -50, duplicate: false });
    const again = await db.transaction((tx) =>
      recordMovement(tx, {
        spoolId,
        kind: "consumption",
        delta: -80,
        key: `${tag}-k1`,
      }),
    );
    expect(again.duplicate).toBe(true);
    const [spool] = await db
      .select()
      .from(schema.filamentSpools)
      .where(eq(schema.filamentSpools.id, spoolId));
    expect(spool.remainingGrams).toBe(0);
    expect(spool.sealed).toBe(false);
  });

  it("une bobine inconnue lève une erreur de journal", async () => {
    await expect(
      db.transaction((tx) =>
        recordMovement(tx, {
          spoolId: "n-existe-pas",
          kind: "adjust",
          delta: 1,
        }),
      ),
    ).rejects.toBeInstanceOf(LedgerError);
  });

  it("réception d'un achat : stock, support créé, coût réparti au centime", async () => {
    const ref = await studioRef();
    const [purchase] = await db
      .insert(schema.filamentPurchases)
      .values({ reference: tag, status: "ordered" })
      .returning();
    ids.purchases.push(purchase.id);
    for (const type of ["bambu_reusable", "bambu_refill"] as const) {
      await newSpool(ref.id, 0, {
        purchaseId: purchase.id,
        spoolType: type,
        status: "ordered",
        sealed: true,
      });
    }
    const holdersBefore = await db.select().from(schema.filamentHolders);
    const before = await available(ref.id);
    const result = await db.transaction((tx) =>
      receivePurchase(tx, purchase.id, { totalCents: 3333, actorId: "t" }),
    );
    expect(result.received).toBe(2);
    expect(await available(ref.id)).toBe(before + 2000);
    const spools = await db
      .select()
      .from(schema.filamentSpools)
      .where(eq(schema.filamentSpools.purchaseId, purchase.id));
    expect(spools.every((s) => s.status === "in_stock" && s.sealed)).toBe(true);
    expect(spools.reduce((s, x) => s + (x.costCents ?? 0), 0)).toBe(3333);
    const holdersAfter = await db.select().from(schema.filamentHolders);
    for (const h of holdersAfter.filter(
      (x) => !holdersBefore.some((b) => b.id === x.id),
    ))
      ids.holders.push(h.id);
    expect(holdersAfter.length).toBeGreaterThan(holdersBefore.length);
    // Une seconde réception ne fait rien.
    const twice = await db.transaction((tx) =>
      receivePurchase(tx, purchase.id, { actorId: "t" }),
    );
    expect(twice.received).toBe(0);
    expect(await available(ref.id)).toBe(before + 2000);
  });

  it("les supports libres : une bobine qui se vide libère le sien", async () => {
    const ref = await studioRef();
    const [holder] = await db
      .insert(schema.filamentHolders)
      .values({ tareGrams: 212, note: tag })
      .returning();
    ids.holders.push(holder.id);
    const free0 = await countFreeHolders(db);
    const spoolId = await newSpool(ref.id, 500, { holderId: holder.id });
    expect(await countFreeHolders(db)).toBe(free0 - 1);
    await db.transaction((tx) =>
      recordMovement(tx, { spoolId, kind: "empty", absolute: 0 }),
    );
    expect(await countFreeHolders(db)).toBe(free0);
  });

  it("réservé : commande en attente, payée, puis décomptée ; devis accepté", async () => {
    const ref = await studioRef();
    await newSpool(ref.id, 1000);
    const base = await available(ref.id);

    await studioOrder({ [STUDIO_ID]: 100 }, "pending", 2);
    expect(await available(ref.id)).toBe(base - 200);

    const paid = await studioOrder({ [STUDIO_ID]: 50 }, "paid");
    expect(await available(ref.id)).toBe(base - 250);

    // Une commande en attente dont la réservation a expiré ne réserve plus.
    const expired = await studioOrder({ [STUDIO_ID]: 400 }, "pending");
    await db
      .update(schema.orders)
      .set({ reservationExpiresAt: new Date(Date.now() - 3600_000) })
      .where(eq(schema.orders.id, expired));
    expect(await available(ref.id)).toBe(base - 250);

    // Décompte : la commande payée ne réserve plus, les grammes sortent de la bobine.
    const spoolId = (
      await db
        .select()
        .from(schema.filamentSpools)
        .where(eq(schema.filamentSpools.refId, ref.id))
    ).find((s) => s.note === tag && s.remainingGrams === 1000)!.id;
    await db.transaction((tx) =>
      consumeForSource(tx, { orderId: paid }, [{ spoolId, grams: 55 }], "t"),
    );
    expect(await available(ref.id)).toBe(base - 200 - 55);
    await expect(
      db.transaction((tx) =>
        consumeForSource(tx, { orderId: paid }, [{ spoolId, grams: 55 }], "t"),
      ),
    ).rejects.toMatchObject({ code: "already_consumed" });
    await db.transaction((tx) => undoConsumption(tx, { orderId: paid }, "t"));
    expect(await available(ref.id)).toBe(base - 250);

    // Devis : réserve dès « accepté », avec les grammes saisis.
    const quoteId = `${tag}-q`;
    ids.quotes.push(quoteId);
    await db.insert(schema.quoteRequests).values({
      id: quoteId,
      email: "stock@example.invalid",
      description: "Test du stock de filament",
      status: "quoted",
    });
    await db
      .insert(schema.filamentQuoteDetails)
      .values({ quoteId, plan: { [ref.id]: 120 } });
    expect(await available(ref.id)).toBe(base - 250);
    await db
      .update(schema.quoteRequests)
      .set({ status: "accepted" })
      .where(eq(schema.quoteRequests.id, quoteId));
    expect(await available(ref.id)).toBe(base - 250 - 120);
  });

  it("le contrôle du paiement refuse ce que le stock ne couvre pas, et ignore une couleur non suivie", async () => {
    const ref = await studioRef();
    await newSpool(ref.id, 1000);
    const room = await available(ref.id);
    expect(await checkStudioStock(db, { [STUDIO_ID]: room - 20 })).toEqual({
      status: "ok",
    });
    const short = await checkStudioStock(db, { [STUDIO_ID]: room - 19 });
    expect(short.status).toBe("short");
    expect(covers(room, room - 19)).toBe(false);
    // Un id sans référence en base (non suivi) passe.
    expect(
      (await checkStudioStock(db, { "vert-foret": 0, [STUDIO_ID]: 1 })).status,
    ).toBe("ok");
  });

  it("deux paiements simultanés pour le dernier stock : un seul passe (verrou consultatif)", async () => {
    const ref = await studioRef();
    await newSpool(ref.id, 1000);
    const room = await available(ref.id);
    const need = Math.ceil((room - 20) * 0.6);

    async function attempt(n: number) {
      return db.transaction(async (tx) => {
        await lockStockChecks(tx);
        const check = await checkStudioStock(tx, { [STUDIO_ID]: need });
        if (check.status === "short") return false;
        // Laisse à l'autre transaction le temps d'essayer de passer devant.
        await new Promise((r) => setTimeout(r, 150));
        const id = `${tag}-race-${n}`;
        ids.orders.push(id);
        await tx.insert(schema.orders).values({
          id,
          orderNumber: id,
          email: "stock@example.invalid",
          status: "pending",
          subtotalCents: 1000,
          shippingCents: 0,
          totalCents: 1000,
          shippingAddress: "{}",
          reservationExpiresAt: new Date(Date.now() + 3600_000),
        });
        await tx.insert(schema.orderItems).values({
          orderId: id,
          nameSnapshot: "Course",
          priceCentsSnapshot: 1000,
          quantity: 1,
          studio: {
            v: 1,
            filamentGrams: { [STUDIO_ID]: need },
          } as unknown as StudioOrderLine,
        });
        return true;
      });
    }
    const results = await Promise.all([attempt(1), attempt(2)]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it("ligne du Studio validée : besoin par couleur, refus tant que le stock manque, puis acceptation", async () => {
    const checked = validateStudioLine(
      studioLineInputSchema.parse({
        kind: "studio",
        object: "borne",
        config: JSON.parse(JSON.stringify(BORNE_DEFAULT)),
        texts: { text: "Léa" },
        locale: "fr",
        quantity: 2,
      }),
    );
    if (!checked.ok) throw new Error("ligne du Studio refusée");
    const { line } = checked;
    expect(Object.keys(line.filamentGrams).sort()).toEqual(
      [BORNE_DEFAULT.base, BORNE_DEFAULT.ink].sort(),
    );
    expect(line.snapshot.filamentGrams).toEqual(line.filamentGrams);
    const needs = sumGrams([scaleGrams(line.filamentGrams, line.quantity)]);

    const huge = scaleGrams(needs, 1000);
    expect((await checkStudioStock(db, huge)).status).toBe("short");

    for (const [studioId, grams] of Object.entries(needs)) {
      const ref = await studioRef(studioId);
      await newSpool(
        ref.id,
        Math.max(0, await available(ref.id)) + (grams ?? 0) + 100,
      );
    }
    expect((await checkStudioStock(db, needs)).status).toBe("ok");
  });

  it("allocateCents répartit sans perdre un centime", () => {
    expect(allocateCents(3333, [1699, 1999])).toEqual([1531, 1802]);
    expect(allocateCents(100, [1, 1, 1]).reduce((s, x) => s + x, 0)).toBe(100);
  });

  afterAll(async () => {
    if (ids.quotes.length) {
      await db
        .delete(schema.filamentQuoteDetails)
        .where(inArray(schema.filamentQuoteDetails.quoteId, ids.quotes));
      await db
        .delete(schema.quoteRequests)
        .where(inArray(schema.quoteRequests.id, ids.quotes));
    }
    if (ids.orders.length) {
      await db
        .delete(schema.filamentConsumptions)
        .where(inArray(schema.filamentConsumptions.orderId, ids.orders));
      await db
        .delete(schema.orders)
        .where(inArray(schema.orders.id, ids.orders));
    }
    if (ids.spools.length) {
      await db
        .delete(schema.filamentMovements)
        .where(inArray(schema.filamentMovements.spoolId, ids.spools));
      await db
        .delete(schema.filamentSpools)
        .where(inArray(schema.filamentSpools.id, ids.spools));
    }
    if (ids.holders.length)
      await db
        .delete(schema.filamentHolders)
        .where(inArray(schema.filamentHolders.id, ids.holders));
    if (ids.purchases.length)
      await db
        .delete(schema.filamentPurchases)
        .where(inArray(schema.filamentPurchases.id, ids.purchases));
    if (ids.refs.length)
      await db
        .delete(schema.filamentRefs)
        .where(inArray(schema.filamentRefs.id, ids.refs));
    await pool.end();
  });
});
