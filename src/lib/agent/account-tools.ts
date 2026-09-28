import { and, asc, desc, eq, or } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { orderItems, orders, quoteRequests, user } from "@/db/schema";
import { price } from "./catalog";
import { ToolError } from "./tools";

// Outils du serveur MCP « compte client » (/mcp/account) : lecture seule, au
// nom du client qui a autorisé l'agent (jeton OAuth, portées vérifiées par
// l'appelant). Même périmètre que l'espace compte du site — commandes et
// devis rattachés au compte OU passés en invité avec la même adresse — mais
// jamais d'adresse postale ni de moyen de paiement : l'agent n'en a pas
// besoin pour répondre « où en est ma commande ? ».

export interface AccountToolContext {
  userId: string;
  scopes: ReadonlySet<string>;
  origin: string;
}

const ORDER_STATUSES = [
  "pending",
  "paid",
  "in_production",
  "shipped",
  "delivered",
  "cancelled",
] as const;

const schemas = {
  get_my_profile: z.object({}),
  list_my_orders: z.object({
    status: z
      .enum(ORDER_STATUSES)
      .optional()
      .describe("Only orders with this status"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .describe("Maximum number of orders, newest first (default 20)"),
  }),
  get_my_order: z.object({
    order_number: z
      .string()
      .min(3)
      .max(40)
      .describe(
        "Order number as returned by list_my_orders or shown in the confirmation email: S3D- followed by letters and digits, e.g. S3D-MFZ3K2Q1A7BX (case-insensitive)",
      ),
  }),
  list_my_quotes: z.object({
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .describe("Maximum number of quote requests, newest first (default 20)"),
  }),
} as const;

export type AccountToolName = keyof typeof schemas;

const meta: Record<
  AccountToolName,
  { title: string; description: string; scope: string }
> = {
  get_my_profile: {
    title: "My profile",
    description:
      "Profile of the signed-in Swiss3Design customer: name, account creation date (memberSince) and a link to their account page. With the email scope, also their email address and whether it is verified. Takes no arguments; postal addresses and payment details are never returned.",
    scope: "profile",
  },
  list_my_orders: {
    title: "My orders",
    description:
      "The customer's orders, newest first: those linked to the account and those placed as a guest with the account's email address. Each order has its number, status (pending = not paid yet), creation date, total in CHF, Swiss Post tracking number and link (null until there is one) and a link to the order page on swiss3design.ch. Items are not included: call get_my_order with the order number for items, colours and the price breakdown.",
    scope: "orders.read",
  },
  get_my_order: {
    title: "Order details",
    description:
      "Full details of one of the customer's orders, by order number (case-insensitive): status, creation and payment dates, items (name, colour, quantity, unit price), subtotal, shipping, discount, total and refunded amount in CHF, Swiss Post tracking number and link, and a link to the order page on swiss3design.ch. Only orders linked to the account or placed with the account's email address are found; any other number returns not_found. For an order placed with a different email address, use track_order with that address. Postal addresses and payment details are never returned.",
    scope: "orders.read",
  },
  list_my_quotes: {
    title: "My custom print quotes",
    description:
      "The customer's custom 3D printing quote requests, newest first: those linked to the account and those sent with the account's email address. Each quote has its id, status (received, quoted, revision_requested, accepted, declined, paid, in_production, done or rejected), request date, the customer's description (cut at 300 characters), material, quoted price in CHF (null until the store has quoted), offer expiry (validUntil), whether it was paid and the amount paid, and a link to the quote page on swiss3design.ch.",
    scope: "quotes.read",
  },
};

export const ACCOUNT_TOOL_NAMES = Object.keys(schemas) as AccountToolName[];

export const isAccountToolName = (name: unknown): name is AccountToolName =>
  typeof name === "string" && name in schemas;

export const accountToolScope = (name: AccountToolName) => meta[name].scope;

export function accountToolDefinitions(scopes: ReadonlySet<string>) {
  return ACCOUNT_TOOL_NAMES.filter((name) => scopes.has(meta[name].scope)).map(
    (name) => {
      const { $schema: _ignored, ...inputSchema } = z.toJSONSchema(
        schemas[name],
        { io: "input" },
      ) as Record<string, unknown>;
      return {
        name,
        title: meta[name].title,
        description: meta[name].description,
        inputSchema,
        annotations: {
          title: meta[name].title,
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      };
    },
  );
}

const postTrackingUrl = (trackingNumber: string) =>
  `https://service.post.ch/ekp-web/ui/entry/search/${encodeURIComponent(trackingNumber)}`;

async function loadUser(userId: string) {
  const db = await getDb();
  const [row] = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  if (!row) throw new ToolError("not_found", "This account no longer exists.");
  return row;
}

const ownedOrders = (u: { id: string; email: string }) =>
  or(eq(orders.customerId, u.id), eq(orders.email, u.email));

type Handler<N extends AccountToolName> = (
  args: z.infer<(typeof schemas)[N]>,
  ctx: AccountToolContext,
) => Promise<unknown>;

const handlers: { [N in AccountToolName]: Handler<N> } = {
  async get_my_profile(_args, ctx) {
    const u = await loadUser(ctx.userId);
    return {
      name: u.name,
      ...(ctx.scopes.has("email") && {
        email: u.email,
        emailVerified: u.emailVerified,
      }),
      memberSince: u.createdAt.toISOString(),
      accountUrl: `${ctx.origin}/fr/account`,
    };
  },

  async list_my_orders(args, ctx) {
    const u = await loadUser(ctx.userId);
    const db = await getDb();
    const rows = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        status: orders.status,
        totalCents: orders.totalCents,
        trackingNumber: orders.trackingNumber,
        createdAt: orders.createdAt,
        locale: orders.locale,
      })
      .from(orders)
      .where(
        args.status
          ? and(ownedOrders(u), eq(orders.status, args.status))
          : ownedOrders(u),
      )
      .orderBy(desc(orders.createdAt))
      .limit(args.limit ?? 20);
    return {
      count: rows.length,
      orders: rows.map((o) => ({
        orderNumber: o.orderNumber,
        status: o.status,
        createdAt: o.createdAt.toISOString(),
        total: price(o.totalCents),
        trackingNumber: o.trackingNumber,
        trackingUrl: o.trackingNumber
          ? postTrackingUrl(o.trackingNumber)
          : null,
        accountUrl: `${ctx.origin}/${o.locale}/account/orders/${o.id}`,
      })),
    };
  },

  async get_my_order(args, ctx) {
    const u = await loadUser(ctx.userId);
    const db = await getDb();
    const [order] = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.orderNumber, args.order_number.trim().toUpperCase()),
          ownedOrders(u),
        ),
      )
      .limit(1);
    // Même réponse qu'une commande inexistante : pas d'oracle sur celles des
    // autres clients.
    if (!order)
      throw new ToolError(
        "not_found",
        "No order with this number in this customer's account.",
      );
    const items = await db
      .select({
        nameSnapshot: orderItems.nameSnapshot,
        colorName: orderItems.colorName,
        priceCentsSnapshot: orderItems.priceCentsSnapshot,
        quantity: orderItems.quantity,
      })
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id))
      .orderBy(asc(orderItems.id));
    return {
      orderNumber: order.orderNumber,
      status: order.status,
      createdAt: order.createdAt.toISOString(),
      paidAt: order.paidAt?.toISOString() ?? null,
      items: items.map((i) => ({
        name: i.nameSnapshot,
        color: i.colorName,
        quantity: i.quantity,
        unitPrice: price(i.priceCentsSnapshot),
      })),
      subtotal: price(order.subtotalCents),
      shipping: price(order.shippingCents),
      discount: price(order.discountCents),
      total: price(order.totalCents),
      refunded: price(order.refundedCents),
      trackingNumber: order.trackingNumber,
      trackingUrl: order.trackingNumber
        ? postTrackingUrl(order.trackingNumber)
        : null,
      accountUrl: `${ctx.origin}/${order.locale}/account/orders/${order.id}`,
    };
  },

  async list_my_quotes(args, ctx) {
    const u = await loadUser(ctx.userId);
    const db = await getDb();
    const rows = await db
      .select({
        id: quoteRequests.id,
        status: quoteRequests.status,
        description: quoteRequests.description,
        material: quoteRequests.material,
        quotedPriceCents: quoteRequests.quotedPriceCents,
        paidPriceCents: quoteRequests.paidPriceCents,
        validUntil: quoteRequests.validUntil,
        paidAt: quoteRequests.paidAt,
        createdAt: quoteRequests.createdAt,
        locale: quoteRequests.locale,
      })
      .from(quoteRequests)
      .where(
        or(
          eq(quoteRequests.customerId, u.id),
          eq(quoteRequests.email, u.email),
        ),
      )
      .orderBy(desc(quoteRequests.createdAt))
      .limit(args.limit ?? 20);
    return {
      count: rows.length,
      quotes: rows.map((q) => ({
        id: q.id,
        status: q.status,
        createdAt: q.createdAt.toISOString(),
        description:
          q.description.length > 300
            ? `${q.description.slice(0, 300)}…`
            : q.description,
        material: q.material,
        quotedPrice:
          q.quotedPriceCents === null ? null : price(q.quotedPriceCents),
        validUntil: q.validUntil?.toISOString() ?? null,
        paid: q.paidAt !== null,
        paidPrice: q.paidPriceCents === null ? null : price(q.paidPriceCents),
        accountUrl: `${ctx.origin}/${q.locale}/account/quotes/${q.id}`,
      })),
    };
  },
};

export async function runAccountTool(
  name: AccountToolName,
  rawArgs: unknown,
  ctx: AccountToolContext,
): Promise<unknown> {
  const parsed = schemas[name].safeParse(rawArgs ?? {});
  if (!parsed.success)
    throw new ToolError(
      "invalid_arguments",
      parsed.error.issues
        .map((i) => `${i.path.join(".") || "arguments"}: ${i.message}`)
        .join("; "),
    );
  const handler = handlers[name] as Handler<AccountToolName>;
  return handler(parsed.data as never, ctx);
}
