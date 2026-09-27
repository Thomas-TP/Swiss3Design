import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { uncached } from "@/db/fresh";
import { agentRegistrations } from "@/db/schema";
import { sha256Hex } from "./agent-auth-core";

// Tentative de revendication désignée par le jeton du lien de vérification
// (page /[locale]/agent/claim et ses actions). Lue hors cache Hyperdrive : un
// code saisi, un refus ou une nouvelle tentative doivent se voir aussitôt.
// Module serveur ordinaire, pas une Server Action : il renvoie la ligne entière.
export async function findClaimAttempt(token: string) {
  if (!token) return null;
  const db = await getDb();
  const [reg] = await db
    .select()
    .from(agentRegistrations)
    .where(
      and(
        eq(agentRegistrations.attemptTokenHash, await sha256Hex(token)),
        uncached,
      ),
    )
    .limit(1);
  return reg ?? null;
}
