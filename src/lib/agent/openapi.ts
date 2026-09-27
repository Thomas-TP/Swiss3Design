import { AGENT_SURFACE_VERSION, PATHS, STORE, abs } from "./config";
import { toolInputSchema, type ToolName } from "./tools";

// Description OpenAPI 3.1 de l'API publique /api/v1 : paramètres générés
// depuis les schémas zod des outils (toolInputSchema), donc toujours alignés
// sur la validation réelle. Servie à /openapi.json (relation service-desc).

const price = {
  type: "object",
  required: ["amount", "currency", "cents"],
  properties: {
    amount: { type: "string", examples: ["34.90"] },
    currency: { type: "string", const: "CHF" },
    cents: { type: "integer", examples: [3490] },
  },
};

const productSummary = {
  type: "object",
  properties: {
    slug: { type: "string" },
    name: { type: "string" },
    description: { type: "string" },
    url: { type: "string", format: "uri" },
    imageUrl: { type: ["string", "null"], format: "uri" },
    price: { $ref: "#/components/schemas/Price" },
    availability: {
      type: "string",
      enum: ["in_stock", "made_to_order", "out_of_stock"],
    },
    productionDays: { type: ["integer", "null"] },
    material: { type: "string" },
    multicolor: { type: "boolean" },
    colors: { type: "array", items: { type: "string" } },
  },
};

const error = {
  type: "object",
  properties: {
    error: {
      type: "object",
      properties: {
        code: { type: "string" },
        message: { type: "string" },
      },
    },
  },
};

function queryParameters(name: ToolName) {
  const schema = toolInputSchema(name) as {
    properties?: Record<string, Record<string, unknown>>;
    required?: string[];
  };
  return Object.entries(schema.properties ?? {}).map(([key, value]) => ({
    name: key,
    in: "query",
    required: schema.required?.includes(key) ?? false,
    description: value.description,
    schema: value,
  }));
}

const json = (schema: unknown) => ({
  "application/json": { schema },
});

const errors = {
  "400": {
    description: "Invalid arguments",
    content: json({ $ref: "#/components/schemas/Error" }),
  },
  "404": {
    description: "Not found",
    content: json({ $ref: "#/components/schemas/Error" }),
  },
  "429": {
    description: "Rate limited",
    content: json({ $ref: "#/components/schemas/Error" }),
  },
};

// Achat direct par un agent (MPP) : corps de la commande, identique entre le
// premier appel (devis + défi 402) et l'appel payé.
const purchaseBody = {
  type: "object",
  required: ["items", "email", "shipping_address"],
  properties: {
    items: {
      type: "array",
      minItems: 1,
      maxItems: 20,
      items: {
        type: "object",
        properties: {
          sku: {
            type: "string",
            description:
              "SKU from the Stripe catalogue feed, e.g. vase-spirale--noir (alternative to slug/variant/color)",
          },
          slug: { type: "string", description: "Product slug" },
          variant: {
            type: "string",
            description: "Variant name, required when the product has variants",
          },
          color: {
            type: "string",
            description:
              "Colour name, required when the product offers colours",
          },
          quantity: { type: "integer", minimum: 1, maximum: 99, default: 1 },
        },
      },
    },
    email: {
      type: "string",
      format: "email",
      description: "Buyer email: order confirmation and tracking",
    },
    shipping_address: {
      type: "object",
      required: ["name", "line1", "postal_code", "city"],
      properties: {
        name: { type: "string" },
        line1: { type: "string" },
        line2: { type: "string" },
        postal_code: { type: "string", pattern: "^\\d{4}$" },
        city: { type: "string" },
        canton: { type: "string", examples: ["VD"] },
        country: { type: "string", const: "CH" },
      },
    },
    language: { type: "string", enum: ["fr", "de", "it", "en"] },
  },
};

