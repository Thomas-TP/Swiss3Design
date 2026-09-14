import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const source = await readFile(".dev.vars", "utf8");
const readVariable = (name: string) =>
  source
    .match(new RegExp(`^${name}\\s*=\\s*(.+)$`, "m"))?.[1]
    ?.trim()
    .replace(/^["']|["']$/g, "");

const rawDatabaseUrl = readVariable("DATABASE_URL");
if (!rawDatabaseUrl) throw new Error("DATABASE_URL absente de .dev.vars");
const databaseUrl = new URL(rawDatabaseUrl);
if (
  databaseUrl.hostname !==
  "ep-green-tooth-aswk3vbr.c-4.eu-central-1.aws.neon.tech"
)
  throw new Error("Tests refusés hors de la branche Neon preview identifiée");
// pg 9 donnera à sslmode=require la sémantique libpq, moins stricte. Cette URL
// de test conserve explicitement la vérification de certificat actuelle.
if (databaseUrl.searchParams.get("sslmode") === "require")
  databaseUrl.searchParams.set("sslmode", "verify-full");

const stripeKey = readVariable("STRIPE_SECRET_KEY");
const usableStripeKey =
  stripeKey?.startsWith("sk_test_") &&
  stripeKey.length > 40 &&
  !/placeholder|\.\.\./i.test(stripeKey)
    ? stripeKey
    : undefined;
if (!usableStripeKey)
  console.log(
    "Test Stripe API non exécuté : aucune clé TEST utilisable en local.",
  );

const env = {
  ...process.env,
  INTEGRATION_DATABASE_URL: databaseUrl.toString(),
  ...(usableStripeKey ? { INTEGRATION_STRIPE_TEST_KEY: usableStripeKey } : {}),
};
const result = spawnSync("bun", ["run", "test"], { stdio: "inherit", env });
process.exit(result.status ?? 1);
