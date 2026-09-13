import { Pool } from "pg";
import { readdir, readFile } from "node:fs/promises";
// La CI possède une base jetable ; ce script refuse explicitement Neon/production.
const connectionString = process.env.INTEGRATION_DATABASE_URL;
if (!connectionString) throw new Error("Base CI absente");
const target = new URL(connectionString);
if (
  process.env.CI !== "true" ||
  target.hostname !== "127.0.0.1" ||
  target.pathname !== "/swiss3design_ci"
)
  throw new Error("Base CI isolée obligatoire");
const pool = new Pool({ connectionString, max: 1 });
try {
  for (const file of (await readdir("drizzle-pg"))
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await pool.query(
      (await readFile("drizzle-pg/" + file, "utf8")).replaceAll(
        "--> statement-breakpoint",
        "",
      ),
    );
} finally {
  await pool.end();
}
