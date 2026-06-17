import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  index,
  uniqueIndex,
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
  // Clé R2 d'un modèle 3D (.stl ou .glb) affiché dans le viewer interactif de
  // la fiche produit (teinté dans chaque couleur proposée). null = pas de 3D.
  model3dUrl: text("model_3d_url"),
  multicolor: integer("multicolor", { mode: "boolean" }).notNull().default(false),
  featured: integer("featured", { mode: "boolean" }).notNull().default(false),
  // Rang dans la « Sélection du moment » (page d'accueil) : plus petit = plus
  // tôt. Édité depuis l'admin /admin/featured ; ignoré si featured = false.
  featuredOrder: integer("featured_order").notNull().default(0),
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

// Types de filament proposés à la création d'un produit (palette éditable
// en admin). Le produit stocke le nom retenu en texte (products.material),
// donc les filtres boutique restent dérivés de l'usage réel du catalogue.
export const materials = sqliteTable("materials", {
  id: uuid(),
  name: text("name").notNull().unique(),
});

// Couleurs disponibles pour un filament (palette éditable en admin). Chaque
// couleur a un nom (« Rouge feu ») et un code hex affiché en pastille. Un
// produit choisit ensuite parmi les couleurs de son filament (productColors).
export const filamentColors = sqliteTable(
  "filament_colors",
  {
    id: uuid(),
    materialId: text("material_id")
      .notNull()
      .references(() => materials.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    hex: text("hex").notNull(), // "#RRGGBB"
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

// Couleurs proposées par un produit, choisies dans la palette de son filament.
// Le client sélectionne une pastille à l'achat ; la couleur retenue est figée
// dans order_items (snapshot), donc l'historique survit aux changements de palette.
export const productColors = sqliteTable(
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
    // Remise appliquée (code promo) — 0 si aucune
    discountCents: integer("discount_cents").notNull().default(0),
    discountCode: text("discount_code"),
    totalCents: integer("total_cents").notNull(),
    // Snapshot JSON de l'adresse (Suisse uniquement, validé côté serveur)
    shippingAddress: text("shipping_address").notNull(),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    // N° de suivi Poste suisse, inclus dans l'e-mail d'expédition
    trackingNumber: text("tracking_number"),
    // Note interne admin, jamais visible par le client
    adminNote: text("admin_note"),
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
    // Couleur choisie au moment de l'achat (snapshot, null si non applicable)
    colorName: text("color_name"),
    colorHex: text("color_hex"),
    priceCentsSnapshot: integer("price_cents_snapshot").notNull(),
    quantity: integer("quantity").notNull(),
  },
  (t) => [index("order_items_order_idx").on(t.orderId)],
);

// ── Avis produits ────────────────────────────────────────────────────────────

// Avis client : ouverts UNIQUEMENT pour un produit présent dans une commande
// LIVRÉE de l'auteur (acheteur vérifié, contrôlé côté serveur). Modérés avant
// publication (status). Le nom affiché est un snapshot du nom du compte.
export const reviews = sqliteTable(
  "reviews",
  {
    id: uuid(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    customerId: text("customer_id"), // utilisateur Better Auth (auteur)
    authorName: text("author_name").notNull(),
    rating: integer("rating").notNull(), // 1–5
    body: text("body"),
    status: text("status", { enum: ["pending", "published", "rejected"] })
      .notNull()
      .default("pending"),
    createdAt: createdAt(),
  },
  (t) => [
    index("reviews_product_idx").on(t.productId),
    // Un seul avis par (commande, produit) : empêche les doublons.
    uniqueIndex("reviews_order_product_unique").on(t.orderId, t.productId),
  ],
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
    enum: [
      "received",
      "quoted",
      "revision_requested", // le client demande un changement → à re-chiffrer
      "accepted",
      "declined", // le client a refusé le devis
      "paid",
      "in_production",
      "done",
      "rejected", // l'atelier ne donne pas suite à la demande
    ],
  })
    .notNull()
    .default("received"),
  quotedPriceCents: integer("quoted_price_cents"),
  adminMessage: text("admin_message"),
  // Validité du devis : posée à +30 j au chiffrage, réinitialisée à chaque re-devis
  validUntil: integer("valid_until", { mode: "timestamp" }),
  // Note interne admin, jamais visible par le client
  adminNote: text("admin_note"),
  locale: text("locale", { enum: LOCALES }).notNull().default("fr"),
  createdAt: createdAt(),
});

