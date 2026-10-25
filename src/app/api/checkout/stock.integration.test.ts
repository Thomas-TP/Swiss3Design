import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, inArray, like } from "drizzle-orm";
import * as schema from "@/db/schema";
import { loadStockSnapshot } from "@/lib/filament/stock-db";
import { recordMovement } from "@/lib/filament/ledger";
import { BORNE_DEFAULT } from "@/lib/studio/presets";
import {
  studioLineInputSchema,
  validateStudioLine,
} from "@/lib/studio/purchase";
import { scaleGrams, sumGrams } from "@/lib/studio/filament-need";
import type { StudioOrderLine } from "@/lib/studio/order-line";

// La route /api/checkout, de bout en bout contre la branche Neon PREVIEW, pour la
// part « stock de filament » : 409 out_of_stock avant toute écriture, acceptation
// quand le stock couvre, et UN SEUL des deux paiements simultanés pour le dernier
// stock. Seuls Stripe (reprise de session), l'authentification, le quota et les
// traductions sont simulés ; tout ce que le test crée est préfixé et nettoyé.
const database = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/db", () => ({ getDb: async () => database.current }));
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: async () => ({ env: {} }),
}));
vi.mock("@/lib/auth", () => ({
  getAuth: async () => ({
    api: {
      getSession: async ({ headers }: { headers: Headers }) => ({
        user: {
          id: "user-stock-test",
          email: headers.get("x-test-email"),
          emailVerified: true,
        },
      }),
    },
  }),
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: async () => true,
  tooManyRequests: () => new Response(null, { status: 429 }),
}));
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => key,
}));
vi.mock("@/lib/checkout-session", () => ({
  resumeOrderCheckout: async (_db: unknown, order: { id: string }) =>
    Response.json({ resumed: order.id }),
}));

const url = process.env.INTEGRATION_DATABASE_URL;

