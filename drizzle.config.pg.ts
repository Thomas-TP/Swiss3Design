import { defineConfig } from "drizzle-kit";

// Config drizzle-kit pour le schéma Postgres (Hyperdrive, actif) — distincte
// de drizzle.config.ts (D1/SQLite, filet de secours inactif, voir AGENTS.md).
export default defineConfig({
  schema: "./src/db/schema.pg.ts",
  out: "./drizzle-pg",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
