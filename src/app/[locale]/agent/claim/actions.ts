"use server";

import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { agentRegistrations } from "@/db/schema";
import { getServerSession } from "@/lib/session";
import {
  MAX_CODE_FAILURES,
  checkClaimAttempt,
  sameHash,
  sha256Hex,
  type ClaimCheck,
} from "@/lib/agent/agent-auth-core";
import { findClaimAttempt } from "@/lib/agent/claim-attempt";

export interface ClaimState {
  status?: "confirmed" | "denied";
  error?: Exclude<ClaimCheck, "ok"> | "wrong_code" | "unauthorized";
  remaining?: number;
}

async function loadAttempt(token: string) {
  return { db: await getDb(), reg: await findClaimAttempt(token) };
}

// Revendication d'un agent auth.md : le client connecté recopie le code que
// son agent lui a donné. Garde-fous côté serveur : bon compte (e-mail lié à
// l'enregistrement), tentative non expirée, 5 essais au plus, bascule atomique.
export async function confirmAgentClaim(
  _prev: ClaimState,
  formData: FormData,
): Promise<ClaimState> {
  const session = await getServerSession();
  if (!session) return { error: "unauthorized" };
  const token = String(formData.get("token") ?? "");
  const code = String(formData.get("code") ?? "").replace(/\D/g, "");
  const { db, reg } = await loadAttempt(token);
  const now = new Date();
  const check = checkClaimAttempt(reg, session.user.email, now);
  if (check !== "ok" || !reg)
    return { error: check === "ok" ? "invalid" : check };

  const expected = reg.userCodeHash ?? "";
  const given = code.length === 6 ? await sha256Hex(`${reg.id}:${code}`) : "";
  if (!given || !sameHash(given, expected)) {
    const [row] = await db
      .update(agentRegistrations)
      .set({
        attemptFailures: sql`${agentRegistrations.attemptFailures} + 1`,
        updatedAt: now,
      })
      .where(eq(agentRegistrations.id, reg.id))
      .returning({ failures: agentRegistrations.attemptFailures });
    const remaining = Math.max(0, MAX_CODE_FAILURES - (row?.failures ?? 0));
    return remaining > 0
      ? { error: "wrong_code", remaining }
      : { error: "locked" };
  }

  // Version +1 : l'assertion anonyme d'avant la revendication et ses jetons
  // d'accès cessent d'être acceptés (profil auth.md, étape 4c).
  const [claimed] = await db
    .update(agentRegistrations)
    .set({
      status: "claimed",
      userId: session.user.id,
      claimedAt: now,
      assertionVersion: sql`${agentRegistrations.assertionVersion} + 1`,
      attemptTokenHash: null,
      userCodeHash: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(agentRegistrations.id, reg.id),
        eq(agentRegistrations.status, "unclaimed"),
        eq(agentRegistrations.attemptTokenHash, reg.attemptTokenHash!),
      ),
    )
    .returning({ id: agentRegistrations.id });
  return claimed ? { status: "confirmed" } : { error: "invalid" };
}

// Refus explicite : l'agent reçoit access_denied à son prochain sondage et
// l'enregistrement ne peut plus être revendiqué.
export async function denyAgentClaim(
  _prev: ClaimState,
  formData: FormData,
): Promise<ClaimState> {
  const session = await getServerSession();
  if (!session) return { error: "unauthorized" };
  const { db, reg } = await loadAttempt(String(formData.get("token") ?? ""));
  const check = checkClaimAttempt(reg, session.user.email, new Date());
  if ((check !== "ok" && check !== "locked") || !reg)
    return { error: check === "ok" || check === "locked" ? "invalid" : check };
  const now = new Date();
  await db
    .update(agentRegistrations)
    .set({
      status: "revoked",
      deniedAt: now,
      revokedAt: now,
      attemptTokenHash: null,
      userCodeHash: null,
      assertionVersion: sql`${agentRegistrations.assertionVersion} + 1`,
      updatedAt: now,
    })
    .where(
      and(
        eq(agentRegistrations.id, reg.id),
        eq(agentRegistrations.status, "unclaimed"),
      ),
    );
  return { status: "denied" };
}
