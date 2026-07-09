import { defineConfig } from "drizzle-kit";

// Config drizzle-kit pour le schéma Postgres (Hyperdrive) — distincte de
// drizzle.config.ts (D1/SQLite, toujours actif tant que les données réelles
// n'ont pas été migrées, voir C:\Users\leole\.claude\plans\foamy-swimming-cook.md).
export default defineConfig({
  schema: "./src/db/schema.pg.ts",
  out: "./drizzle-pg",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
