"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { oauthAccessToken, oauthConsent, oauthRefreshToken } from "@/db/schema";
import { revokeAgentRegistration } from "@/lib/agent/agent-auth";
import { getServerSession } from "@/lib/session";

export interface RevokeState {
  success?: boolean;
  error?: string;
}

// Retrait d'accès par le client. Application OAuth : consentement supprimé et
// jetons de rafraîchissement révoqués — le serveur MCP compte exige le
// consentement à chaque appel, donc même un jeton d'accès encore valide est
// refusé aussitôt. Agent auth.md : enregistrement révoqué (version +1).
export async function revokeAccess(
  _prev: RevokeState,
  formData: FormData,
): Promise<RevokeState> {
  const session = await getServerSession();
  if (!session) return { error: "unauthorized" };
  const userId = session.user.id;
  const kind = String(formData.get("kind") ?? "");
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "invalid" };

  if (kind === "agent") {
    if (!(await revokeAgentRegistration(id, userId)))
      return { error: "not_found" };
  } else if (kind === "app") {
    const db = await getDb();
    const now = new Date();
    await db
      .delete(oauthConsent)
      .where(
        and(eq(oauthConsent.userId, userId), eq(oauthConsent.clientId, id)),
      );
    await db
      .update(oauthRefreshToken)
      .set({ revoked: now })
      .where(
        and(
          eq(oauthRefreshToken.userId, userId),
          eq(oauthRefreshToken.clientId, id),
          isNull(oauthRefreshToken.revoked),
        ),
      );
    await db
      .delete(oauthAccessToken)
      .where(
        and(
          eq(oauthAccessToken.userId, userId),
          eq(oauthAccessToken.clientId, id),
        ),
      );
  } else {
    return { error: "invalid" };
  }
  revalidatePath("/account/agents");
  return { success: true };
}
