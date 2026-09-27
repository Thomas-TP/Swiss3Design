import type Stripe from "stripe";
import { and, eq, lt, or } from "drizzle-orm";
import type { getDb } from "@/db";
import { agentCheckoutSessions, orders } from "@/db/schema";
import { uncached } from "@/db/fresh";
import { getShippingSettings } from "@/lib/shipping-settings";
import { loadSellableSkus, skuIndex, type SellableSku } from "./catalog";
import {
  buildQuote,
  CheckoutError,
  createPendingAgentOrder,
  normalizeEmail,
  payOrderWithSpt,
  resolveLine,
  sha256Hex,
  swissAddress,
  type AddressInput,
  type LineRequest,
  type Quote,
  type SwissAddress,
} from "./checkout-core";
import type { OrderLocale } from "./agent-orders";
import type { ShippingRule } from "./feed";
import { pushCatalogChange } from "./stripe-catalog";

type Db = Awaited<ReturnType<typeof getDb>>;
type Order = typeof orders.$inferSelect;

// Moteur commun des sessions de checkout ACP et UCP : les deux protocoles
// décrivent le même parcours (panier → acheteur → adresse → livraison →
// paiement par jeton). L'état vit en base (JSON), chaque réponse est
// recalculée au prix et au stock du moment ; seul le format de sortie diffère
// (acp-protocol.ts, ucp-protocol.ts).

export type Protocol = "acp" | "ucp";
export type SessionRow = typeof agentCheckoutSessions.$inferSelect;

const SESSION_TTL_MS = 6 * 3600 * 1000;
// Compte Stripe (identifiant public) : destinataire des jetons, avec le
// profil réseau STRIPE_PROFILE_ID.
export const STRIPE_ACCOUNT_ID = "acct_1TgkbnK4o7ey3lG5";
export const SHIPPING_OPTION_ID = "swiss_post";

export interface SessionItem {
  lineId: string;
  sku: string;
  quantity: number;
}

export interface SessionBuyer {
  email?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  phone?: string;
}

export interface SessionState {
  items: SessionItem[];
  buyer: SessionBuyer;
  address: AddressInput | null;
  locale: OrderLocale;
}

export interface Issue {
  code:
    | "missing"
    | "invalid"
    | "not_found"
    | "out_of_stock"
    | "quantity_exceeded"
    | "region_restricted";
  message: string;
  path: string;
}

export interface CatalogContext {
  skus: SellableSku[];
  index: Map<string, SellableSku>;
  rule: ShippingRule;
}

export interface Evaluation {
  lines: { item: SessionItem; sku: SellableSku | null }[];
  quote: Quote | null;
  address: SwissAddress | null;
  email: string | null;
  issues: Issue[];
  ready: boolean;
}

export async function catalogContext(db: Db): Promise<CatalogContext> {
  const [skus, rule] = await Promise.all([
    loadSellableSkus(db),
    getShippingSettings(),
  ]);
  return { skus, index: skuIndex(skus), rule };
}

export function sessionItems(
  requests: LineRequest[],
  ctx: CatalogContext,
  existing: SessionItem[] = [],
): SessionItem[] {
  if (!requests.length)
    throw new CheckoutError(
      "missing",
      "At least one line item is required",
      "$.line_items",
    );
  return requests.map((request, index) => {
    const sku = resolveLine(
      request,
      ctx.skus,
      ctx.index,
      `$.line_items[${index}]`,
    );
    // Même identifiant de ligne d'une mise à jour à l'autre pour un même SKU.
    const lineId =
      existing.find((item) => item.sku === sku.sku)?.lineId ??
      `li_${sku.sku.replace(/[^A-Za-z0-9]/g, "_").slice(0, 40)}_${index + 1}`;
    return { lineId, sku: sku.sku, quantity: request.quantity ?? 1 };
  });
}

const issueCode = (code: CheckoutError["code"]): Issue["code"] =>
  code === "out_of_stock" ||
  code === "quantity_exceeded" ||
  code === "region_restricted" ||
  code === "missing" ||
  code === "not_found"
    ? code
    : "invalid";

// État complet de la session, recalculé à chaque appel.
export function evaluate(state: SessionState, ctx: CatalogContext): Evaluation {
  const issues: Issue[] = [];
  const lines = state.items.map((item) => ({
    item,
    sku: ctx.index.get(item.sku) ?? null,
  }));
  lines.forEach((line, index) => {
    if (!line.sku)
      issues.push({
        code: "not_found",
        message: `This product is no longer available: ${line.item.sku}`,
        path: `$.line_items[${index}]`,
      });
  });
  let quote: Quote | null = null;
  if (lines.length && lines.every((line) => line.sku)) {
    try {
      quote = buildQuote(
        lines.map((line) => ({ sku: line.sku!, quantity: line.item.quantity })),
        ctx.rule,
      );
    } catch (error) {
      if (!(error instanceof CheckoutError)) throw error;
      issues.push({
        code: issueCode(error.code),
        message: error.message,
        path: "$.line_items",
      });
    }
  }
  let email: string | null = null;
  if (!state.buyer.email)
    issues.push({
      code: "missing",
      message: "Buyer email is required",
      path: "$.buyer.email",
    });
  else
    try {
      email = normalizeEmail(state.buyer.email);
    } catch {
      issues.push({
        code: "invalid",
        message: "Invalid buyer email",
        path: "$.buyer.email",
      });
    }
  let address: SwissAddress | null = null;
  if (!state.address)
    issues.push({
      code: "missing",
      message: "A shipping address in Switzerland is required",
      path: "$.fulfillment",
    });
  else
    try {
      address = swissAddress(state.address, "$.fulfillment.address");
    } catch (error) {
      if (!(error instanceof CheckoutError)) throw error;
      issues.push({
        code: issueCode(error.code),
        message: error.message,
        path: error.param ?? "$.fulfillment",
      });
    }
  return {
    lines,
    quote,
    address,
    email,
    issues,
    ready: !issues.length && !!quote && !!address && !!email,
  };
}

