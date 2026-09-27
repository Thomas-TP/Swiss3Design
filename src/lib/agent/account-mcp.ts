import { and, eq } from "drizzle-orm";
import { verifyJwsAccessToken } from "better-auth/oauth2";
import type { JSONWebKeySet } from "jose";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/db";
import { agentRegistrations, oauthConsent } from "@/db/schema";
import { getAuth } from "@/lib/auth";
import {
  accountToolDefinitions,
  accountToolScope,
  isAccountToolName,
  runAccountTool,
} from "./account-tools";
import { PUBLIC_CORS } from "./config";
import { RPC_ERRORS, RpcError } from "./jsonrpc";
import { MCP_PROTOCOL_VERSIONS, MCP_SERVER_INFO } from "./mcp";
import { bearerChallenge, oauthIssuer, protectedResources } from "./oauth";
import {
  ToolError,
  isToolName,
  runTool,
  toolDefinitions,
  type ToolContext,
} from "./tools";

// Serveur MCP « compte client » (/mcp/account) : ressource protégée OAuth 2.1
// (spec d'autorisation MCP 2025-06-18+). Sans jeton valide → 401 avec
// WWW-Authenticate: Bearer resource_metadata=… — c'est ce défi qui fait
// découvrir au client MCP le serveur d'autorisation, l'enregistrement dynamique
// et le consentement. Jetons acceptés : JWT at+jwt signés par notre émetteur,
// audience = l'une des ressources protégées (clients MCP : RFC 8707 resource
// obligatoire, donc toujours un JWT).

export interface AccountPrincipal {
  issuer: string;
  userId: string | null;
  clientId: string;
  scopes: ReadonlySet<string>;
}

// Clé stable du cache JWKS de better-auth (5 min, rechargé si kid inconnu).
const JWKS_CACHE_KEY = {};

const challengeHeaders = (challenge: string) => ({
  "WWW-Authenticate": challenge,
  "Access-Control-Expose-Headers": "WWW-Authenticate",
  ...PUBLIC_CORS,
});

export function unauthorized(
  issuer: string,
  error?: Parameters<typeof bearerChallenge>[1],
  status = 401,
): Response {
  return new Response(
    JSON.stringify(
      error
        ? { error: error.code, error_description: error.description }
        : {
            error: "unauthorized",
            error_description:
              "Bearer token required: see the WWW-Authenticate header and https://swiss3design.ch/auth.md",
          },
    ),
    {
      status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        ...challengeHeaders(bearerChallenge(issuer, error)),
      },
    },
  );
}

export async function authenticateAccountRequest(
  request: Request,
): Promise<
  { ok: true; principal: AccountPrincipal } | { ok: false; response: Response }
> {
  const { env } = await getCloudflareContext({ async: true });
  const issuer = oauthIssuer(env.BETTER_AUTH_URL);
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  if (!match) return { ok: false, response: unauthorized(issuer) };

  let payload: Awaited<ReturnType<typeof verifyJwsAccessToken>>;
  try {
    const auth = await getAuth();
    payload = await verifyJwsAccessToken(match[1], {
      jwksFetch: async () => (await auth.api.getJwks()) as JSONWebKeySet,
      jwksCacheKey: JWKS_CACHE_KEY,
      verifyOptions: {
        issuer,
        audience: protectedResources(issuer),
        typ: "at+jwt",
      },
    });
  } catch {
    return {
      ok: false,
      response: unauthorized(issuer, {
        code: "invalid_token",
        description:
          "The access token is invalid, expired or not issued for this resource.",
      }),
    };
  }

  const clientId = String(payload.client_id ?? payload.azp ?? "");
  const sub = typeof payload.sub === "string" ? payload.sub : "";
  const userId = sub && sub !== clientId ? sub : null;
  const db = await getDb();

  // Révocation immédiate, malgré des jetons sans état : un agent auth.md
  // porte son enregistrement et sa version (révoqué ou revendiqué depuis →
  // refusé) ; une application doit toujours avoir le consentement du client.
  let active: boolean;
  if (typeof payload.reg === "string") {
    const [reg] = await db
      .select({
        status: agentRegistrations.status,
        version: agentRegistrations.assertionVersion,
        userId: agentRegistrations.userId,
        claimExpiresAt: agentRegistrations.claimExpiresAt,
      })
      .from(agentRegistrations)
      .where(eq(agentRegistrations.id, payload.reg))
      .limit(1);
    active =
      !!reg &&
      reg.version === payload.ver &&
      (reg.status === "claimed"
        ? reg.userId === userId
        : reg.status === "unclaimed" &&
          !userId &&
          reg.claimExpiresAt > new Date());
  } else if (userId) {
    const [consent] = await db
      .select({ id: oauthConsent.id })
      .from(oauthConsent)
      .where(
        and(
          eq(oauthConsent.userId, userId),
          eq(oauthConsent.clientId, clientId),
        ),
      )
      .limit(1);
    active = !!consent;
  } else {
    active = false;
  }
  if (!active)
    return {
      ok: false,
      response: unauthorized(issuer, {
        code: "invalid_token",
        description: "Access to this account was revoked by its owner.",
      }),
    };

  return {
    ok: true,
    principal: {
      issuer,
      userId,
      clientId,
      scopes: new Set(
        String(payload.scope ?? "")
          .split(" ")
          .filter(Boolean),
      ),
    },
  };
}

