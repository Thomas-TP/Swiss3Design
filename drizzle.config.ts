import { defineConfig } from "drizzle-kit";

export default defineConfig({
  // Chemin D1/SQLite explicite (pas "./schema.ts" — ce fichier est un
  // re-export Postgres depuis la Phase 3 du pivot ; le pointer ici casserait
  // `drizzle-kit generate` en lui donnant un schéma pg-core avec dialect
  // sqlite). Cette config sert uniquement au filet de secours D1 legacy.
  schema: "./src/db/schema.d1.ts",
  out: "./drizzle",
  dialect: "sqlite",
});
