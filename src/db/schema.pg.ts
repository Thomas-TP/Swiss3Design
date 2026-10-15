import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  primaryKey,
  index,
  uniqueIndex,
  check,
  jsonb,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { StudioOrderLine } from "@/lib/studio/order-line";

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

export const ORDER_CHANNELS = [
  "web",
  "stripe_acs",
  "mpp",
  "acp",
  "ucp",
  "x402",
] as const;

// ── Catalogue ────────────────────────────────────────────────────────────────

export const products = pgTable(
  "products",
  {
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
  },
  (t) => [
    check("products_price_nonnegative", sql`${t.priceCents} >= 0`),
    check("products_stock_nonnegative", sql`${t.stock} >= 0`),
  ],
);

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
  (t) => [
    index("product_variants_product_idx").on(t.productId),
    check("variants_stock_nonnegative", sql`${t.stock} >= 0`),
    check("variants_price_nonnegative", sql`${t.priceCents} >= 0`),
  ],
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
    checkoutSessionId: text("checkout_session_id").unique(),
    checkoutAttemptKey: text("checkout_attempt_key").unique(),
    stripeCustomerId: text("stripe_customer_id"),
    checkoutFingerprint: text("checkout_fingerprint"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    stockReservedAt: timestamp("stock_reserved_at", { withTimezone: true }),
    stockReleasedAt: timestamp("stock_released_at", { withTimezone: true }),
    reservationExpiresAt: timestamp("reservation_expires_at", {
      withTimezone: true,
    }),
    refundedCents: integer("refunded_cents").notNull().default(0),
    trackingNumber: text("tracking_number"),
    adminNote: text("admin_note"),
    locale: text("locale", { enum: LOCALES }).notNull().default("fr"),
    // Canal de vente : le site, ou un agent IA — via Stripe (Agentic Commerce
    // Suite : ChatGPT & co.), ou nos propres protocoles MPP, ACP, UCP, x402.
    channel: text("channel", { enum: ORDER_CHANNELS }).notNull().default("web"),
    // Agent déclaré par la plateforme (ex. « ChatGPT »), à titre informatif.
    agentName: text("agent_name"),
    createdAt: createdAt(),
  },
  (t) => [
    index("orders_customer_idx").on(t.customerId),
    index("orders_pending_expiry_idx").on(t.status, t.reservationExpiresAt),
    uniqueIndex("orders_payment_intent_unique").on(t.stripePaymentIntentId),
    check(
      "orders_amounts_valid",
      sql`${t.subtotalCents} >= 0 AND ${t.shippingCents} >= 0 AND ${t.discountCents} >= 0 AND ${t.discountCents} <= ${t.subtotalCents} AND ${t.totalCents} = ${t.subtotalCents} + ${t.shippingCents} - ${t.discountCents} AND ${t.refundedCents} >= 0 AND ${t.refundedCents} <= ${t.totalCents}`,
    ),
    check(
      "orders_status_valid",
      sql`${t.status} IN ('pending','paid','in_production','shipped','delivered','cancelled')`,
    ),
    check(
      "orders_channel_valid",
      sql`${t.channel} IN ('web','stripe_acs','mpp','acp','ucp','x402')`,
    ),
  ],
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
    // Objet du Studio acheté (« Achat direct », 14.10.2026) : configuration,
    // textes saisis (données personnelles possibles), chiffres et prix de la
    // pièce. NULL pour une ligne de la boutique. Une ligne du Studio n'a ni
    // `product_id` ni `variant_id` : aucun stock, aucune fiche produit.
    studio: jsonb("studio").$type<StudioOrderLine>(),
  },
  (t) => [
    index("order_items_order_idx").on(t.orderId),
    check("order_items_quantity_positive", sql`${t.quantity} > 0`),
    check("order_items_price_nonnegative", sql`${t.priceCentsSnapshot} >= 0`),
  ],
);

