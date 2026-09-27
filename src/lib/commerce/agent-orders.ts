import { and, eq, gte, or, sql } from "drizzle-orm";
import type { getDb } from "@/db";
import {
  inventoryLog,
  orderItems,
  orders,
  products,
  productVariants,
  type ORDER_CHANNELS,
} from "@/db/schema";
import { uncached } from "@/db/fresh";
import { getAdminEmails } from "@/lib/email";
import {
  adminNewOrderEmail,
  orderConfirmationEmail,
} from "@/lib/email-templates";
import { drainEmailOutbox, queueEmail, type Transaction } from "@/lib/outbox";
import { makeOrderNumber } from "@/lib/order-number";
import { recordStatusTransition } from "@/lib/status-history";
import type { SellableSku } from "./catalog";

type Db = Awaited<ReturnType<typeof getDb>>;
type Order = typeof orders.$inferSelect;
export type AgentChannel = Exclude<(typeof ORDER_CHANNELS)[number], "web">;
export type OrderLocale = "fr" | "de" | "it" | "en";

// Enregistrement d'une commande déjà PAYÉE par un agent IA (Stripe Agentic
// Commerce, puis MPP/ACP/UCP/x402). À la différence du checkout web — qui
// réserve le stock avant le paiement —, l'argent est déjà encaissé quand on
// arrive ici : rien ne doit empêcher la commande d'exister. Un stock devenu
// insuffisant, un article retiré ou une adresse hors de Suisse ne font donc
// jamais échouer l'enregistrement ; ils deviennent des alertes pour l'admin
// (rembourser ou prévenir le client). Idempotent sur la session Stripe et le
// PaymentIntent (index uniques) : un webhook rejoué ne crée jamais de doublon.

export interface AgentOrderLine {
  // null : SKU inconnu au moment de l'enregistrement (fiche retirée entre
  // l'achat et le webhook) — la ligne reste, avec le libellé payé.
  sku: SellableSku | null;
  skuId: string;
  name: string;
  colorName: string | null;
  colorHex: string | null;
  unitCents: number;
  quantity: number;
}

export interface AgentShippingAddress {
  name: string;
  street: string;
  npa: string;
  city: string;
  canton: string;
  country: string;
}

export interface PaidAgentOrder {
  channel: AgentChannel;
  agentName: string | null;
  email: string;
  locale: OrderLocale;
  address: AgentShippingAddress;
  lines: AgentOrderLine[];
  subtotalCents: number;
  shippingCents: number;
  discountCents: number;
  totalCents: number;
  paymentIntentId: string | null;
  checkoutSessionId: string | null;
  notes: string[];
}

// Langue de l'acheteur à défaut d'indication : la région linguistique du NPA
// (Tessin → italien, Romandie → français, reste → allemand). Approximation
// assumée pour la seule langue des e-mails.
export function localeFromNpa(npa: string): OrderLocale {
  if (!/^\d{4}$/.test(npa.trim())) return "fr";
  const code = Number(npa);
  if (code >= 6500 && code <= 6999) return "it";
  if (code >= 1000 && code <= 2999) return "fr";
  return "de";
}

export function isOrderLocale(value: unknown): value is OrderLocale {
  return value === "fr" || value === "de" || value === "it" || value === "en";
}

// Adresse Stripe (`line1`, `postal_code`…) → format des commandes du site.
export function toShippingAddress(
  name: string | null | undefined,
  address:
    | {
        line1?: string | null;
        line2?: string | null;
        city?: string | null;
        postal_code?: string | null;
        state?: string | null;
        country?: string | null;
      }
    | null
    | undefined,
): AgentShippingAddress {
  const state = (address?.state ?? "").trim().toUpperCase();
  return {
    name: (name ?? "").trim().slice(0, 120),
    street: [address?.line1, address?.line2]
      .map((part) => (part ?? "").trim())
      .filter(Boolean)
      .join(", ")
      .slice(0, 200),
    npa: (address?.postal_code ?? "").trim().slice(0, 10),
    city: (address?.city ?? "").trim().slice(0, 120),
    canton: /^[A-Z]{2}$/.test(state) ? state : "",
    country: (address?.country ?? "").trim().toUpperCase(),
  };
}

async function findExisting(db: Db | Transaction, draft: PaidAgentOrder) {
  const keys = [
    draft.checkoutSessionId
      ? eq(orders.checkoutSessionId, draft.checkoutSessionId)
      : undefined,
    draft.paymentIntentId
      ? eq(orders.stripePaymentIntentId, draft.paymentIntentId)
      : undefined,
  ].filter((k) => k !== undefined);
  if (!keys.length) return null;
  const [existing] = await db
    .select()
    .from(orders)
    .where(and(or(...keys), uncached))
    .limit(1);
  return existing ?? null;
}