// Fil de discussion d'un devis : échanges client ↔ atelier, historique des
// re-devis et demandes de modification. Un message admin peut porter un prix
// (re-)proposé (priceCents) et un message client un fichier 3D corrigé.
export const quoteMessages = sqliteTable(
  "quote_messages",
  {
    id: uuid(),
    quoteId: text("quote_id")
      .notNull()
      .references(() => quoteRequests.id, { onDelete: "cascade" }),
    sender: text("sender", { enum: ["customer", "admin"] }).notNull(),
    body: text("body").notNull(),
    priceCents: integer("price_cents"), // null sauf message portant un (re-)devis
    fileUrl: text("file_url"), // clé R2 d'un fichier joint (optionnel)
    fileName: text("file_name"),
    createdAt: createdAt(),
  },
  (t) => [index("quote_messages_quote_idx").on(t.quoteId)],
);

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

// Codes promo : pourcentage ou montant fixe, avec garde-fous optionnels
export const discountCodes = sqliteTable("discount_codes", {
  id: uuid(),
  code: text("code").notNull().unique(), // stocké en MAJUSCULES
  type: text("type", { enum: ["percent", "fixed"] }).notNull(),
  // percent : 1–100 ; fixed : centimes de remise
  value: integer("value").notNull(),
  minSubtotalCents: integer("min_subtotal_cents"),
  maxUses: integer("max_uses"), // null = illimité
  usedCount: integer("used_count").notNull().default(0),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  expiresAt: integer("expires_at", { mode: "timestamp" }), // null = sans expiration
  createdAt: createdAt(),
});

// ── Panier abandonné (relance e-mail, opt-in nLPD) ───────────────────────────

// Relance de panier : enregistrée UNIQUEMENT sur consentement EXPLICITE du
// client (case à cocher décochée par défaut, au panier). `token` permet la
// désinscription en un clic (retrait du consentement). Une seule relance par
// panier (reminderSentAt). Purge à 30 jours = minimisation des données (nLPD).
export const abandonedCarts = sqliteTable(
  "abandoned_carts",
  {
    id: uuid(),
    email: text("email").notNull(),
    token: text("token").notNull().unique(),
    itemsJson: text("items_json").notNull(), // snapshot affiché dans l'e-mail
    subtotalCents: integer("subtotal_cents").notNull(),
    locale: text("locale", { enum: LOCALES }).notNull().default("fr"),
    consentAt: integer("consent_at", { mode: "timestamp" }).notNull(),
    reminderSentAt: integer("reminder_sent_at", { mode: "timestamp" }),
    recoveredAt: integer("recovered_at", { mode: "timestamp" }), // commande passée
    unsubscribedAt: integer("unsubscribed_at", { mode: "timestamp" }),
    createdAt: createdAt(),
  },
  (t) => [index("abandoned_carts_email_idx").on(t.email)],
);

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
  // Géré par le plugin Better Auth twoFactor (jamais modifiable par le client)
  twoFactorEnabled: integer("two_factor_enabled", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// Authentification à deux facteurs (TOTP + codes de récupération) — Better Auth
export const twoFactor = sqliteTable(
  "two_factor",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    secret: text("secret").notNull(),
    backupCodes: text("backup_codes").notNull(),
    verified: integer("verified", { mode: "boolean" }).notNull().default(true),
  },
  (t) => [index("two_factor_user_idx").on(t.userId)],
);

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

// Adresse de livraison enregistrée (une par client, proposée au checkout)
export const customerAddresses = sqliteTable("customer_addresses", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  street: text("street").notNull(),
  npa: text("npa").notNull(),
  city: text("city").notNull(),
  canton: text("canton").notNull().default(""),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
});