// Sessions de checkout ouvertes par un agent IA via nos API ACP ou UCP : le
// panier, l'acheteur et l'adresse vivent ici (JSON) jusqu'au paiement, qui
// crée une vraie commande (`orderId`). Purgées une semaine après expiration.
export const agentCheckoutSessions = pgTable(
  "agent_checkout_sessions",
  {
    id: text("id").primaryKey(),
    protocol: text("protocol", { enum: ["acp", "ucp"] }).notNull(),
    status: text("status", {
      enum: ["open", "completed", "canceled"],
    })
      .notNull()
      .default("open"),
    state: jsonb("state").notNull(),
    orderId: text("order_id").references(() => orders.id, {
      onDelete: "set null",
    }),
    agent: text("agent"),
    customerId: text("customer_id"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("agent_checkout_sessions_expiry_idx").on(t.expiresAt),
    check(
      "agent_checkout_sessions_status_valid",
      sql`${t.status} IN ('open','completed','canceled')`,
    ),
    check(
      "agent_checkout_sessions_protocol_valid",
      sql`${t.protocol} IN ('acp','ucp')`,
    ),
  ],
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
  checkoutSessionId: text("checkout_session_id").unique(),
  offerVersion: integer("offer_version").notNull().default(1),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  stripePaymentIntentId: text("stripe_payment_intent_id").unique(),
  paidPriceCents: integer("paid_price_cents"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
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

// ── Stock de filament (« Filaments », 15.10.2026) ────────────────────────────
// Bobines PHYSIQUES de l'atelier : références (une couleur d'une gamme d'une
// marque), supports plastique vides, achats, bobines et journal des mouvements.
// Le « réservé » n'est pas stocké : il se déduit des commandes du Studio et des
// devis (lib/filament/reservations.ts). Les grammes sont des entiers.

export const SPOOL_TYPES = [
  "bambu_reusable", // bobine plastique réutilisable Bambu (tare 212 g)
  "bambu_refill", // recharge Bambu montée sur un support (support + mandrin)
  "polymaker_cardboard", // carton Polymaker 1 kg (140 g)
  "r3d_cardboard", // carton R3D (≈ 150 g, à vérifier)
  "other",
] as const;
export const SPOOL_STATUSES = [
  "ordered",
  "in_stock",
  "empty",
  "retired",
] as const;
export const SPOOL_LOCATIONS = ["ams_p1s", "cfs_k2", "shelf"] as const;
export const MOVEMENT_KINDS = [
  "receipt",
  "consumption",
  "weigh",
  "adjust",
  "empty",
  "retire",
] as const;

// Une couleur d'une gamme : l'unité que l'on achète et que l'on propose. Les
// drapeaux d'usage sont portés ici : Studio (`studio_id`), boutique
// (`shop_color_id`), sur mesure (`custom_ok`).
export const filamentRefs = pgTable(
  "filament_refs",
  {
    id: id(),
    brand: text("brand").notNull(),
    rangeName: text("range_name").notNull(),
    officialName: text("official_name").notNull(),
    productCode: text("product_code"),
    // Hex officiel ; un filament multicolore (tricolore co-extrudé) en porte
    // jusqu'à trois (hex2, hex3), la pastille montre alors un dégradé.
    hex: text("hex").notNull(),
    hex2: text("hex2"),
    hex3: text("hex3"),
    // Faux : teintes approximatives, à confirmer sur la bobine.
    hexConfirmed: boolean("hex_confirmed").notNull().default(true),
    studioId: text("studio_id").unique(),
    shopColorId: text("shop_color_id").references(() => filamentColors.id, {
      onDelete: "set null",
    }),
    customOk: boolean("custom_ok").notNull().default(false),
    spoolNetGrams: integer("spool_net_grams").notNull().default(1000),
    reorderBelowGrams: integer("reorder_below_grams").notNull().default(300),
    minSpareSpools: integer("min_spare_spools").notNull().default(0),
    // Prix catalogue Bambu Europe, en centimes d'EUR (exception documentée à la
    // règle « tout en CHF » : le seuil de port gratuit est en euros). Les coûts
    // réels, eux, sont en centimes CHF (`filament_spools.cost_cents`).
    priceSpoolEurCents: integer("price_spool_eur_cents"),
    priceRefillEurCents: integer("price_refill_eur_cents"),
    urlSpool: text("url_spool"),
    urlRefill: text("url_refill"),
    active: boolean("active").notNull().default(true),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("filament_refs_identity_unique").on(
      t.brand,
      t.rangeName,
      t.officialName,
    ),
    check(
      "filament_refs_hex_valid",
      sql`${t.hex} ~ '^#[0-9A-F]{6}$' AND (${t.hex2} IS NULL OR ${t.hex2} ~ '^#[0-9A-F]{6}$') AND (${t.hex3} IS NULL OR ${t.hex3} ~ '^#[0-9A-F]{6}$') AND (${t.hex3} IS NULL OR ${t.hex2} IS NOT NULL)`,
    ),
    check(
      "filament_refs_grams_valid",
      sql`${t.spoolNetGrams} > 0 AND ${t.reorderBelowGrams} >= 0 AND ${t.minSpareSpools} >= 0`,
    ),
  ],
);

// Support plastique réutilisable vide (ou monté) : sert à compter les recharges
// que l'on peut monter. Libre tant qu'aucune bobine active ne le référence.
export const filamentHolders = pgTable(
  "filament_holders",
  {
    id: id(),
    tareGrams: integer("tare_grams").notNull().default(212),
    note: text("note"),
    retiredAt: timestamp("retired_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    check(
      "filament_holders_tare_valid",
      sql`${t.tareGrams} BETWEEN 50 AND 400`,
    ),
  ],
);

export const filamentPurchases = pgTable("filament_purchases", {
  id: id(),
  supplier: text("supplier").notNull().default("Bambu Lab Europe"),
  reference: text("reference"),
  status: text("status", { enum: ["ordered", "received", "cancelled"] })
    .notNull()
    .default("ordered"),
  orderedAt: timestamp("ordered_at", { withTimezone: true }),
  receivedAt: timestamp("received_at", { withTimezone: true }),
  // CHF réellement payé (null tant qu'inconnu) ; l'EUR n'est qu'un mémo.
  totalCents: integer("total_cents"),
  totalEurCents: integer("total_eur_cents"),
  shippingCents: integer("shipping_cents").notNull().default(0),
  note: text("note"),
  createdAt: createdAt(),
});

export const filamentSpools = pgTable(
  "filament_spools",
  {
    id: id(),
    refId: text("ref_id")
      .notNull()
      .references(() => filamentRefs.id, { onDelete: "restrict" }),
    purchaseId: text("purchase_id").references(() => filamentPurchases.id, {
      onDelete: "set null",
    }),
    holderId: text("holder_id").references(() => filamentHolders.id, {
      onDelete: "set null",
    }),
    spoolType: text("spool_type", { enum: SPOOL_TYPES }).notNull(),
    tareGrams: integer("tare_grams").notNull(),
    // Faux : tare estimée, à vérifier en pesant le support vide.
    tareConfirmed: boolean("tare_confirmed").notNull().default(true),
    initialGrams: integer("initial_grams").notNull().default(1000),
    // Dénormalisé : somme des mouvements, mis à jour dans la même transaction.
    remainingGrams: integer("remaining_grams").notNull().default(0),
    status: text("status", { enum: SPOOL_STATUSES })
      .notNull()
      .default("in_stock"),
    sealed: boolean("sealed").notNull().default(false),
    location: text("location", { enum: SPOOL_LOCATIONS }),
    slot: text("slot"),
    costCents: integer("cost_cents"),
    purchasedAt: timestamp("purchased_at", { withTimezone: true }),
    // Identification incertaine (couleur à confirmer sur la bobine).
    toConfirm: boolean("to_confirm").notNull().default(false),
    lastWeighedAt: timestamp("last_weighed_at", { withTimezone: true }),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [
    index("filament_spools_ref_status_idx").on(t.refId, t.status),
    check(
      "filament_spools_grams_valid",
      sql`${t.tareGrams} >= 0 AND ${t.initialGrams} > 0 AND ${t.remainingGrams} >= 0`,
    ),
    check(
      "filament_spools_status_valid",
      sql`${t.status} IN ('ordered','in_stock','empty','retired')`,
    ),
    check(
      "filament_spools_type_valid",
      sql`${t.spoolType} IN ('bambu_reusable','bambu_refill','polymaker_cardboard','r3d_cardboard','other')`,
    ),
  ],
);

// Journal APPEND-ONLY : une correction est un nouveau mouvement. Une bobine
// ne se supprime pas (RESTRICT) : elle se retire.
export const filamentMovements = pgTable(
  "filament_movements",
  {
    id: id(),
    spoolId: text("spool_id")
      .notNull()
      .references(() => filamentSpools.id, { onDelete: "restrict" }),
    kind: text("kind", { enum: MOVEMENT_KINDS }).notNull(),
    deltaGrams: integer("delta_grams").notNull(),
    gramsAfter: integer("grams_after").notNull(),
    grossGrams: integer("gross_grams"),
    tareGrams: integer("tare_grams"),
    orderId: text("order_id").references(() => orders.id, {
      onDelete: "set null",
    }),
    quoteId: text("quote_id").references(() => quoteRequests.id, {
      onDelete: "set null",
    }),
    idempotencyKey: text("idempotency_key").unique(),
    note: text("note"),
    actorId: text("actor_id"),
    createdAt: createdAt(),
  },
  (t) => [
    index("filament_movements_spool_idx").on(t.spoolId, t.createdAt),
    index("filament_movements_order_idx").on(t.orderId),
    index("filament_movements_quote_idx").on(t.quoteId),
    index("filament_movements_kind_idx").on(t.kind, t.createdAt),
    check(
      "filament_movements_kind_valid",
      sql`${t.kind} IN ('receipt','consumption','weigh','adjust','empty','retire')`,
    ),
    check("filament_movements_after_valid", sql`${t.gramsAfter} >= 0`),
  ],
);

// Décompte fait : une commande ou un devis dont les grammes ont été retirés des
// bobines ne réserve plus rien. Table À PART (et non une colonne de `orders` ou
// `quote_requests`) : les `select()` du paiement et du webhook Stripe listent
// toutes les colonnes de ces tables, et le paiement ne doit jamais dépendre
// d'une migration du stock.
export const filamentConsumptions = pgTable(
  "filament_consumptions",
  {
    id: id(),
    orderId: text("order_id")
      .unique()
      .references(() => orders.id, { onDelete: "cascade" }),
    quoteId: text("quote_id")
      .unique()
      .references(() => quoteRequests.id, { onDelete: "cascade" }),
    consumedAt: timestamp("consumed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    actorId: text("actor_id"),
    note: text("note"),
  },
  (t) => [
    check(
      "filament_consumptions_one_source",
      sql`(${t.orderId} IS NOT NULL)::int + (${t.quoteId} IS NOT NULL)::int = 1`,
    ),
  ],
);

// Couleurs de la boutique : TOUS les articles proposent les références de
// filament proposées en « Sur mesure » (`filament_refs.custom_ok`, actives) ; cette
// table ne porte que les EXCLUSIONS, par article (case décochée dans la fiche
// admin). Table à part, vide par défaut : aucun article n'exclut rien tant que le
// propriétaire n'a rien décoché, et la boutique reste affichable sans cette
// migration (code tolérant : 42P01 → aucune exclusion).
export const productFilamentExclusions = pgTable(
  "product_filament_exclusions",
  {
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    refId: text("ref_id")
      .notNull()
      .references(() => filamentRefs.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.productId, t.refId] }),
    index("product_filament_exclusions_ref_idx").on(t.refId),
  ],
);

// Réservation de filament d'une ligne de commande de la boutique (article
// avec un poids, couleur suivie) : grammes d'UNE pièce ; la ligne réserve
// `grams_per_piece × quantité`, dérivé comme tout le reste (aucun total réservé
// n'est stocké). Table À PART, pas une colonne de `order_items` : tous les
// `select()` de `order_items` (webhook Stripe compris) listent ses colonnes, et le
// paiement ne doit jamais dépendre d'une migration du stock. RESTRICT : une
// référence réservée par une commande ne se supprime pas (on la désactive).
export const orderItemFilaments = pgTable(
  "order_item_filaments",
  {
    orderItemId: text("order_item_id")
      .primaryKey()
      .references(() => orderItems.id, { onDelete: "cascade" }),
    refId: text("ref_id")
      .notNull()
      .references(() => filamentRefs.id, { onDelete: "restrict" }),
    gramsPerPiece: integer("grams_per_piece").notNull(),
  },
  (t) => [
    index("order_item_filaments_ref_idx").on(t.refId),
    check("order_item_filaments_grams_positive", sql`${t.gramsPerPiece} > 0`),
  ],
);

// Ce que le stock sait d'un devis du formulaire : quantité, couleurs choisies
// (ids de `filament_refs`), poids estimé d'UNE pièce par le navigateur (donnée
// indicative) et grammes par couleur saisis par l'admin (réservation).
export const filamentQuoteDetails = pgTable(
  "filament_quote_details",
  {
    quoteId: text("quote_id")
      .primaryKey()
      .references(() => quoteRequests.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull().default(1),
    colorRefs: jsonb("color_refs").$type<string[]>(),
    estGrams: integer("est_grams"),
    plan: jsonb("plan").$type<Record<string, number>>(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    check(
      "filament_quote_details_quantity_valid",
      sql`${t.quantity} BETWEEN 1 AND 100`,
    ),
  ],
);

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

/** File persistante : les e-mails sont insérés dans la transaction métier. */
export const emailOutbox = pgTable(
  "email_outbox",
  {
    key: text("key").primaryKey(),
    messageJson: text("message_json").notNull(),
    attempts: integer("attempts").notNull().default(0),
    availableAt: timestamp("available_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("email_outbox_pending_idx").on(t.sentAt, t.availableAt)],
);

export const paymentEvents = pgTable("payment_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  objectId: text("object_id").notNull(),
  createdAt: createdAt(),
});

export const statusEvents = pgTable(
  "status_events",
  {
    id: id(),
    entityType: text("entity_type", { enum: ["order", "quote"] }).notNull(),
    entityId: text("entity_id").notNull(),
    fromStatus: text("from_status"),
    toStatus: text("to_status").notNull(),
    source: text("source", {
      enum: ["checkout", "payment", "admin", "customer", "system"],
    }).notNull(),
    actorId: text("actor_id"),
    createdAt: createdAt(),
  },
  (t) => [
    index("status_events_entity_idx").on(t.entityType, t.entityId, t.createdAt),
    check(
      "status_events_entity_valid",
      sql`${t.entityType} IN ('order','quote')`,
    ),
    check(
      "status_events_source_valid",
      sql`${t.source} IN ('checkout','payment','admin','customer','system')`,
    ),
  ],
);

export const requestLimits = pgTable(
  "request_limits",
  {
    key: text("key").primaryKey(),
    count: integer("count").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("request_limits_expiry_idx").on(t.expiresAt)],
);

// ── Serveur OAuth 2.1 (plugins jwt + @better-auth/oauth-provider) ───────────
// Généré par la CLI better-auth (`bunx auth@1.7.6 generate`) puis aligné sur
// les conventions du fichier (timestamps avec fuseau). Sert aux agents et
// applications (clients MCP, ChatGPT, Claude…) que le client autorise à lire
// son compte : clients enregistrés, consentements, jetons. Les noms JS
// (oauthClient, …) sont ceux des modèles better-auth — ne pas renommer.

const tz = (name: string) => timestamp(name, { withTimezone: true });

// Clés de signature des jetons JWT (plugin jwt) — clé privée chiffrée.
export const jwks = pgTable("jwks", {
  id: text("id").primaryKey(),
  publicKey: text("public_key").notNull(),
  privateKey: text("private_key").notNull(),
  createdAt: tz("created_at").notNull(),
  expiresAt: tz("expires_at"),
  alg: text("alg"),
  crv: text("crv"),
});

export const oauthClient = pgTable(
  "oauth_client",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id").notNull().unique(),
    clientSecret: text("client_secret"),
    clientDiscoveryId: text("client_discovery_id"),
    disabled: boolean("disabled").default(false),
    skipConsent: boolean("skip_consent"),
    enableEndSession: boolean("enable_end_session"),
    subjectType: text("subject_type"),
    scopes: text("scopes").array(),
    clientCredentialsScopes: text("client_credentials_scopes")
      .array()
      .default([]),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    createdAt: tz("created_at"),
    updatedAt: tz("updated_at"),
    name: text("name"),
    uri: text("uri"),
    icon: text("icon"),
    contacts: text("contacts").array(),
    tos: text("tos"),
    policy: text("policy"),
    softwareId: text("software_id"),
    softwareVersion: text("software_version"),
    softwareStatement: text("software_statement"),
    redirectUris: text("redirect_uris").array().notNull(),
    postLogoutRedirectUris: text("post_logout_redirect_uris").array(),
    backchannelLogoutUri: text("backchannel_logout_uri"),
    backchannelLogoutSessionRequired: boolean(
      "backchannel_logout_session_required",
    ),
    tokenEndpointAuthMethod: text("token_endpoint_auth_method"),
    applicationType: text("application_type"),
    jwks: text("jwks"),
    jwksUri: text("jwks_uri"),
    grantTypes: text("grant_types").array(),
    responseTypes: text("response_types").array(),
    requirePKCE: boolean("require_pkce"),
    dpopBoundAccessTokens: boolean("dpop_bound_access_tokens").default(false),
    referenceId: text("reference_id"),
    metadata: jsonb("metadata"),
  },
  (t) => [index("oauth_client_user_idx").on(t.userId)],
);

// Ressources protégées (RFC 8707) : ici le serveur MCP « compte client ».
export const oauthResource = pgTable("oauth_resource", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull().unique(),
  name: text("name").notNull(),
  accessTokenTtl: integer("access_token_ttl"),
  refreshTokenTtl: integer("refresh_token_ttl"),
  signingAlgorithm: text("signing_algorithm"),
  signingKeyId: text("signing_key_id"),
  allowedScopes: text("allowed_scopes").array(),
  customClaims: jsonb("custom_claims"),
  dpopBoundAccessTokensRequired: boolean(
    "dpop_bound_access_tokens_required",
  ).default(false),
  disabled: boolean("disabled").default(false),
  createdAt: tz("created_at"),
  updatedAt: tz("updated_at"),
  policyVersion: integer("policy_version").default(1),
  metadata: jsonb("metadata"),
});

export const oauthClientResource = pgTable(
  "oauth_client_resource",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClient.clientId, { onDelete: "cascade" }),
    resourceId: text("resource_id")
      .notNull()
      .references(() => oauthResource.identifier, { onDelete: "cascade" }),
    metadata: jsonb("metadata"),
    createdAt: tz("created_at"),
  },
  (t) => [
    uniqueIndex("oauth_client_resource_uidx").on(t.clientId, t.resourceId),
    index("oauth_client_resource_client_idx").on(t.clientId),
    index("oauth_client_resource_resource_idx").on(t.resourceId),
  ],
);

export const oauthRefreshToken = pgTable(
  "oauth_refresh_token",
  {
    id: text("id").primaryKey(),
    token: text("token").notNull().unique(),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClient.clientId, { onDelete: "cascade" }),
    sessionId: text("session_id").references(() => session.id, {
      onDelete: "set null",
    }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    referenceId: text("reference_id"),
    authorizationCodeId: text("authorization_code_id"),
    resources: text("resources").array(),
    requestedUserInfoClaims: text("requested_user_info_claims").array(),
    expiresAt: tz("expires_at").notNull(),
    createdAt: tz("created_at").notNull(),
    revoked: tz("revoked"),
    rotatedAt: tz("rotated_at"),
    rotationReplayResponse: text("rotation_replay_response"),
    rotationReplayExpiresAt: tz("rotation_replay_expires_at"),
    authTime: tz("auth_time"),
    confirmation: jsonb("confirmation"),
    scopes: text("scopes").array().notNull(),
  },
  (t) => [
    index("oauth_refresh_token_client_idx").on(t.clientId),
    index("oauth_refresh_token_session_idx").on(t.sessionId),
    index("oauth_refresh_token_user_idx").on(t.userId),
    index("oauth_refresh_token_code_idx").on(t.authorizationCodeId),
  ],
);

export const oauthAccessToken = pgTable(
  "oauth_access_token",
  {
    id: text("id").primaryKey(),
    token: text("token").notNull().unique(),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClient.clientId, { onDelete: "cascade" }),
    sessionId: text("session_id").references(() => session.id, {
      onDelete: "set null",
    }),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    referenceId: text("reference_id"),
    authorizationCodeId: text("authorization_code_id"),
    resources: text("resources").array(),
    requestedUserInfoClaims: text("requested_user_info_claims").array(),
    refreshId: text("refresh_id").references(() => oauthRefreshToken.id, {
      onDelete: "cascade",
    }),
    expiresAt: tz("expires_at").notNull(),
    createdAt: tz("created_at").notNull(),
    revoked: tz("revoked"),
    confirmation: jsonb("confirmation"),
    scopes: text("scopes").array().notNull(),
  },
  (t) => [
    index("oauth_access_token_client_idx").on(t.clientId),
    index("oauth_access_token_session_idx").on(t.sessionId),
    index("oauth_access_token_user_idx").on(t.userId),
    index("oauth_access_token_code_idx").on(t.authorizationCodeId),
    index("oauth_access_token_refresh_idx").on(t.refreshId),
  ],
);

export const oauthConsent = pgTable(
  "oauth_consent",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClient.clientId, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    referenceId: text("reference_id"),
    resources: text("resources").array(),
    requestedUserInfoClaims: text("requested_user_info_claims").array(),
    scopes: text("scopes").array().notNull(),
    createdAt: tz("created_at").notNull(),
    updatedAt: tz("updated_at").notNull(),
  },
  (t) => [
    index("oauth_consent_client_idx").on(t.clientId),
    index("oauth_consent_user_idx").on(t.userId),
  ],
);

