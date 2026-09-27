import { and, desc, eq } from "drizzle-orm";
import { Bot } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { getDb } from "@/db";
import { agentRegistrations, oauthClient, oauthConsent } from "@/db/schema";
import { getServerSession } from "@/lib/session";
import { ScopeList } from "@/components/agent-scope-list";
import { POST_CLAIM_SCOPES } from "@/lib/agent/oauth";
import { card } from "../_ui";
import { RevokeButton } from "./revoke-button";

export const dynamic = "force-dynamic";

function hostOf(urls: string[] | null): string | null {
  for (const url of urls ?? []) {
    try {
      return new URL(url).host;
    } catch {
      /* URI de redirection non HTTP (application native) : ignorée */
    }
  }
  return null;
}

// Agents IA et applications autorisés à lire le compte : consentements OAuth
// (clients MCP, assistants) et agents auth.md revendiqués. Transparence et
// retrait à tout moment (nLPD).
export default async function AgentsTab() {
  const t = await getTranslations("agentAccess.account");
  const format = await getFormatter();
  const session = await getServerSession();
  const { user } = session!;
  const db = await getDb();

  const [apps, agents] = await Promise.all([
    db
      .select({
        clientId: oauthConsent.clientId,
        scopes: oauthConsent.scopes,
        updatedAt: oauthConsent.updatedAt,
        name: oauthClient.name,
        redirectUris: oauthClient.redirectUris,
      })
      .from(oauthConsent)
      .innerJoin(oauthClient, eq(oauthClient.clientId, oauthConsent.clientId))
      .where(eq(oauthConsent.userId, user.id))
      .orderBy(desc(oauthConsent.updatedAt)),
    db
      .select({
        id: agentRegistrations.id,
        type: agentRegistrations.type,
        claimedAt: agentRegistrations.claimedAt,
      })
      .from(agentRegistrations)
      .where(
        and(
          eq(agentRegistrations.userId, user.id),
          eq(agentRegistrations.status, "claimed"),
        ),
      )
      .orderBy(desc(agentRegistrations.claimedAt)),
  ]);

  const date = (d: Date | null) =>
    d ? format.dateTime(d, { dateStyle: "medium" }) : "";

  return (
    <div>
      <h1 className="flex items-center gap-2 text-xl font-bold">
        <Bot size={19} className="text-soft" />
        {t("title")}
      </h1>
      <p className="mt-1 mb-6 text-sm text-soft">{t("subtitle")}</p>

      {apps.length === 0 && agents.length === 0 ? (
        <p className={`${card} text-sm text-soft`}>{t("empty")}</p>
      ) : (
        <div className="space-y-4">
          {apps.map((app) => {
            const host = hostOf(app.redirectUris);
            return (
              <div key={app.clientId} className={card}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">
                      {app.name?.trim() || host || t("unnamedApp")}
                    </p>
                    <p className="mt-0.5 text-xs text-soft">
                      {host ? `${host} · ` : ""}
                      {t("authorizedOn", { date: date(app.updatedAt) })}
                    </p>
                  </div>
                  <RevokeButton kind="app" id={app.clientId} />
                </div>
                <ScopeList scopes={app.scopes} className="mt-4" />
              </div>
            );
          })}
          {agents.map((agent) => (
            <div key={agent.id} className={card}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-semibold">{t("authMdAgent")}</p>
                  <p className="mt-0.5 text-xs text-soft">
                    {t("authorizedOn", { date: date(agent.claimedAt) })}
                  </p>
                </div>
                <RevokeButton kind="agent" id={agent.id} />
              </div>
              <ScopeList scopes={POST_CLAIM_SCOPES} className="mt-4" />
            </div>
          ))}
        </div>
      )}
      <p className={`${card} mt-4 text-xs text-soft`}>{t("note")}</p>
    </div>
  );
}
