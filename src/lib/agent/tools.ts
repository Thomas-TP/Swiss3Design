import { z } from "zod";
import { SITE_URL } from "@/lib/seo";
import { rateLimit } from "@/lib/rate-limit";
import { getShippingSettings } from "@/lib/shipping-settings";
import { FREE_SHIPPING_OVER_CENTS, SHIPPING_CENTS } from "@/lib/shipping";
import {
  getAgentProduct,
  listCategories,
  price,
  searchProducts,
  toLocale,
} from "./catalog";
import { trackOrderForAgent } from "./orders";
import { getStoreInfo } from "./store-info";

// Outils exposés aux agents — une seule définition pour le serveur MCP,
// l'agent A2A (skills), l'API /api/v1 et la documentation. Schémas zod →
// JSON Schema (z.toJSONSchema) : validation et description ne divergent
// jamais. Tous en lecture seule : aucun ne modifie l'état du serveur
// (build_cart_link produit un lien, le panier vit chez le client).

const language = z
  .enum(["fr", "de", "it", "en"])
  .optional()
  .describe(
    "Language of names, descriptions and URLs (default: en). The store's main language is French.",
  );

const schemas = {
  search_products: z.object({
    query: z
      .string()
      .max(100)
      .optional()
      .describe("Free-text search in product names and descriptions"),
    category: z
      .string()
      .max(60)
      .optional()
      .describe("Category slug, as returned by list_categories"),
    material: z.string().max(40).optional().describe("Material, e.g. PLA"),
    multicolor: z
      .boolean()
      .optional()
      .describe("Only multicolour prints (several filaments in one piece)"),
    max_price_chf: z
      .number()
      .positive()
      .max(100000)
      .optional()
      .describe("Maximum unit price in CHF"),
    sort: z
      .enum(["new", "price_asc", "price_desc"])
      .optional()
      .describe("Sort order (default: newest first)"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .describe("Maximum number of results (default 20)"),
    language,
  }),
  get_product: z.object({
    slug: z
      .string()
      .min(1)
      .max(120)
      .describe("Product slug, as returned by search_products"),
    language,
  }),
  list_categories: z.object({ language }),
  get_store_info: z.object({ language }),
  track_order: z.object({
    order_number: z
      .string()
      .min(3)
      .max(40)
      .describe("Order number from the confirmation email, e.g. S3D-1042"),
    email: z.email().describe("Email address used for the order"),
  }),
  build_cart_link: z.object({
    items: z
      .array(
        z.object({
          slug: z.string().min(1).max(120).describe("Product slug"),
          quantity: z.number().int().min(1).max(99).optional(),
          variant: z
            .string()
            .max(120)
            .optional()
            .describe(
              "Variant id or name, required when the product has variants",
            ),
          color: z
            .string()
            .max(60)
            .optional()
            .describe(
              "Colour name from the product's colorOptions, required when the product offers colours",
            ),
        }),
      )
      .min(1)
      .max(20),
    language,
  }),
} as const;

export type ToolName = keyof typeof schemas;

export interface ToolContext {
  request?: Request;
}

export class ToolError extends Error {
  constructor(
    readonly code: "invalid_arguments" | "not_found" | "rate_limited",
    message: string,
  ) {
    super(message);
  }
}

type Handler<N extends ToolName> = (
  args: z.infer<(typeof schemas)[N]>,
  ctx: ToolContext,
) => Promise<unknown>;

const handlers: { [N in ToolName]: Handler<N> } = {
  async search_products(args) {
    const products = await searchProducts({
      query: args.query,
      category: args.category,
      material: args.material,
      multicolor: args.multicolor,
      maxPriceChf: args.max_price_chf,
      sort: args.sort,
      limit: args.limit,
      locale: toLocale(args.language),
    });
    return { count: products.length, products };
  },

  async get_product(args) {
    const product = await getAgentProduct(args.slug, toLocale(args.language));
    if (!product)
      throw new ToolError("not_found", "No active product with this slug.");
    return product;
  },

  async list_categories(args) {
    return { categories: await listCategories(toLocale(args.language)) };
  },

  async get_store_info(args) {
    return getStoreInfo(toLocale(args.language));
  },

  async track_order(args, ctx) {
    if (
      ctx.request &&
      !(await rateLimit(ctx.request, "track-order", {
        limit: 30,
        windowS: 600,
      }))
    )
      throw new ToolError("rate_limited", "Too many lookups, try again later.");
    const order = await trackOrderForAgent(args.order_number, args.email);
    if (!order)
      throw new ToolError(
        "not_found",
        "No order matches this order number and email address.",
      );
    return order;
  },

  async build_cart_link(args) {
    const locale = toLocale(args.language);
    const lines = [];
    const params = new URLSearchParams();
    for (const item of args.items) {
      const product = await getAgentProduct(item.slug, locale);
      if (!product)
        throw new ToolError("not_found", `Unknown product: ${item.slug}`);
      if (product.availability === "out_of_stock")
        throw new ToolError(
          "invalid_arguments",
          `${product.name} is out of stock.`,
        );
      const variant = item.variant
        ? product.variants.find(
            (v) =>
              v.id === item.variant ||
              v.name.toLowerCase() === item.variant!.toLowerCase(),
          )
        : undefined;
      if (product.variants.length > 0 && !variant)
        throw new ToolError(
          "invalid_arguments",
          `${product.name} requires a variant: ${product.variants.map((v) => v.name).join(", ")}`,
        );
      const color = item.color
        ? product.colorOptions.find(
            (c) => c.name.toLowerCase() === item.color!.toLowerCase(),
          )
        : undefined;
      if (product.colorOptions.length > 0 && !color)
        throw new ToolError(
          "invalid_arguments",
          `${product.name} requires a colour: ${product.colorOptions.map((c) => c.name).join(", ")}`,
        );
      const quantity = item.quantity ?? 1;
      const unit = variant?.price ?? product.price;
      params.append(
        "item",
        [product.slug, quantity, variant?.id ?? "", color?.name ?? ""].join(
          "|",
        ),
      );
      lines.push({
        slug: product.slug,
        name: product.name,
        variant: variant?.name ?? null,
        color: color?.name ?? null,
        quantity,
        unitPrice: unit,
        lineTotal: price(unit.cents * quantity),
      });
    }
    const shipping = await getShippingSettings().catch(() => ({
      shippingCents: SHIPPING_CENTS,
      freeOverCents: FREE_SHIPPING_OVER_CENTS,
    }));
    const subtotal = lines.reduce((sum, l) => sum + l.lineTotal.cents, 0);
    const shippingCents =
      subtotal >= shipping.freeOverCents ? 0 : shipping.shippingCents;
    return {
      cartUrl: `${SITE_URL}/${locale}/cart?${params.toString()}`,
      lines,
      subtotal: price(subtotal),
      estimatedShipping: price(shippingCents),
      estimatedTotal: price(subtotal + shippingCents),
      note: "Open cartUrl in a browser: the items are added to the cart, then the customer pays on swiss3design.ch (TWINT, cards, Google Pay). Prices are re-checked at checkout.",
    };
  },
};

interface ToolMeta {
  title: string;
  description: string;
}

const meta: Record<ToolName, ToolMeta> = {
  search_products: {
    title: "Search products",
    description:
      "Search the Swiss3Design catalogue of 3D-printed design objects (vases, lamps, desk items…). Returns names, CHF prices, availability, colours and product URLs.",
  },
  get_product: {
    title: "Get product details",
    description:
      "Full details of one product: description, price, availability, production time, material, dimensions, weight, colour options, variants and images.",
  },
  list_categories: {
    title: "List categories",
    description: "Catalogue categories with their slugs and URLs.",
  },
  get_store_info: {
    title: "Store information",
    description:
      "Shipping (Switzerland only, Swiss Post, flat rate and free-shipping threshold), returns, payment methods, contact and custom 3D printing service.",
  },
  track_order: {
    title: "Track an order",
    description:
      "Status, items, totals and Swiss Post tracking link of an order, from its order number and the email address used to place it.",
  },
  build_cart_link: {
    title: "Build a cart link",
    description:
      "Validate items and return a swiss3design.ch link that fills the shopping cart, with prices and a shipping estimate. The customer completes payment on the website.",
  },
};

export const TOOL_NAMES = Object.keys(schemas) as ToolName[];

export function toolInputSchema(name: ToolName): Record<string, unknown> {
  const { $schema: _ignored, ...schema } = z.toJSONSchema(schemas[name], {
    io: "input",
  }) as Record<string, unknown>;
  return schema;
}

export function toolDefinitions() {
  return TOOL_NAMES.map((name) => ({
    name,
    title: meta[name].title,
    description: meta[name].description,
    inputSchema: toolInputSchema(name),
    annotations: {
      title: meta[name].title,
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  }));
}

export const isToolName = (name: unknown): name is ToolName =>
  typeof name === "string" && name in schemas;

export async function runTool(
  name: ToolName,
  rawArgs: unknown,
  ctx: ToolContext = {},
): Promise<unknown> {
  const parsed = schemas[name].safeParse(rawArgs ?? {});
  if (!parsed.success)
    throw new ToolError(
      "invalid_arguments",
      parsed.error.issues
        .map((i) => `${i.path.join(".") || "arguments"}: ${i.message}`)
        .join("; "),
    );
  // Le type d'union des handlers se perd à l'indexation dynamique : chaque
  // entrée est typée par son propre schéma ci-dessus.
  const handler = handlers[name] as Handler<ToolName>;
  return handler(parsed.data as never, ctx);
}