// Anti-rejeu des assertions private_key_jwt (identifiants déjà vus).
export const oauthClientAssertion = pgTable("oauth_client_assertion", {
  id: text("id").primaryKey(),
  expiresAt: tz("expires_at").notNull(),
});

// ── Enregistrement d'agents « auth.md » (profil WorkOS v0.6) ────────────────
// Un agent sans compte s'enregistre (anonyme, ou avec l'e-mail du client), puis
// le client — connecté sur swiss3design.ch — confirme en saisissant le code à
// 6 chiffres que l'agent lui a montré (cérémonie de revendication). Chaque
// enregistrement possède son client OAuth public : les jetons sont émis par le
// même serveur OAuth que pour les applications (src/lib/agent/agent-auth.ts).
// Les secrets (jeton de revendication, jeton de tentative, code) ne sont
// stockés que hachés (SHA-256).
export const agentRegistrations = pgTable(
  "agent_registrations",
  {
    id: text("id").primaryKey(),
    type: text("type", { enum: ["anonymous", "service_auth"] }).notNull(),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClient.clientId, { onDelete: "cascade" }),
    status: text("status", { enum: ["unclaimed", "claimed", "revoked"] })
      .notNull()
      .default("unclaimed"),
    // Renseigné à la revendication ; la suppression du compte supprime
    // l'enregistrement, donc tous les jetons qui en dérivent.
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    claimTokenHash: text("claim_token_hash").notNull().unique(),
    // E-mail (minuscules) du seul compte autorisé à revendiquer.
    claimEmail: text("claim_email"),
    // Fenêtre extérieure de revendication (24 h).
    claimExpiresAt: tz("claim_expires_at").notNull(),
    // Tentative en cours : jeton du lien de vérification + code à 6 chiffres.
    attemptTokenHash: text("attempt_token_hash").unique(),
    userCodeHash: text("user_code_hash"),
    attemptExpiresAt: tz("attempt_expires_at"),
    attemptFailures: integer("attempt_failures").notNull().default(0),
    deniedAt: tz("denied_at"),
    claimedAt: tz("claimed_at"),
    // Le jeton post-revendication n'est remis qu'une fois (sondage atomique).
    redeemedAt: tz("redeemed_at"),
    lastPolledAt: tz("last_polled_at"),
    // Incrémentée à la revendication et à la révocation : les assertions et
    // jetons d'accès d'une version antérieure sont refusés.
    assertionVersion: integer("assertion_version").notNull().default(1),
    revokedAt: tz("revoked_at"),
    createdAt: createdAt(),
    updatedAt: tz("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("agent_registrations_user_idx").on(t.userId),
    index("agent_registrations_expiry_idx").on(t.claimExpiresAt),
    check(
      "agent_registrations_type_valid",
      sql`${t.type} IN ('anonymous','service_auth')`,
    ),
    check(
      "agent_registrations_status_valid",
      sql`${t.status} IN ('unclaimed','claimed','revoked')`,
    ),
  ],
);