// Outils compte : réservés aux jetons liés à un client (et à la portée).
const accountScopesOf = (principal: AccountPrincipal): ReadonlySet<string> =>
  principal.userId ? principal.scopes : new Set();

// Portée manquante pour un tools/call du corps JSON-RPC (objet ou lot) : la
// route répond alors 403 insufficient_scope (RFC 6750 § 3.1) avant tout
// traitement, et le client MCP redemande l'autorisation avec cette portée.
export function missingScope(
  body: unknown,
  principal: AccountPrincipal,
): string | null {
  const granted = accountScopesOf(principal);
  for (const message of Array.isArray(body) ? body : [body]) {
    const m = message as { method?: unknown; params?: { name?: unknown } };
    if (m?.method !== "tools/call" || !isAccountToolName(m.params?.name))
      continue;
    const scope = accountToolScope(m.params.name);
    if (!granted.has(scope)) return scope;
  }
  return null;
}

export const ACCOUNT_MCP_INSTRUCTIONS =
  "Swiss3Design customer-account tools, acting for the signed-in customer who authorized you: list_my_orders and get_my_order (status, items, totals, Swiss Post tracking), list_my_quotes (custom 3D print quotes), get_my_profile. The public catalogue tools (search_products, get_product, get_store_info, build_cart_link…) are also available. Never ask the customer for their password: access is granted through OAuth.";

function negotiate(requested: unknown): string {
  return typeof requested === "string" &&
    (MCP_PROTOCOL_VERSIONS as readonly string[]).includes(requested)
    ? requested
    : MCP_PROTOCOL_VERSIONS[0];
}

const toolResult = (data: unknown) => ({
  content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  structuredContent: data,
  isError: false,
});

export function accountMcpDispatcher(
  principal: AccountPrincipal,
  ctx: ToolContext,
) {
  const accountScopes = accountScopesOf(principal);
  return async (method: string, params: unknown): Promise<unknown> => {
    const p = (params ?? {}) as Record<string, unknown>;
    switch (method) {
      case "initialize":
        return {
          protocolVersion: negotiate(p.protocolVersion),
          capabilities: { tools: { listChanged: false } },
          serverInfo: {
            ...MCP_SERVER_INFO,
            name: "swiss3design-account",
            title: "Swiss3Design customer account",
          },
          instructions: ACCOUNT_MCP_INSTRUCTIONS,
        };
      case "notifications/initialized":
      case "notifications/cancelled":
      case "ping":
        return {};
      case "tools/list":
        return {
          tools: [
            ...accountToolDefinitions(accountScopes),
            ...toolDefinitions(),
          ],
        };
      case "tools/call": {
        const name = p.name;
        try {
          if (isAccountToolName(name)) {
            // Filet : la route a déjà répondu 403 (missingScope).
            const scope = accountToolScope(name);
            if (!accountScopes.has(scope))
              throw new RpcError(
                RPC_ERRORS.invalidParams,
                `This tool requires the ${scope} scope.`,
              );
            return toolResult(
              await runAccountTool(name, p.arguments, {
                userId: principal.userId!,
                scopes: accountScopes,
                origin: principal.issuer,
              }),
            );
          }
          if (isToolName(name))
            return toolResult(await runTool(name, p.arguments, ctx));
        } catch (error) {
          if (error instanceof ToolError)
            return {
              content: [
                { type: "text", text: `${error.code}: ${error.message}` },
              ],
              isError: true,
            };
          throw error;
        }
        throw new RpcError(
          RPC_ERRORS.invalidParams,
          `Unknown tool: ${String(name)}`,
        );
      }
      default:
        throw new RpcError(
          RPC_ERRORS.methodNotFound,
          `Method not found: ${method}`,
        );
    }
  };
}