// Décrément du stock suivi, sans jamais échouer : le manque éventuel est
// renvoyé pour l'alerte admin. Même trace « reservation:<commande> » que le
// checkout web, pour que l'historique de stock reste homogène.
async function takeStock(
  tx: Transaction,
  lines: AgentOrderLine[],
  orderId: string,
) {
  const buckets = new Map<
    string,
    { sku: SellableSku; quantity: number; label: string }
  >();
  for (const line of lines) {
    if (!line.sku) continue;
    const bucket = buckets.get(line.sku.stockKey);
    buckets.set(line.sku.stockKey, {
      sku: line.sku,
      quantity: (bucket?.quantity ?? 0) + line.quantity,
      label: line.sku.lineName,
    });
  }
  const shortfalls: string[] = [];
  const lowStock: { name: string; stock: number }[] = [];
  for (const [key, bucket] of [...buckets].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const table = bucket.sku.variantId ? productVariants : products;
    const id = bucket.sku.variantId ?? bucket.sku.productId;
    const [taken] = await tx
      .update(table)
      .set({ stock: sql`${table.stock} - ${bucket.quantity}` })
      .where(and(eq(table.id, id), gte(table.stock, bucket.quantity)))
      .returning({ stock: table.stock });
    if (taken) {
      await tx.insert(inventoryLog).values({
        variantId: id,
        delta: -bucket.quantity,
        reason: "reservation:" + orderId,
      });
      if (taken.stock != null && taken.stock <= 2)
        lowStock.push({ name: bucket.label, stock: taken.stock });
      continue;
    }
    const [current] = await tx
      .select({ stock: table.stock })
      .from(table)
      .where(eq(table.id, id));
    // Stock non suivi (impression à la demande) : rien à décrémenter.
    if (!current || current.stock == null) continue;
    shortfalls.push(
      `Stock insuffisant pour « ${bucket.label} » : ${bucket.quantity} vendu(s), ${current.stock} disponible(s) (${key}). Prévenir le client : délai de fabrication ou remboursement.`,
    );
  }
  return { shortfalls, lowStock };
}

export function isUniqueViolation(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = error;
  // Drizzle enveloppe l'erreur pg : on remonte les `cause`.
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    if ((current as { code?: string }).code === "23505") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

export async function recordPaidAgentOrder(
  db: Db,
  draft: PaidAgentOrder,
): Promise<{ order: Order; created: boolean }> {
  const existing = await findExisting(db, draft);
  if (existing) return { order: existing, created: false };
  const admins = await getAdminEmails();
  const orderId = crypto.randomUUID();
  let order: Order;
  try {
    order = await db.transaction(async (tx) => {
      const { shortfalls, lowStock } = await takeStock(
        tx,
        draft.lines,
        orderId,
      );
      const notes = [...draft.notes, ...shortfalls];
      const [created] = await tx
        .insert(orders)
        .values({
          id: orderId,
          orderNumber: makeOrderNumber(),
          customerId: null,
          email: draft.email,
          status: "paid",
          subtotalCents: draft.subtotalCents,
          shippingCents: draft.shippingCents,
          discountCents: draft.discountCents,
          totalCents: draft.totalCents,
          shippingAddress: JSON.stringify(draft.address),
          stripePaymentIntentId: draft.paymentIntentId,
          checkoutSessionId: draft.checkoutSessionId,
          paidAt: new Date(),
          stockReservedAt: new Date(),
          adminNote: notes.length ? notes.join("\n") : null,
          locale: draft.locale,
          channel: draft.channel,
          agentName: draft.agentName,
        })
        .returning();
      const items = draft.lines.map((line) => ({
        orderId,
        productId: line.sku?.productId ?? null,
        variantId: line.sku?.variantId ?? null,
        nameSnapshot: line.name,
        colorName: line.colorName,
        colorHex: line.colorHex,
        priceCentsSnapshot: line.unitCents,
        quantity: line.quantity,
      }));
      await tx.insert(orderItems).values(items);
      await recordStatusTransition(tx, {
        entityType: "order",
        entityId: orderId,
        fromStatus: null,
        toStatus: "paid",
        source: "payment",
      });
      await queueEmail(
        tx,
        "order-confirmation:" + orderId,
        orderConfirmationEmail(created, items),
      );
      if (admins.length)
        await queueEmail(
          tx,
          "order-admin:" + orderId,
          adminNewOrderEmail(created, items, admins, lowStock),
        );
      return created;
    });
  } catch (error) {
    // Deux livraisons simultanées du même webhook : la seconde retrouve la
    // commande créée par la première.
    if (isUniqueViolation(error)) {
      const again = await findExisting(db, draft);
      if (again) return { order: again, created: false };
    }
    throw error;
  }
  try {
    await drainEmailOutbox(db);
  } catch {
    console.error("[outbox] reprise par maintenance");
  }
  return { order, created: true };
}