export function openApiDocument() {
  return {
    openapi: "3.1.0",
    info: {
      title: "Swiss3Design Store API",
      version: AGENT_SURFACE_VERSION,
      summary: "Public API of the Swiss3Design online store.",
      description:
        "Catalogue, store policies, order tracking, cart links and direct purchases (Machine Payments Protocol, card via a Stripe Shared Payment Token) of Swiss3Design, a Swiss store of multicolour 3D-printed design objects (prices in CHF, shipping within Switzerland only). No API key needed. The same tools are available over MCP (https://swiss3design.ch/mcp) and A2A (https://swiss3design.ch/a2a); checkout is also available over ACP (/.well-known/acp.json) and UCP (/.well-known/ucp).",
      contact: { name: STORE.name, email: STORE.email, url: STORE.url },
      termsOfService: `${STORE.url}/en/legal/terms`,
    },
    // Découverte des paiements machine (draft-payment-discovery, mpp.dev).
    "x-service-info": {
      categories: ["shopping", "ecommerce", "physical-goods"],
      docs: {
        homepage: STORE.url,
        apiReference: abs(PATHS.openapi),
        llms: abs(PATHS.llms),
      },
    },
    externalDocs: {
      description: "Guide for AI agents and developers",
      url: abs(PATHS.agentsDoc),
    },
    servers: [{ url: abs(PATHS.api), description: "Production" }],
    tags: [
      { name: "catalogue" },
      { name: "store" },
      { name: "orders" },
      { name: "cart" },
      { name: "purchases" },
    ],
    paths: {
      "/products": {
        get: {
          operationId: "searchProducts",
          tags: ["catalogue"],
          summary: "Search products",
          parameters: queryParameters("search_products"),
          responses: {
            "200": {
              description: "Matching products",
              content: json({
                type: "object",
                properties: {
                  count: { type: "integer" },
                  products: {
                    type: "array",
                    items: { $ref: "#/components/schemas/ProductSummary" },
                  },
                },
              }),
            },
            "400": errors["400"],
          },
        },
      },
      "/products/{slug}": {
        get: {
          operationId: "getProduct",
          tags: ["catalogue"],
          summary: "Get product details",
          parameters: [
            {
              name: "slug",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
            ...queryParameters("get_product").filter((p) => p.name !== "slug"),
          ],
          responses: {
            "200": {
              description: "Product details",
              content: json({ $ref: "#/components/schemas/Product" }),
            },
            "404": errors["404"],
          },
        },
      },
      "/categories": {
        get: {
          operationId: "listCategories",
          tags: ["catalogue"],
          summary: "List categories",
          parameters: queryParameters("list_categories"),
          responses: {
            "200": {
              description: "Categories",
              content: json({
                type: "object",
                properties: {
                  categories: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        slug: { type: "string" },
                        name: { type: "string" },
                        url: { type: "string", format: "uri" },
                      },
                    },
                  },
                },
              }),
            },
          },
        },
      },
      "/store": {
        get: {
          operationId: "getStoreInfo",
          tags: ["store"],
          summary: "Shipping, returns, payment, contact and custom printing",
          parameters: queryParameters("get_store_info"),
          responses: {
            "200": {
              description: "Store information",
              content: json({ type: "object" }),
            },
          },
        },
      },
      "/orders/track": {
        post: {
          operationId: "trackOrder",
          tags: ["orders"],
          summary: "Track an order with its number and email",
          requestBody: {
            required: true,
            content: json(toolInputSchema("track_order")),
          },
          responses: {
            "200": {
              description: "Order status",
              content: json({ type: "object" }),
            },
            "404": errors["404"],
            "429": errors["429"],
          },
        },
      },
      "/cart-links": {
        post: {
          operationId: "buildCartLink",
          tags: ["cart"],
          summary:
            "Build a link that fills the customer's cart on swiss3design.ch",
          requestBody: {
            required: true,
            content: json(toolInputSchema("build_cart_link")),
          },
          responses: {
            "200": {
              description: "Cart link with prices and shipping estimate",
              content: json({
                type: "object",
                properties: {
                  cartUrl: { type: "string", format: "uri" },
                  subtotal: { $ref: "#/components/schemas/Price" },
                  estimatedShipping: { $ref: "#/components/schemas/Price" },
                  estimatedTotal: { $ref: "#/components/schemas/Price" },
                },
              }),
            },
            "400": errors["400"],
            "404": errors["404"],
          },
        },
      },
      "/purchases": {
        post: {
          operationId: "createPurchase",
          tags: ["purchases"],
          summary:
            "Buy products and pay by machine payment (MPP, card via Stripe Shared Payment Token)",
          description:
            "Send the order without payment: the answer is 402 with the quote and a WWW-Authenticate: Payment challenge (method=stripe, intent=charge, amount in centimes CHF). Obtain a Shared Payment Token for the challenge's networkId (e.g. `link-cli mpp pay`) and retry the same request with the Authorization: Payment credential. On success: 201, the order and a Payment-Receipt header. Shipping within Switzerland only.",
          requestBody: { required: true, content: json(purchaseBody) },
          // Montant variable (panier) : null, le défi 402 fait foi.
          "x-payment-info": {
            intent: "charge",
            method: "stripe",
            amount: null,
            currency: "chf",
            description:
              "Order total in CHF centimes (items + Swiss Post shipping), stated in the 402 challenge",
          },
          responses: {
            "201": {
              description: "Order paid and created (Payment-Receipt header)",
              content: json({ type: "object" }),
            },
            "202": {
              description:
                "Payment processing; the order is confirmed by email",
              content: json({ type: "object" }),
            },
            "402": {
              description:
                "Payment required: quote and WWW-Authenticate: Payment challenge",
              content: {
                "application/problem+json": { schema: { type: "object" } },
              },
            },
            "400": errors["400"],
            "404": errors["404"],
            "409": {
              description: "Out of stock or conflicting retry",
              content: json({ $ref: "#/components/schemas/Error" }),
            },
            "422": {
              description: "Shipping outside Switzerland",
              content: json({ $ref: "#/components/schemas/Error" }),
            },
            "429": errors["429"],
          },
        },
      },
      "/health": {
        get: {
          operationId: "health",
          summary: "Service status",
          responses: {
            "200": {
              description: "Service is up",
              content: json({
                type: "object",
                properties: { status: { type: "string", const: "ok" } },
              }),
            },
          },
        },
      },
    },
    components: {
      schemas: {
        Price: price,
        ProductSummary: productSummary,
        Product: {
          allOf: [
            { $ref: "#/components/schemas/ProductSummary" },
            {
              type: "object",
              properties: {
                id: { type: "string" },
                dimensionsMm: { type: ["string", "null"] },
                weightGrams: { type: ["integer", "null"] },
                colorOptions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      hex: { type: "string" },
                    },
                  },
                },
                variants: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      name: { type: "string" },
                      price: { $ref: "#/components/schemas/Price" },
                    },
                  },
                },
              },
            },
          ],
        },
        Error: error,
      },
    },
  };
}
