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

export function openApiDocument() {
  return {
    openapi: "3.1.0",
    info: {
      title: "Swiss3Design Store API",
      version: AGENT_SURFACE_VERSION,
      summary: "Public, read-only API of the Swiss3Design online store.",
      description:
        "Catalogue, store policies, order tracking and cart links of Swiss3Design, a Swiss store of multicolour 3D-printed design objects (prices in CHF, shipping within Switzerland only). No API key needed. The same tools are available over MCP (https://swiss3design.ch/mcp) and A2A (https://swiss3design.ch/a2a).",
      contact: { name: STORE.name, email: STORE.email, url: STORE.url },
      termsOfService: `${STORE.url}/en/legal/terms`,
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
