import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  primaryKey,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// Traduction mécanique de schema.ts (D1/SQLite) vers Postgres (Hyperdrive) —
// mêmes tables/colonnes/contraintes, adaptées aux types natifs Postgres :
// timestamp with time zone natif (au lieu de integer epoch), boolean natif
// (au lieu de integer 0/1). Colonnes id/FK en TEXT (pas uuid natif Postgres)
// — correction post-Phase 2 : les données réelles de production contiennent
// des ids non-UUID (slugs manuels "c_deco", ids générés par Better Auth type
// "fN2YEje9RkL04LDLh0NyYkuHxp4qrrWy", etc.), un type uuid natif rejette ces
// valeurs à l'insertion (Phase 5, migration réelle). D1/SQLite n'a jamais
// imposé de format UUID (juste TEXT PRIMARY KEY) : text() est la traduction
// réellement fidèle, pas uuid().
// Les enums restent des colonnes text({enum:...}) — contrainte TypeScript
// uniquement, pas de contrainte SQL — pour rester fidèle au comportement de
// schema.ts (aucune contrainte CHECK n'existait côté SQLite non plus).

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const LOCALES = ["fr", "de", "it", "en"] as const;

// ── Catalogue ────────────────────────────────────────────────────────────────

export const products = pgTable("products", {
  id: id(),
  slug: text("slug").notNull().unique(),
  priceCents: integer("price_cents").notNull(),
  saleType: text("sale_type", { enum: ["stock", "on_demand"] })
    .notNull()
    .default("stock"),
  productionDays: integer("production_days"),
  material: text("material").notNull().default("PLA"),
  dimensionsMm: text("dimensions_mm"),
  weightGrams: integer("weight_grams"),
  model3dUrl: text("model_3d_url"),
  multicolor: boolean("multicolor").notNull().default(false),
  featured: boolean("featured").notNull().default(false),
  featuredOrder: integer("featured_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
  stock: integer("stock"),
  createdAt: createdAt(),
});

export const productTranslations = pgTable(
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

export const productImages = pgTable(
  "product_images",
  {
    id: id(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    alt: text("alt"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("product_images_product_idx").on(t.productId)],
);

export const productVariants = pgTable(
  "product_variants",
  {
    id: id(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    sku: text("sku").notNull().unique(),
    name: text("name").notNull(),
    priceCents: integer("price_cents"),
    stock: integer("stock"),
  },
  (t) => [index("product_variants_product_idx").on(t.productId)],
);

export const materials = pgTable("materials", {
  id: id(),
  name: text("name").notNull().unique(),
});

export const filamentColors = pgTable(
  "filament_colors",
  {
    id: id(),
    materialId: text("material_id")
      .notNull()
      .references(() => materials.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    hex: text("hex").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [
    index("filament_colors_material_idx").on(t.materialId),
    uniqueIndex("filament_colors_material_name_unique").on(
      t.materialId,
      t.name,
    ),
  ],
);

export const productColors = pgTable(
  "product_colors",
  {
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    colorId: text("color_id")
      .notNull()
      .references(() => filamentColors.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.productId, t.colorId] }),
    index("product_colors_product_idx").on(t.productId),
  ],
);

export const categories = pgTable("categories", {
  id: id(),
  slug: text("slug").notNull().unique(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const categoryTranslations = pgTable(
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

export const productCategories = pgTable(
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

export const orders = pgTable(
  "orders",
  {
    id: id(),
    orderNumber: text("order_number").notNull().unique(),
    customerId: text("customer_id"), // lié à Better Auth — pas de FK cross-table stricte
    email: text("email").notNull(),
    status: text("status", {
      enum: [
        "pending",
        "paid",
        "in_production",
        "shipped",
        "delivered",
        "cancelled",
      ],
    })
      .notNull()
      .default("pending"),
    subtotalCents: integer("subtotal_cents").notNull(),
    shippingCents: integer("shipping_cents").notNull(),
    discountCents: integer("discount_cents").notNull().default(0),
    discountCode: text("discount_code"),
    totalCents: integer("total_cents").notNull(),
    shippingAddress: text("shipping_address").notNull(),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    trackingNumber: text("tracking_number"),
    adminNote: text("admin_note"),
    locale: text("locale", { enum: LOCALES }).notNull().default("fr"),
    createdAt: createdAt(),
  },
  (t) => [index("orders_customer_idx").on(t.customerId)],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: id(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: text("product_id"),
    variantId: text("variant_id"),
    nameSnapshot: text("name_snapshot").notNull(),
    colorName: text("color_name"),
    colorHex: text("color_hex"),
    priceCentsSnapshot: integer("price_cents_snapshot").notNull(),
    quantity: integer("quantity").notNull(),
  },
  (t) => [index("order_items_order_idx").on(t.orderId)],
);

// ── Avis produits ────────────────────────────────────────────────────────────

export const reviews = pgTable(
  "reviews",
  {
    id: id(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    customerId: text("customer_id"), // utilisateur Better Auth
    authorName: text("author_name").notNull(),
    rating: integer("rating").notNull(),
    body: text("body"),
    status: text("status", { enum: ["pending", "published", "rejected"] })
      .notNull()
      .default("pending"),
    createdAt: createdAt(),
  },
  (t) => [
    index("reviews_product_idx").on(t.productId),
    uniqueIndex("reviews_order_product_unique").on(t.orderId, t.productId),
  ],
);

// ── Devis sur mesure ─────────────────────────────────────────────────────────

export const quoteRequests = pgTable("quote_requests", {
  id: id(),
  customerId: text("customer_id"),
  email: text("email").notNull(),
  description: text("description").notNull(),
  material: text("material"),
  colors: text("colors"),
  dimensions: text("dimensions"),
  fileUrl: text("file_url"),
  fileName: text("file_name"),
  status: text("status", {
    enum: [
      "received",
      "quoted",
      "revision_requested",
      "accepted",
      "declined",
      "paid",
      "in_production",
      "done",
      "rejected",
    ],
  })
    .notNull()
    .default("received"),
  quotedPriceCents: integer("quoted_price_cents"),
  adminMessage: text("admin_message"),
  validUntil: timestamp("valid_until", { withTimezone: true }),
  adminNote: text("admin_note"),
  locale: text("locale", { enum: LOCALES }).notNull().default("fr"),
  createdAt: createdAt(),
});

export const quoteMessages = pgTable(
  "quote_messages",
  {
    id: id(),
    quoteId: text("quote_id")
      .notNull()
      .references(() => quoteRequests.id, { onDelete: "cascade" }),
    sender: text("sender", { enum: ["customer", "admin"] }).notNull(),
    body: text("body").notNull(),
    priceCents: integer("price_cents"),
    fileUrl: text("file_url"),
    fileName: text("file_name"),
    createdAt: createdAt(),
  },
  (t) => [index("quote_messages_quote_idx").on(t.quoteId)],
);

// ── Stock & réglages ─────────────────────────────────────────────────────────

export const inventoryLog = pgTable("inventory_log", {
  id: id(),
  variantId: text("variant_id").notNull(),
  delta: integer("delta").notNull(),
  reason: text("reason").notNull(),
  createdAt: createdAt(),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const discountCodes = pgTable("discount_codes", {
  id: id(),
  code: text("code").notNull().unique(),
  type: text("type", { enum: ["percent", "fixed"] }).notNull(),
  value: integer("value").notNull(),
  minSubtotalCents: integer("min_subtotal_cents"),
  maxUses: integer("max_uses"),
  usedCount: integer("used_count").notNull().default(0),
  active: boolean("active").notNull().default(true),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: createdAt(),
});

// ── Panier abandonné ─────────────────────────────────────────────────────────

export const abandonedCarts = pgTable(
  "abandoned_carts",
  {
    id: id(),
    email: text("email").notNull(),
    token: text("token").notNull().unique(),
    itemsJson: text("items_json").notNull(),
    subtotalCents: integer("subtotal_cents").notNull(),
    locale: text("locale", { enum: LOCALES }).notNull().default("fr"),
    consentAt: timestamp("consent_at", { withTimezone: true }).notNull(),
    reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),
    recoveredAt: timestamp("recovered_at", { withTimezone: true }),
    unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("abandoned_carts_email_idx").on(t.email)],
);

// ── Auth (Better Auth) ───────────────────────────────────────────────────────
// Migré depuis D1 vers Postgres (décision explicite : plus de split D1/
// Postgres).

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: text("role").notNull().default("customer"),
  twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
  stripeCustomerId: text("stripe_customer_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const twoFactor = pgTable(
  "two_factor",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    secret: text("secret").notNull(),
    backupCodes: text("backup_codes").notNull(),
    verified: boolean("verified").notNull().default(true),
    failedVerificationCount: integer("failed_verification_count")
      .notNull()
      .default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
  },
  (t) => [index("two_factor_user_idx").on(t.userId)],
);

export const passkey = pgTable(
  "passkey",
  {
    id: text("id").primaryKey(),
    name: text("name"),
    publicKey: text("public_key").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    credentialID: text("credential_id").notNull(),
    counter: integer("counter").notNull(),
    deviceType: text("device_type").notNull(),
    backedUp: boolean("backed_up").notNull(),
    transports: text("transports"),
    createdAt: timestamp("created_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
    aaguid: text("aaguid"),
  },
  (t) => [
    index("passkey_user_idx").on(t.userId),
    index("passkey_credential_idx").on(t.credentialID),
  ],
);

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = pgTable(
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
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const customerAddresses = pgTable(
  "customer_addresses",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    label: text("label"),
    name: text("name").notNull(),
    street: text("street").notNull(),
    npa: text("npa").notNull(),
    city: text("city").notNull(),
    canton: text("canton").notNull().default(""),
    isDefault: boolean("is_default").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("customer_addresses_user_idx").on(t.userId)],
);

export const notificationPreferences = pgTable("notification_preferences", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  newsletter: boolean("newsletter").notNull().default(false),
  productNews: boolean("product_news").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const newsletterSends = pgTable("newsletter_sends", {
  id: id(),
  subject: text("subject").notNull(),
  bodyHtml: text("body_html").notNull(),
  audience: text("audience", {
    enum: ["newsletter", "product_news", "both"],
  }).notNull(),
  productIds: text("product_ids"),
  bannerImageUrl: text("banner_image_url"),
  ctaLabel: text("cta_label"),
  ctaUrl: text("cta_url"),
  recipientCount: integer("recipient_count").notNull(),
  sentBy: text("sent_by")
    .notNull()
    .references(() => user.id),
  createdAt: createdAt(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});
