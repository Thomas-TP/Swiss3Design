// Ce que le public sait du stock : une CAPACITÉ par couleur (arrondie à 10 g,
// plafonnée à 1500 g), jamais le niveau exact. Mise en cache 60 s dans KV ; chaque
// écriture de l'admin vide la clé. Le paiement et le devis revérifient toujours,
// avec une lecture fraîche : ce cache ne sert qu'à griser ou masquer des couleurs.
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { getDb } from "@/db";
import { publicCapacity } from "./availability";
import { isMissingTable, loadStockSnapshot } from "./stock-db";

type Db = Awaited<ReturnType<typeof getDb>>;

export interface PublicCustomColor {
  /** Id de la référence (opaque). */
  id: string;
  name: string;
  brand: string;
  range: string;
  /** 1 à 3 teintes (tricolore co-extrudé). */
  hexes: string[];
  /** Les teintes sont approximatives : la bobine fait foi. */
  approximate: boolean;
  /** Capacité garantie en grammes. */
  cap: number;
}

export interface PublicStock {
  v: 1;
  /** Capacité par id de palette du Studio ; un id absent n'est pas suivi (disponible). */
  studio: Record<string, number>;
  /** Couleurs « sur mesure » en stock (capacité > 0). */
  custom: PublicCustomColor[];
}

const CACHE_KEY = "filament:public-stock:v1";
const TTL_SECONDS = 60;

export async function buildPublicStock(db: Db): Promise<PublicStock> {
  const empty: PublicStock = { v: 1, studio: {}, custom: [] };
  let snapshot;
  try {
    snapshot = await loadStockSnapshot(db);
  } catch (error) {
    if (!isMissingTable(error)) throw error;
    console.warn("[stock] tables du stock absentes : rien n'est suivi");
    return empty;
  }
  const out: PublicStock = { v: 1, studio: {}, custom: [] };
  for (const ref of snapshot.refs) {
    if (!ref.active) continue;
    const cap = publicCapacity(
      snapshot.availability.get(ref.id)?.available ?? 0,
    );
    if (ref.studioId) out.studio[ref.studioId] = cap;
    if (ref.customOk && cap > 0)
      out.custom.push({
        id: ref.id,
        name: ref.officialName,
        brand: ref.brand,
        range: ref.rangeName,
        hexes: [ref.hex, ref.hex2, ref.hex3].filter(
          (h): h is string => typeof h === "string",
        ),
        approximate: !ref.hexConfirmed,
        cap,
      });
  }
  return out;
}

async function kv() {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return env.KV ?? null;
  } catch {
    return null;
  }
}

/** Lecture publique, avec cache KV de 60 s. */
export async function getPublicStock(db: Db): Promise<PublicStock> {
  const store = await kv();
  if (store) {
    try {
      const cached = (await store.get(CACHE_KEY, "json")) as PublicStock | null;
      if (cached?.v === 1) return cached;
    } catch (error) {
      console.warn("[stock] lecture du cache impossible", error);
    }
  }
  const fresh = await buildPublicStock(db);
  if (store) {
    try {
      await store.put(CACHE_KEY, JSON.stringify(fresh), {
        expirationTtl: TTL_SECONDS,
      });
    } catch (error) {
      console.warn("[stock] écriture du cache impossible", error);
    }
  }
  return fresh;
}

/** À appeler après toute écriture du stock (admin) : la prochaine lecture publique recalcule. */
export async function invalidatePublicStock() {
  const store = await kv();
  if (!store) return;
  try {
    await store.delete(CACHE_KEY);
  } catch (error) {
    console.warn("[stock] invalidation du cache impossible", error);
  }
}
