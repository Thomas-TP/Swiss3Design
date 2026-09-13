import { getDb } from "@/db";
import { requestLimits } from "@/db/schema";
import { lt, sql } from "drizzle-orm";
// Compteur atomique Postgres ; aucune course get/put KV ni écriture limitée à 1/s.
export async function rateLimit(
  request: Request,
  route: string,
  { limit, windowS }: { limit: number; windowS: number },
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
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(ip),
    );
    const hash = Array.from(new Uint8Array(digest), (v) =>
      v.toString(16).padStart(2, "0"),
    ).join("");
    const window = Math.floor(Date.now() / (windowS * 1000));
    const db = await getDb();
    const rows = await db
      .insert(requestLimits)
      .values({
        key: route + ":" + hash + ":" + window,
        count: 1,
        expiresAt: new Date((window + 1) * windowS * 1000),
      })
      .onConflictDoUpdate({
        target: requestLimits.key,
        set: { count: sql`${requestLimits.count}+1` },
        setWhere: lt(requestLimits.count, limit),
      })
      .returning({ key: requestLimits.key });
    return rows.length > 0;
  } catch {
    console.error("[rate-limit] indisponible", { route });
    return false;
  }
}
export const tooManyRequests = (headers?: HeadersInit) =>
  Response.json({ error: "too_many_requests" }, { status: 429, headers });
