import type Stripe from "stripe";
import { and, eq } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { getDb } from "@/db";
import { settings } from "@/db/schema";
import { uncached } from "@/db/fresh";
import { getShippingSettings } from "@/lib/shipping-settings";
import { getStripe } from "@/lib/stripe";
import { loadSellableSkus } from "./catalog";
import { buildFeed, type FeedType } from "./feed";

type Db = Awaited<ReturnType<typeof getDb>>;

// Envoi du catalogue à Stripe (Product Catalog Import API v2) : un import est
// créé, puis le CSV est déposé sur l'URL pré-signée qu'il renvoie (valable
// 5 min). Stripe traite ensuite le fichier en asynchrone, sans ordre garanti
// entre deux imports — d'où un flux produits complet en mode « replace » (le
// fichier fait foi, les SKU disparus sont supprimés) une fois par jour ou
// après une modification de fiche, et de simples flux stock/prix (upsert) le
// reste du temps.

const FULL_SYNC_KEY = "acs_catalog_full_sync_at";
const FULL_SYNC_EVERY_MS = 23 * 3600 * 1000;

interface FeedFile {
  type: FeedType;
  mode: "replace" | "upsert";
  csv: string;
}

async function uploadFeed(stripe: Stripe, file: FeedFile): Promise<string> {
  const created = await stripe.v2.commerce.productCatalog.imports.create({
    feed_type: file.type,
    mode: file.mode,
    metadata: {
      file_name: `swiss3design-${file.type}-${new Date().toISOString()}.csv`,
      source: "swiss3design.ch",
    },
  });
  const url = created.status_details?.awaiting_upload?.upload_url.url;
  if (!url) throw new Error("catalog_upload_url_missing");
  const response = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "text/csv" },
    body: file.csv,
  });
  if (!response.ok) throw new Error(`catalog_upload_failed:${response.status}`);
  return created.id;
}

async function lastFullSync(db: Db): Promise<number | null> {
  const [row] = await db
    .select({ value: settings.value })
    .from(settings)
    .where(and(eq(settings.key, FULL_SYNC_KEY), uncached));
  const time = row ? Date.parse(row.value) : Number.NaN;
  return Number.isFinite(time) ? time : null;
}

async function markFullSync(db: Db) {
  const value = new Date().toISOString();
  await db
    .insert(settings)
    .values({ key: FULL_SYNC_KEY, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } });
}

// Lecture de la base et génération des fichiers (tout ce qui a besoin de la
// base se fait ici, dans la requête) ; l'envoi, lui, n'est que du réseau.
async function prepareFiles(db: Db, full: boolean): Promise<FeedFile[]> {
  const [skus, rule] = await Promise.all([
    loadSellableSkus(db),
    getShippingSettings(),
  ]);
  if (full)
    return [
      {
        type: "product",
        mode: "replace",
        csv: buildFeed("product", skus, rule).csv,
      },
    ];
  const files: FeedFile[] = [];
  const inventory = buildFeed("inventory", skus, rule);
  if (inventory.rows)
    files.push({ type: "inventory", mode: "upsert", csv: inventory.csv });
  const pricing = buildFeed("pricing", skus, rule);
  if (pricing.rows)
    files.push({ type: "pricing", mode: "upsert", csv: pricing.csv });
  return files;
}

export type CatalogSyncReport =
  | { mode: "full" | "stock"; imports: string[] }
  | { mode: "skipped" | "error"; reason: string };

// Cron de maintenance : flux complet si le dernier date de plus de 23 h,
// sinon stock + prix. Attend la fin des envois (appel planifié, pas pressé).
export async function syncStripeCatalog(db: Db): Promise<CatalogSyncReport> {
  const { env } = await getCloudflareContext({ async: true });
  if (env.STRIPE_CATALOG_SYNC !== "on")
    return { mode: "skipped", reason: "disabled" };
  try {
    const last = await lastFullSync(db);
    const full = last == null || Date.now() - last > FULL_SYNC_EVERY_MS;
    const files = await prepareFiles(db, full);
    const stripe = getStripe(env.STRIPE_SECRET_KEY);
    const imports: string[] = [];
    for (const file of files) imports.push(await uploadFeed(stripe, file));
    if (full) await markFullSync(db);
    return { mode: full ? "full" : "stock", imports };
  } catch (error) {
    console.error("[catalogue Stripe] envoi impossible", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return {
      mode: "error",
      reason: error instanceof Error ? error.message : "unknown",
    };
  }
}

// Après une modification (fiche, stock, vente) : fichiers préparés tout de
// suite, envoyés en arrière-plan (`waitUntil`) pour ne jamais ralentir
// l'admin ni le webhook. Un échec est rattrapé par le prochain cron.
export async function pushCatalogChange(db: Db, change: "product" | "stock") {
  const { env, ctx } = await getCloudflareContext({ async: true });
  if (env.STRIPE_CATALOG_SYNC !== "on") return;
  try {
    // Sans marquer le flux complet comme fait : l'envoi peut encore échouer,
    // le cron quotidien reste la garantie.
    const files = await prepareFiles(db, change === "product");
    const stripe = getStripe(env.STRIPE_SECRET_KEY);
    const task = (async () => {
      for (const file of files) await uploadFeed(stripe, file);
    })().catch((error) =>
      console.error("[catalogue Stripe] envoi différé au prochain cron", {
        error: error instanceof Error ? error.message : "unknown",
      }),
    );
    ctx.waitUntil(task);
  } catch (error) {
    console.error("[catalogue Stripe] préparation impossible", {
      error: error instanceof Error ? error.message : "unknown",
    });
  }
}