// Nom du destinataire : celui de l'adresse, sinon celui de l'acheteur.
export function withRecipient(
  address: AddressInput | null,
  buyer: SessionBuyer,
): AddressInput | null {
  if (!address) return null;
  const buyerName =
    buyer.fullName ||
    [buyer.firstName, buyer.lastName].filter(Boolean).join(" ") ||
    undefined;
  return { ...address, name: address.name || buyerName };
}

export function newSessionId(protocol: Protocol): string {
  const random = crypto.randomUUID().replace(/-/g, "");
  return protocol === "acp" ? `cs_${random}` : `chk_${random}`;
}

export async function insertSession(
  db: Db,
  protocol: Protocol,
  state: SessionState,
  agent: string | null,
  customerId: string | null = null,
): Promise<SessionRow> {
  const [row] = await db
    .insert(agentCheckoutSessions)
    .values({
      id: newSessionId(protocol),
      protocol,
      state,
      agent,
      customerId,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    })
    .returning();
  return row;
}

export async function loadSession(
  db: Db,
  protocol: Protocol,
  id: string,
): Promise<SessionRow | null> {
  const [row] = await db
    .select()
    .from(agentCheckoutSessions)
    .where(
      and(
        eq(agentCheckoutSessions.id, id),
        eq(agentCheckoutSessions.protocol, protocol),
        uncached,
      ),
    );
  return row ?? null;
}

export const isExpired = (session: SessionRow) =>
  session.status === "open" && session.expiresAt.getTime() < Date.now();

export async function saveState(db: Db, id: string, state: SessionState) {
  const [row] = await db
    .update(agentCheckoutSessions)
    .set({ state })
    .where(
      and(
        eq(agentCheckoutSessions.id, id),
        eq(agentCheckoutSessions.status, "open"),
      ),
    )
    .returning();
  return row ?? null;
}

export async function cancelSession(db: Db, id: string) {
  const [row] = await db
    .update(agentCheckoutSessions)
    .set({ status: "canceled" })
    .where(
      and(
        eq(agentCheckoutSessions.id, id),
        eq(agentCheckoutSessions.status, "open"),
      ),
    )
    .returning();
  return row ?? null;
}

export async function linkedOrder(
  db: Db,
  session: SessionRow,
): Promise<Order | null> {
  if (!session.orderId) return null;
  const [row] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, session.orderId), uncached));
  return row ?? null;
}

export type CompletionResult =
  | { status: "completed" | "processing"; order: Order }
  | {
      status: "failed";
      code: "payment_declined" | "requires_action";
      message: string;
    };

// Paiement de la session : commande en attente (stock réservé) puis débit du
// jeton. Une tentative par jeton, idempotente (même jeton rejoué → même
// commande, même PaymentIntent).
export async function completeSession(
  db: Db,
  stripe: Stripe,
  session: SessionRow,
  evaluation: Evaluation,
  spt: string,
): Promise<CompletionResult> {
  if (
    !evaluation.ready ||
    !evaluation.quote ||
    !evaluation.address ||
    !evaluation.email
  )
    throw new CheckoutError("invalid", "The checkout is not ready for payment");
  const state = session.state as SessionState;
  const attemptKey = `${session.protocol}:${session.id}:${(await sha256Hex(spt)).slice(0, 16)}`;
  const order = await createPendingAgentOrder(db, {
    quote: evaluation.quote,
    address: evaluation.address,
    email: evaluation.email,
    locale: state.locale,
    channel: session.protocol,
    agentName: session.agent,
    attemptKey,
    customerId: session.customerId,
  });
  const finish = async (paid: Order) => {
    await db
      .update(agentCheckoutSessions)
      .set({ status: "completed", orderId: paid.id })
      .where(eq(agentCheckoutSessions.id, session.id));
  };
  if (order.status === "paid") {
    await finish(order);
    return { status: "completed", order };
  }
  if (order.status !== "pending")
    return {
      status: "failed",
      code: "payment_declined",
      message: "This payment token already failed; issue a new one",
    };
  const payment = await payOrderWithSpt(db, stripe, order, spt, attemptKey);
  if (payment.status === "failed")
    return { status: "failed", code: payment.code, message: payment.message };
  const [fresh] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, order.id), uncached));
  await finish(fresh ?? order);
  await pushCatalogChange(db, "stock");
  return {
    status: payment.status === "paid" ? "completed" : "processing",
    order: fresh ?? order,
  };
}

// Maintenance : sessions closes ou expirées depuis plus de 7 jours.
export async function purgeAgentSessions(db: Db): Promise<number> {
  const cutoff = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const rows = await db
    .delete(agentCheckoutSessions)
    .where(
      or(
        lt(agentCheckoutSessions.expiresAt, cutoff),
        and(
          lt(agentCheckoutSessions.updatedAt, cutoff),
          eq(agentCheckoutSessions.status, "canceled"),
        ),
      ),
    )
    .returning({ id: agentCheckoutSessions.id });
  return rows.length;
}
