import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { and, eq, inArray, like } from "drizzle-orm";
import * as schema from "@/db/schema";
import { currentCartSnapshot } from "./cart-snapshot";
import { getStripe } from "./stripe";
import { getOrderCheckout } from "./checkout-session";
import { markOrderPaid, markQuotePaid } from "./orders";
import { reserveStock, releaseOrderStock } from "./stock";
import { drainEmailOutbox, queueEmail } from "./outbox";
import { consumeRequestLimit } from "./rate-limit";

const database = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/db", () => ({ getDb: async () => database.current }));
const mail = vi.hoisted(() => ({
  send: vi.fn<() => Promise<boolean>>(async () => true),
}));
vi.mock("@/lib/email", () => ({
  getAdminEmails: async () => [],
  sendEmail: mail.send,
}));
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: async () => ({
    env: {
      STRIPE_SECRET_KEY: process.env.INTEGRATION_STRIPE_TEST_KEY,
      BETTER_AUTH_URL: "https://swiss3design-preview.thomastp.workers.dev",
    },
  }),
}));
const url = process.env.INTEGRATION_DATABASE_URL;
const stripeKey = process.env.INTEGRATION_STRIPE_TEST_KEY;
describe.skipIf(!url)("Paiements sur Postgres preview isolé", () => {
  const pool = new Pool({ connectionString: url, max: 5 });
  const db = drizzle(pool, { schema });
  const ids: string[] = [];
  const products: string[] = [];
  const quotes: string[] = [];
  const keys: string[] = [];
  const limitNamespaces: string[] = [];
  beforeAll(() => {
    database.current = db;
    if (
      !url ||
      !(
        new URL(url).hostname ===
          "ep-green-tooth-aswk3vbr.c-4.eu-central-1.aws.neon.tech" ||
        (process.env.CI === "true" &&
          new URL(url).hostname === "127.0.0.1" &&
          new URL(url).pathname === "/swiss3design_ci")
      )
    )
      throw new Error(
        "Tests autorisés uniquement sur la branche preview identifiée",
      );
  });
  beforeEach(() => mail.send.mockReset().mockResolvedValue(true));
  async function fixture(stock = 2, quantity = 1) {
    const id = crypto.randomUUID(),
      productId = crypto.randomUUID();
    ids.push(id);
    products.push(productId);
    await db.insert(schema.products).values({
      id: productId,
      slug: "audit-test-" + productId,
      priceCents: 1000,
      stock,
      active: false,
    });
    await db.insert(schema.orders).values({
      id,
      orderNumber: "TEST-" + id,
      email: "audit@example.invalid",
      subtotalCents: 1000 * quantity,
      shippingCents: 0,
      totalCents: 1000 * quantity,
      shippingAddress: JSON.stringify({
        name: "Audit",
        street: "Test",
        npa: "1000",
        city: "Test",
        country: "CH",
      }),
    });
    await db.insert(schema.orderItems).values({
      orderId: id,
      productId,
      nameSnapshot: "Test",
      priceCentsSnapshot: 1000,
      quantity,
    });
    return {
      id,
      productId,
      proof: { id: "pi_test_" + id, amount: 1000 * quantity, currency: "chf" },
    };
  }
  it("deux finalisations concurrentes ne débitent le stock qu'une fois", async () => {
    const f = await fixture();
    await Promise.all([
      markOrderPaid(db, f.id, f.proof),
      markOrderPaid(db, f.id, f.proof),
    ]);
    const [product] = await db
      .select()
      .from(schema.products)
      .where(eq(schema.products.id, f.productId));
    const [order] = await db
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.id, f.id));
    expect(product.stock).toBe(1);
    expect(order.paidAt).toBeTruthy();
    const messages = await db
      .select()
      .from(schema.emailOutbox)
      .where(eq(schema.emailOutbox.key, "order-confirmation:" + f.id));
    expect(messages).toHaveLength(1);
    const paidEvents = await db
      .select()
      .from(schema.statusEvents)
      .where(
        and(
          eq(schema.statusEvents.entityType, "order"),
          eq(schema.statusEvents.entityId, f.id),
          eq(schema.statusEvents.toStatus, "paid"),
        ),
      );
    expect(paidEvents).toHaveLength(1);
  });
  it("revisiter après expédition ne réinitialise ni le statut ni le stock", async () => {
    const f = await fixture();
    await markOrderPaid(db, f.id, f.proof);
    await db
      .update(schema.orders)
      .set({ status: "shipped" })
      .where(eq(schema.orders.id, f.id));
    await markOrderPaid(db, f.id, f.proof);
    expect(
      (
        await db.select().from(schema.orders).where(eq(schema.orders.id, f.id))
      )[0].status,
    ).toBe("shipped");
    expect(
      (
        await db
          .select()
          .from(schema.products)
          .where(eq(schema.products.id, f.productId))
      )[0].stock,
    ).toBe(1);
  });
  it("une panne métier annule toute la transaction et autorise la reprise", async () => {
    const f = await fixture(0);
    await expect(markOrderPaid(db, f.id, f.proof)).rejects.toThrow(
      "insufficient_stock",
    );
    expect(
      (
        await db.select().from(schema.orders).where(eq(schema.orders.id, f.id))
      )[0].status,
    ).toBe("pending");
    await db
      .update(schema.products)
      .set({ stock: 1 })
      .where(eq(schema.products.id, f.productId));
    await markOrderPaid(db, f.id, f.proof);
    expect(
      (
        await db.select().from(schema.orders).where(eq(schema.orders.id, f.id))
      )[0].status,
    ).toBe("paid");
  });
  it("un montant ou un identifiant différent ne produit aucun effet", async () => {
    const f = await fixture();
    await expect(
      markOrderPaid(db, f.id, { ...f.proof, amount: 1 }),
    ).rejects.toThrow("payment_mismatch");
    await markOrderPaid(db, f.id, f.proof);
    await expect(
      markOrderPaid(db, f.id, { ...f.proof, id: "pi_other" }),
    ).rejects.toThrow("payment_mismatch");
  });
  it("deux réservations concurrentes du dernier article : une seule réussit", async () => {
    const f = await fixture(1);
    const results = await Promise.allSettled(
      [1, 2].map(() =>
        db.transaction((tx) =>
          reserveStock(tx, [{ productId: f.productId, quantity: 1 }], f.id),
        ),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(
      (
        await db
          .select()
          .from(schema.products)
          .where(eq(schema.products.id, f.productId))
      )[0].stock,
    ).toBe(0);
  });
  it("des couleurs qui partagent le stock sont additionnées", async () => {
    const f = await fixture(1);
    await expect(
      db.transaction((tx) =>
        reserveStock(
          tx,
          [
            { productId: f.productId, quantity: 1 },
            { productId: f.productId, quantity: 1 },
          ],
          f.id,
        ),
      ),
    ).rejects.toThrow("insufficient_stock");
    expect(
      (
        await db
          .select()
          .from(schema.products)
          .where(eq(schema.products.id, f.productId))
      )[0].stock,
    ).toBe(1);
  });
  it("une réservation expirée est libérée une seule fois", async () => {
    const f = await fixture(2);
    await db.transaction(async (tx) => {
      await reserveStock(tx, [{ productId: f.productId, quantity: 1 }], f.id);
      await tx
        .update(schema.orders)
        .set({ stockReservedAt: new Date() })
        .where(eq(schema.orders.id, f.id));
    });
    await Promise.all([
      db.transaction((tx) => releaseOrderStock(tx, f.id)),
      db.transaction((tx) => releaseOrderStock(tx, f.id)),
    ]);
    expect(
      (
        await db
          .select()
          .from(schema.products)
          .where(eq(schema.products.id, f.productId))
      )[0].stock,
    ).toBe(2);
  });
  it("une vente déjà réservée n'est pas débitée une seconde fois", async () => {
    const f = await fixture(2);
    await db.transaction(async (tx) => {
      await reserveStock(tx, [{ productId: f.productId, quantity: 1 }], f.id);
      await tx
        .update(schema.orders)
        .set({ stockReservedAt: new Date() })
        .where(eq(schema.orders.id, f.id));
    });
    await markOrderPaid(db, f.id, f.proof);
    expect(
      (
        await db
          .select()
          .from(schema.products)
          .where(eq(schema.products.id, f.productId))
      )[0].stock,
    ).toBe(1);
    await db.transaction((tx) => releaseOrderStock(tx, f.id));
    expect(
      (
        await db
          .select()
          .from(schema.products)
          .where(eq(schema.products.id, f.productId))
      )[0].stock,
    ).toBe(1);
  });
  it("le prix et la version d'un devis doivent correspondre au paiement", async () => {
    const id = crypto.randomUUID();
    quotes.push(id);
    await db.insert(schema.quoteRequests).values({
      id,
      email: "audit@example.invalid",
      description: "Test isolé",
      status: "quoted",
      quotedPriceCents: 1500,
      offerVersion: 2,
    });
    await expect(
      markQuotePaid(db, id, {
        id: "pi_q_" + id,
        amount: 1500,
        currency: "chf",
        offerVersion: 1,
      }),
    ).rejects.toThrow("quote_payment_requires_reconciliation");
    await markQuotePaid(db, id, {
      id: "pi_q_" + id,
      amount: 1500,
      currency: "chf",
      offerVersion: 2,
    });
    await expect(
      markQuotePaid(db, id, {
        id: "pi_second_" + id,
        amount: 1500,
        currency: "chf",
        offerVersion: 2,
      }),
    ).rejects.toThrow("payment_mismatch");
    const paidEvents = await db
      .select()
      .from(schema.statusEvents)
      .where(
        and(
          eq(schema.statusEvents.entityType, "quote"),
          eq(schema.statusEvents.entityId, id),
          eq(schema.statusEvents.toStatus, "paid"),
        ),
      );
    expect(paidEvents).toHaveLength(1);
  });
  it("une réponse false de l'e-mail reste à reprendre", async () => {
    const key = "audit-mail:" + crypto.randomUUID();
    keys.push(key);
    await queueEmail(db, key, {
      to: "audit@example.invalid",
      subject: "Test",
      html: "Test",
    });
    mail.send.mockResolvedValue(false);
    await drainEmailOutbox(db, 100);
    const [row] = await db
      .select()
      .from(schema.emailOutbox)
      .where(eq(schema.emailOutbox.key, key));
    expect(row.sentAt).toBeNull();
    expect(row.attempts).toBe(1);
    await db
      .update(schema.emailOutbox)
      .set({ availableAt: new Date(0) })
      .where(eq(schema.emailOutbox.key, key));
    mail.send.mockResolvedValue(true);
    await drainEmailOutbox(db, 100);
    expect(
      (
        await db
          .select()
          .from(schema.emailOutbox)
          .where(eq(schema.emailOutbox.key, key))
      )[0].sentAt,
    ).toBeTruthy();
  });
  it("une relance supprimée après désinscription n'est plus envoyée", async () => {
    const key = "cart-reminder:" + crypto.randomUUID();
    keys.push(key);
    await queueEmail(db, key, {
      to: "audit@example.invalid",
      subject: "Rappel",
      html: "Test",
    });
    await drainEmailOutbox(db, 100);
    expect(mail.send).not.toHaveBeenCalled();
    expect(
      await db
        .select()
        .from(schema.emailOutbox)
        .where(eq(schema.emailOutbox.key, key)),
    ).toHaveLength(0);
  });
  it("le quota partagé reste atomique sous concurrence", async () => {
    const namespace = "audit-limit-" + crypto.randomUUID();
    limitNamespaces.push(namespace);
    const decisions = await Promise.all(
      Array.from({ length: 8 }, () =>
        consumeRequestLimit(db, namespace, "same-ip", {
          limit: 3,
          windowS: 60,
        }),
      ),
    );
    expect(decisions.filter((decision) => decision.allowed)).toHaveLength(3);
    expect(decisions.filter((decision) => !decision.allowed)).toHaveLength(5);
    expect(
      decisions.find((decision) => !decision.allowed)?.retryAfter,
    ).toBeGreaterThan(0);
  });
  it.skipIf(!stripeKey)(
    "Stripe TEST réutilise la session et confirme un paiement sans e-mail réel",
    async () => {
      if (!stripeKey?.startsWith("sk_test_"))
        throw new Error("Clé Stripe TEST obligatoire");
      const f = await fixture();
      const stripe = getStripe(stripeKey);
      const [order] = await db
        .select()
        .from(schema.orders)
        .where(eq(schema.orders.id, f.id));
      const [first, second] = await Promise.all([
        getOrderCheckout(db, order),
        getOrderCheckout(db, order),
      ]);
      try {
        expect(first.id).toBe(second.id);
        expect(first.livemode).toBe(false);
        expect(first.client_secret).toBeTruthy();
        expect(first.amount_total).toBe(order.totalCents);
        // Aucun identifiant métier dans les métadonnées : les webhooks externes
        // du compte Stripe ne déclenchent pas de notification. Envoi local simulé.
        const payment = await stripe.paymentIntents.create({
          amount: order.totalCents,
          currency: "chf",
          payment_method_types: ["card"],
          payment_method: "pm_card_visa",
          confirm: true,
          metadata: { audit: "preview-validation" },
        });
        expect(payment.status).toBe("succeeded");
        expect(payment.livemode).toBe(false);
        await markOrderPaid(db, order.id, {
          id: payment.id,
          amount: payment.amount_received,
          currency: payment.currency,
        });
        await markOrderPaid(db, order.id, {
          id: payment.id,
          amount: payment.amount_received,
          currency: payment.currency,
        });
        expect(
          (
            await db
              .select()
              .from(schema.products)
              .where(eq(schema.products.id, f.productId))
          )[0].stock,
        ).toBe(1);
      } finally {
        await stripe.checkout.sessions.expire(first.id);
      }
    },
    30000,
  );
  it("la restauration remplace le prix et l'image client par les données du catalogue", async () => {
    const f = await fixture(2);
    await db
      .update(schema.products)
      .set({ active: true })
      .where(eq(schema.products.id, f.productId));
    const restored = await currentCartSnapshot(
      [
        {
          productId: f.productId,
          slug: "faux",
          name: "Faux",
          priceCents: 1,
          quantity: 20,
          saleType: "stock",
          imageUrl: "https://example.invalid/image.png",
        },
      ],
      "fr",
    );
    expect(restored).toHaveLength(1);
    expect(restored[0].priceCents).toBe(1000);
    expect(restored[0].quantity).toBe(2);
    expect(restored[0].imageUrl).toBeNull();
    expect(restored[0].slug).toBe("audit-test-" + f.productId);
  });
  it("Postgres refuse un total de commande incohérent", async () => {
    const f = await fixture();
    await expect(
      db
        .update(schema.orders)
        .set({ totalCents: 999 })
        .where(eq(schema.orders.id, f.id)),
    ).rejects.toMatchObject({
      cause: { code: "23514", constraint: "orders_amounts_valid" },
    });
    expect(
      (
        await db.select().from(schema.orders).where(eq(schema.orders.id, f.id))
      )[0].totalCents,
    ).toBe(1000);
  });
  afterAll(async () => {
    const entityIds = [...ids, ...quotes];
    if (entityIds.length)
      await db
        .delete(schema.statusEvents)
        .where(inArray(schema.statusEvents.entityId, entityIds));
    if (ids.length) {
      await db.delete(schema.emailOutbox).where(
        inArray(
          schema.emailOutbox.key,
          ids.flatMap((id) => [
            "order-confirmation:" + id,
            "order-admin:" + id,
          ]),
        ),
      );
      await db.delete(schema.orders).where(inArray(schema.orders.id, ids));
    }
    if (products.length) {
      await db
        .delete(schema.inventoryLog)
        .where(inArray(schema.inventoryLog.variantId, products));
      await db
        .delete(schema.products)
        .where(inArray(schema.products.id, products));
    }
    if (quotes.length)
      await db
        .delete(schema.quoteRequests)
        .where(inArray(schema.quoteRequests.id, quotes));
    if (keys.length)
      await db
        .delete(schema.emailOutbox)
        .where(inArray(schema.emailOutbox.key, keys));
    for (const namespace of limitNamespaces)
      await db
        .delete(schema.requestLimits)
        .where(like(schema.requestLimits.key, namespace + ":%"));
    await pool.end();
  });
});
