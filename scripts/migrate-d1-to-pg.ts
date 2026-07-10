/// <reference types="bun" />
// Outil de migration des données réelles de production D1 -> Postgres, utilisé
// lors du pivot de stack 2026-07-09 (voir AGENTS.md), gardé pour resynchroniser
// si besoin. Lit un export SQL de D1 (généré par
// `wrangler d1 export swiss3design-db --remote --output=...`)
// dans une base SQLite Bun temporaire, puis recopie chaque table vers
// Postgres via les deux schémas Drizzle déjà existants (schema.d1.ts /
// schema.pg.ts) — aucune transformation manuelle de type nécessaire, Drizzle
// gère le décodage timestamp/boolean identiquement des deux côtés.
//
// Usage : bun run scripts/migrate-d1-to-pg.ts <chemin-vers-export.sql>
//
// NE MODIFIE JAMAIS D1 (lecture seule, via un fichier déjà exporté à part).
// Écrit dans la base Postgres "swiss3design" (voir DATABASE_URL, .dev.vars) —
// idempotent : les tables cibles doivent être vides avant un premier essai
// (ré-exécuter après un TRUNCATE si besoin de recommencer).

import { Database } from "bun:sqlite";
import { drizzle as drizzleSqlite } from "drizzle-orm/bun-sqlite";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as d1Schema from "../src/db/schema.d1";
import * as pgSchema from "../src/db/schema.pg";

const dumpPath = process.argv[2];
if (!dumpPath) {
  console.error("Usage: bun run scripts/migrate-d1-to-pg.ts <export.sql>");
  process.exit(1);
}

// Ordre topologique (dépendances FK respectées) : catalogue -> auth ->
// commandes/devis (référencent products/orders/user en FK ou lien informel).
const TABLES: {
  name: string;
  d1: keyof typeof d1Schema;
  pg: keyof typeof pgSchema;
}[] = [
  { name: "materials", d1: "materials", pg: "materials" },
  { name: "filament_colors", d1: "filamentColors", pg: "filamentColors" },
  { name: "categories", d1: "categories", pg: "categories" },
  {
    name: "category_translations",
    d1: "categoryTranslations",
    pg: "categoryTranslations",
  },
  { name: "products", d1: "products", pg: "products" },
  {
    name: "product_translations",
    d1: "productTranslations",
    pg: "productTranslations",
  },
  { name: "product_images", d1: "productImages", pg: "productImages" },
  { name: "product_variants", d1: "productVariants", pg: "productVariants" },
  { name: "product_colors", d1: "productColors", pg: "productColors" },
  {
    name: "product_categories",
    d1: "productCategories",
    pg: "productCategories",
  },
  { name: "user", d1: "user", pg: "user" },
  { name: "two_factor", d1: "twoFactor", pg: "twoFactor" },
  { name: "passkey", d1: "passkey", pg: "passkey" },
  { name: "session", d1: "session", pg: "session" },
  { name: "account", d1: "account", pg: "account" },
  {
    name: "customer_addresses",
    d1: "customerAddresses",
    pg: "customerAddresses",
  },
  {
    name: "notification_preferences",
    d1: "notificationPreferences",
    pg: "notificationPreferences",
  },
  { name: "verification", d1: "verification", pg: "verification" },
  { name: "orders", d1: "orders", pg: "orders" },
  { name: "order_items", d1: "orderItems", pg: "orderItems" },
  { name: "reviews", d1: "reviews", pg: "reviews" },
  { name: "quote_requests", d1: "quoteRequests", pg: "quoteRequests" },
  { name: "quote_messages", d1: "quoteMessages", pg: "quoteMessages" },
  { name: "inventory_log", d1: "inventoryLog", pg: "inventoryLog" },
  { name: "settings", d1: "settings", pg: "settings" },
  { name: "discount_codes", d1: "discountCodes", pg: "discountCodes" },
  { name: "abandoned_carts", d1: "abandonedCarts", pg: "abandonedCarts" },
  { name: "newsletter_sends", d1: "newsletterSends", pg: "newsletterSends" },
];

const BATCH_SIZE = 500;

async function main() {
  console.log(`Chargement de ${dumpPath} dans SQLite temporaire...`);
  const sqlite = new Database(":memory:");
  const dumpSql = await Bun.file(dumpPath).text();
  sqlite.exec(dumpSql);
  const d1 = drizzleSqlite(sqlite, { schema: d1Schema });

  const pgClient = postgres(process.env.DATABASE_URL!, { max: 5 });
  const pg = drizzlePg(pgClient, { schema: pgSchema });

  const results: { table: string; source: number; inserted: number }[] = [];

  for (const { name, d1: d1Key, pg: pgKey } of TABLES) {
    const exists = sqlite
      .query("SELECT 1 FROM sqlite_master WHERE type='table' AND name = ?")
      .get(name);
    if (!exists) {
      console.warn(`  ${name}: absente du dump, ignorée`);
      results.push({ table: name, source: 0, inserted: 0 });
      continue;
    }

    const sourceTable = d1Schema[d1Key] as Parameters<
      typeof d1.select
    >[0] extends never
      ? never
      : (typeof d1Schema)[typeof d1Key];
    const destTable = pgSchema[pgKey];

    // biome-ignore lint/suspicious/noExplicitAny: table dynamique (nom resolu a l'execution), aucun type Drizzle statique possible ici
    const rows = await (d1.select().from(sourceTable as any) as Promise<any[]>);
    let inserted = 0;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      if (batch.length === 0) continue;
      // biome-ignore lint/suspicious/noExplicitAny: table dynamique (nom resolu a l'execution), aucun type Drizzle statique possible ici
      await (pg.insert(destTable as any).values(batch) as Promise<unknown>);
      inserted += batch.length;
    }
    results.push({ table: name, source: rows.length, inserted });
    console.log(`  ${name}: ${inserted}/${rows.length} lignes`);
  }

  console.log("\nRécapitulatif :");
  console.table(results);
  const mismatches = results.filter((r) => r.source !== r.inserted);
  if (mismatches.length > 0) {
    console.error(
      "ÉCART détecté sur :",
      mismatches.map((m) => m.table).join(", "),
    );
    process.exitCode = 1;
  } else {
    console.log("Toutes les tables migrées avec des comptages identiques.");
  }

  await pgClient.end();
  sqlite.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
