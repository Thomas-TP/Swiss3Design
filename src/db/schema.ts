import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  index,
} from "drizzle-orm/sqlite-core";

const uuid = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const createdAt = () =>
  integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date());

export const LOCALES = ["fr", "de", "it", "en"] as const;

// ── Catalogue ────────────────────────────────────────────────────────────────

export const products = sqliteTable("products", {
  id: uuid(),
  slug: text("slug").notNull().unique(),
  priceCents: integer("price_cents").notNull(),
  saleType: text("sale_type", { enum: ["stock", "on_demand"] })
    .notNull()
    .default("stock"),
  productionDays: integer("production_days"),
  material: text("material").notNull().default("PLA"),
  dimensionsMm: text("dimensions_mm"),
  weightGrams: integer("weight_grams"),
  multicolor: integer("multicolor", { mode: "boolean" }).notNull().default(false),
  featured: integer("featured", { mode: "boolean" }).notNull().default(false),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  // null = pas de suivi de stock (ex. à la demande) ; 0 = rupture
  stock: integer("stock"),
  createdAt: createdAt(),
});

export const productTranslations = sqliteTable(
  "product_translations",
  {
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    locale: text("locale", { enum: LOCALES }).notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
  },
  (t) => [primaryKey({ columns: [t.productId, t.locale] })],
);

export const productImages = sqliteTable(
  "product_images",
  {
    id: uuid(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    alt: text("alt"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("product_images_product_idx").on(t.productId)],
);

export const productVariants = sqliteTable(
  "product_variants",
  {
    id: uuid(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    sku: text("sku").notNull().unique(),
    name: text("name").notNull(),
    priceCents: integer("price_cents"), // null → hérite du prix produit
    stock: integer("stock"), // null → impression à la demande
  },
  (t) => [index("product_variants_product_idx").on(t.productId)],
);

export const categories = sqliteTable("categories", {
  id: uuid(),
  slug: text("slug").notNull().unique(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const categoryTranslations = sqliteTable(
  "category_translations",
  {
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    locale: text("locale", { enum: LOCALES }).notNull(),
    name: text("name").notNull(),
  },
  (t) => [primaryKey({ columns: [t.categoryId, t.locale] })],
);

export const productCategories = sqliteTable(
  "product_categories",
  {
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.productId, t.categoryId] })],
);

// ── Commandes ────────────────────────────────────────────────────────────────

export const orders = sqliteTable(
  "orders",
  {
    id: uuid(),
    orderNumber: text("order_number").notNull().unique(),
    customerId: text("customer_id"), // lié à Better Auth (phase auth)
    email: text("email").notNull(),
    status: text("status", {
      enum: ["pending", "paid", "in_production", "shipped", "delivered", "cancelled"],
    })
      .notNull()
      .default("pending"),
    subtotalCents: integer("subtotal_cents").notNull(),
    shippingCents: integer("shipping_cents").notNull(),
    totalCents: integer("total_cents").notNull(),
    // Snapshot JSON de l'adresse (Suisse uniquement, validé côté serveur)
    shippingAddress: text("shipping_address").notNull(),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    locale: text("locale", { enum: LOCALES }).notNull().default("fr"),
    createdAt: createdAt(),
  },
  (t) => [index("orders_customer_idx").on(t.customerId)],
);

export const orderItems = sqliteTable(
  "order_items",
  {
    id: uuid(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: text("product_id"),
    variantId: text("variant_id"),
    // Snapshots : le produit peut changer, pas l'historique de commande
    nameSnapshot: text("name_snapshot").notNull(),
    priceCentsSnapshot: integer("price_cents_snapshot").notNull(),
    quantity: integer("quantity").notNull(),
  },
  (t) => [index("order_items_order_idx").on(t.orderId)],
);

// ── Devis sur mesure ─────────────────────────────────────────────────────────

export const quoteRequests = sqliteTable("quote_requests", {
  id: uuid(),
  customerId: text("customer_id"),
  email: text("email").notNull(),
  description: text("description").notNull(),
  material: text("material"),
  colors: text("colors"),
  dimensions: text("dimensions"),
  fileUrl: text("file_url"), // clé R2 du STL/3MF (phase upload)
  fileName: text("file_name"),
  status: text("status", {
    enum: ["received", "quoted", "accepted", "paid", "in_production", "done", "rejected"],
  })
    .notNull()
    .default("received"),
  quotedPriceCents: integer("quoted_price_cents"),
  adminMessage: text("admin_message"),
  locale: text("locale", { enum: LOCALES }).notNull().default("fr"),
  createdAt: createdAt(),
});

// ── Stock & réglages ─────────────────────────────────────────────────────────

export const inventoryLog = sqliteTable("inventory_log", {
  id: uuid(),
  variantId: text("variant_id").notNull(),
  delta: integer("delta").notNull(),
  reason: text("reason").notNull(), // "order" | "restock" | "adjustment"
  createdAt: createdAt(),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

// ── Auth (Better Auth) ───────────────────────────────────────────────────────

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .notNull()
    .default(false),
  image: text("image"),
  role: text("role").notNull().default("customer"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", {
      mode: "timestamp",
    }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", {
      mode: "timestamp",
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
});
