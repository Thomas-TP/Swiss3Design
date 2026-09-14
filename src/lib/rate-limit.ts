import { getDb } from "@/db";
import { requestLimits } from "@/db/schema";
import { lt, sql } from "drizzle-orm";

type Database = Awaited<ReturnType<typeof getDb>>;

type LimitOptions = { limit: number; windowS: number };

export interface LimitDecision {
  allowed: boolean;
  retryAfter: number | null;
}

async function hashSubject(subject: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(subject),
  );
  return Array.from(new Uint8Array(digest), (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");
}

// Compteur Postgres atomique partagé entre tous les isolates Cloudflare. Le
// sujet (IP ou clé Better Auth IP+route) est haché avant stockage.
export async function consumeRequestLimit(
  db: Database,
  namespace: string,
  subject: string,
  { limit, windowS }: LimitOptions,
): Promise<LimitDecision> {
  const now = Date.now();
  const window = Math.floor(now / (windowS * 1000));
  const expiresAt = new Date((window + 1) * windowS * 1000);
  const hash = await hashSubject(subject);
  const rows = await db
    .insert(requestLimits)
    .values({
      key: namespace + ":" + hash + ":" + window,
      count: 1,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: requestLimits.key,
      set: { count: sql`${requestLimits.count}+1` },
      setWhere: lt(requestLimits.count, limit),
    })
    .returning({ key: requestLimits.key });
  if (rows.length > 0) return { allowed: true, retryAfter: null };
  return {
    allowed: false,
    retryAfter: Math.max(1, Math.ceil((expiresAt.getTime() - now) / 1000)),
  };
}

export async function rateLimit(
  request: Request,
  route: string,
  options: LimitOptions,
): Promise<boolean> {
  const ip = request.headers.get("cf-connecting-ip");
  if (!ip)
    return (
      process.env.NODE_ENV !== "production" ||
      ["localhost", "127.0.0.1", "[::1]"].includes(
        new URL(request.url).hostname,
      )
    );
  try {
    const db = await getDb();
    return (await consumeRequestLimit(db, route, ip, options)).allowed;
  } catch {
    console.error("[rate-limit] indisponible", { route });
    return false;
  }
}

export const tooManyRequests = (headers?: HeadersInit) =>
  Response.json({ error: "too_many_requests" }, { status: 429, headers });