describe.skipIf(!url)(
  "POST /api/checkout : stock de filament (preview isolé)",
  () => {
    const pool = new Pool({ connectionString: url, max: 8 });
    const db = drizzle(pool, { schema });
    const tag = "route-" + crypto.randomUUID().slice(0, 8);
    const mine = {
      emails: [] as string[],
      spools: [] as string[],
      orders: [] as string[],
      refs: [] as string[],
    };
    let POST: (request: Request) => Promise<Response>;

    beforeAll(async () => {
      if (
        !url ||
        new URL(url).hostname !==
          "ep-green-tooth-aswk3vbr.c-4.eu-central-1.aws.neon.tech"
      )
        throw new Error(
          "Tests autorisés uniquement sur la branche preview identifiée",
        );
      database.current = db;
      ({ POST } = await import("./route"));
    });

    const email = () => {
      const value = `${tag}-${mine.emails.length}@example.invalid`;
      mine.emails.push(value);
      return value;
    };

    const studioItem = (quantity: number, config: object = BORNE_DEFAULT) => ({
      kind: "studio",
      object: "borne",
      config,
      texts: { text: "Léa" },
      locale: "fr",
      quantity,
    });

    function request(
      to: string,
      quantity: number,
      config: object = BORNE_DEFAULT,
    ) {
      return checkout(to, [studioItem(quantity, config)]);
    }

    function checkout(to: string, items: object[]) {
      return new Request("https://kreya.ch/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json", "x-test-email": to },
        body: JSON.stringify({
          items,
          email: to,
          address: {
            name: "Test Stock",
            street: "Rue du Test 1",
            npa: "1000",
            city: "Lausanne",
            canton: "VD",
          },
          locale: "fr",
          attemptId: crypto.randomUUID(),
        }),
      });
    }

    function needsOf(quantity: number) {
      const checked = validateStudioLine(
        studioLineInputSchema.parse({
          kind: "studio",
          object: "borne",
          config: JSON.parse(JSON.stringify(BORNE_DEFAULT)),
          texts: { text: "Léa" },
          locale: "fr",
          quantity,
        }),
      );
      if (!checked.ok) throw new Error("ligne refusée");
      return sumGrams([scaleGrams(checked.line.filamentGrams, quantity)]);
    }

    async function ref(studioId: string) {
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
          hex: "#808080",
          studioId,
        })
        .returning();
      mine.refs.push(created.id);
      return created;
    }

    /** Amène le disponible d'une couleur du Studio à `target` g (bobine d'appoint ou réservation). */
    async function setAvailable(studioId: string, target: number) {
      const r = await ref(studioId);
      const snap = await loadStockSnapshot(db, { studioIds: [studioId] });
      const now = snap.availability.get(r.id)!.available;
      if (now < target) {
        const [spool] = await db
          .insert(schema.filamentSpools)
          .values({
            refId: r.id,
            spoolType: "other",
            tareGrams: 0,
            initialGrams: 5000,
            remainingGrams: 0,
            status: "in_stock",
            note: tag,
          })
          .returning();
        mine.spools.push(spool.id);
        await db.transaction((tx) =>
          recordMovement(tx, {
            spoolId: spool.id,
            kind: "adjust",
            delta: target - now,
            note: tag,
          }),
        );
      } else if (now > target) {
        const id = `${tag}-hold-${mine.orders.length}`;
        mine.orders.push(id);
        await db.insert(schema.orders).values({
          id,
          orderNumber: id,
          email: `${id}@example.invalid`,
          status: "pending",
          subtotalCents: 1000,
          shippingCents: 0,
          totalCents: 1000,
          shippingAddress: "{}",
          reservationExpiresAt: new Date(Date.now() + 3600_000),
        });
        await db.insert(schema.orderItems).values({
          orderId: id,
          nameSnapshot: "Réservation de test",
          priceCentsSnapshot: 1000,
          quantity: 1,
          studio: {
            v: 1,
            filamentGrams: { [studioId]: now - target },
          } as unknown as StudioOrderLine,
        });
      }
    }

    async function ordersOf(to: string) {
      return db.select().from(schema.orders).where(eq(schema.orders.email, to));
    }

    it("couleur épuisée : 409 out_of_stock, aucune commande écrite", async () => {
      // Disponible ramené à 10 g (sous la réserve de 20 g) : tout besoin est refusé.
      for (const id of Object.keys(needsOf(1))) await setAvailable(id, 10);
      const to = email();
      const res = await POST(request(to, 1));
      expect(res.status).toBe(409);
      const body = (await res.json()) as { error: string; colors: string[] };
      expect(body.error).toBe("out_of_stock");
      expect(body.colors.sort()).toEqual(
        [BORNE_DEFAULT.base, BORNE_DEFAULT.ink].sort(),
      );
      expect(await ordersOf(to)).toHaveLength(0);
    });

    it("stock suffisant : la commande est créée et réserve ses grammes", async () => {
      const needs = needsOf(1);
      for (const [id, g] of Object.entries(needs))
        await setAvailable(id, (g ?? 0) + 200);
      const to = email();
      const res = await POST(request(to, 1));
      expect(res.status).toBe(200);
      const [order] = await ordersOf(to);
      expect(order.status).toBe("pending");
      const [item] = await db
        .select()
        .from(schema.orderItems)
        .where(eq(schema.orderItems.orderId, order.id));
      expect(item.studio?.filamentGrams).toEqual(
        Object.fromEntries(Object.entries(needs).map(([k, v]) => [k, v])),
      );
      for (const [id, g] of Object.entries(needs)) {
        const r = await ref(id);
        const snap = await loadStockSnapshot(db, { studioIds: [id] });
        expect(snap.availability.get(r.id)!.available).toBe(200);
        expect(g).toBeGreaterThan(0);
      }
    });

    it("deux paiements simultanés pour le dernier stock : un seul passe", async () => {
      const needs = needsOf(1);
      // Disponible = besoin + 20 g de réserve de fin de bobine + la moitié du besoin : une seule commande passe.
      for (const [id, g] of Object.entries(needs))
        await setAvailable(id, (g ?? 0) + 20 + Math.floor((g ?? 0) / 2));
      const a = email();
      const b = email();
      const [ra, rb] = await Promise.all([
        POST(request(a, 1)),
        POST(request(b, 1)),
      ]);
      expect([ra.status, rb.status].sort()).toEqual([200, 409]);
      const created = (await ordersOf(a)).length + (await ordersOf(b)).length;
      expect(created).toBe(1);
    });

    // Article de la boutique imprimé à la demande (100 g la pièce) : il réserve
    // poids × quantité + 10 % sur la référence choisie, comme le Studio.
    let productId: string | null = null;
    async function onDemandProduct() {
      if (productId) return productId;
      const [created] = await db
        .insert(schema.products)
        .values({
          slug: `${tag}-article`,
          priceCents: 1000,
          saleType: "on_demand",
          weightGrams: 100,
        })
        .returning();
      productId = created.id;
      return productId;
    }

    it("article à la demande : réserve poids × quantité + 10 % sur sa référence", async () => {
      const product = await onDemandProduct();
      const r = await ref(BORNE_DEFAULT.base);
      // 2 pièces de 100 g : ceil(200 × 1,10) = 220 g.
      await setAvailable(BORNE_DEFAULT.base, 220 + 200);
      const to = email();
      const res = await POST(
        checkout(to, [{ productId: product, colorRef: r.id, quantity: 2 }]),
      );
      expect(res.status).toBe(200);
      const [order] = await ordersOf(to);
      const [item] = await db
        .select()
        .from(schema.orderItems)
        .where(eq(schema.orderItems.orderId, order.id));
      expect(item.colorName).toBeTruthy();
      expect(item.colorHex).toBe(r.hex);
      const [reserved] = await db
        .select()
        .from(schema.orderItemFilaments)
        .where(eq(schema.orderItemFilaments.orderItemId, item.id));
      expect(reserved).toMatchObject({ refId: r.id, gramsPerPiece: 100 });
      const snap = await loadStockSnapshot(db, { refIds: [r.id] });
      expect(snap.availability.get(r.id)!.available).toBe(200);
    });

    it("Studio + boutique sur la même bobine : le besoin CUMULÉ est contrôlé", async () => {
      const product = await onDemandProduct();
      const r = await ref(BORNE_DEFAULT.base);
      const needs = needsOf(1);
      for (const [id, g] of Object.entries(needs))
        await setAvailable(id, (g ?? 0) + 200);
      // Base : chaque ligne passerait seule (réserve de 20 g comprise), pas les deux
      // ensemble (besoin Studio + 110 g de la pièce de boutique).
      const base = needs[BORNE_DEFAULT.base] ?? 0;
      await setAvailable(BORNE_DEFAULT.base, base + 110 + 20 - 1);
      const to = email();
      const res = await POST(
        checkout(to, [
          studioItem(1),
          { productId: product, colorRef: r.id, quantity: 1 },
        ]),
      );
      expect(res.status).toBe(409);
      const body = (await res.json()) as { error: string; refs: string[] };
      expect(body.error).toBe("out_of_stock");
      expect(body.refs).toEqual([r.id]);
      expect(await ordersOf(to)).toHaveLength(0);
    });

    it("article à couleurs sans couleur : 400 color_required", async () => {
      const product = await onDemandProduct();
      const to = email();
      const res = await POST(
        checkout(to, [{ productId: product, quantity: 1 }]),
      );
      expect(res.status).toBe(400);
      expect(((await res.json()) as { error: string }).error).toBe(
        "color_required",
      );
    });

    afterAll(async () => {
      const orderRows = mine.emails.length
        ? await db
            .select({ id: schema.orders.id })
            .from(schema.orders)
            .where(inArray(schema.orders.email, mine.emails))
        : [];
      const orderIds = [...orderRows.map((o) => o.id), ...mine.orders];
      if (orderIds.length) {
        await db
          .delete(schema.statusEvents)
          .where(inArray(schema.statusEvents.entityId, orderIds));
        await db
          .delete(schema.orders)
          .where(inArray(schema.orders.id, orderIds));
      }
      await db
        .delete(schema.orders)
        .where(like(schema.orders.email, `${tag}%`));
      if (productId)
        await db
          .delete(schema.products)
          .where(eq(schema.products.id, productId));
      if (mine.spools.length) {
        await db
          .delete(schema.filamentMovements)
          .where(inArray(schema.filamentMovements.spoolId, mine.spools));
        await db
          .delete(schema.filamentSpools)
          .where(inArray(schema.filamentSpools.id, mine.spools));
      }
      if (mine.refs.length)
        await db
          .delete(schema.filamentRefs)
          .where(inArray(schema.filamentRefs.id, mine.refs));
      await pool.end();
    });
  },
);
