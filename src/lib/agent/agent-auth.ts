import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint } from "better-auth/api";
import { signJWT, verifyJWT, type JwtOptions } from "better-auth/plugins";
import type {
  OAuthExtensionGrantHandlerInput,
  OAuthProviderExtension,
} from "@better-auth/oauth-provider";
import { and, eq, isNull, sql, type SQL } from "drizzle-orm";
import { decodeProtectedHeader } from "jose";
import { z } from "zod";
import { getDb } from "@/db";
import { uncached } from "@/db/fresh";
import { agentRegistrations, oauthResource } from "@/db/schema";
import {
  ATTEMPT_TTL_S,
  CLAIM_GRANT,
  CLAIM_WINDOW_S,
  IDENTITY_ASSERTION_TYP,
  IDENTITY_TOKEN_USE,
  JWT_BEARER_GRANT,
  POLL_INTERVAL_S,
  POST_CLAIM_ASSERTION_TTL_S,
  decidePoll,
  isEmail,
  normalizeEmail,
  randomToken,
  randomUserCode,
  sha256Hex,
  type RegistrationType,
} from "./agent-auth-core";
import {
  POST_CLAIM_SCOPES,
  PRE_CLAIM_SCOPES,
  accountResource,
  protectedResources,
} from "./oauth";
import { PATHS } from "./paths";

// Profil auth.md (WorkOS v0.6, https://github.com/workos/auth.md) branché sur
// le serveur OAuth better-auth : aucune cryptographie maison. Les assertions
// d'identité sont signées par le plugin jwt (mêmes clés que les jetons
// d'accès, publiées au JWKS) et les jetons d'accès sont émis par
// oauth-provider (issueTokens), exactement comme pour une application.
//
//   POST /api/auth/agent/identity        enregistrement (anonymous | service_auth)
//   POST /api/auth/agent/identity/claim  nouvelle tentative de revendication
//   POST /api/auth/oauth2/token          grants jwt-bearer (RFC 7523) et claim
//   /[locale]/agent/claim                page où le client saisit le code

type AgentRegistration = typeof agentRegistrations.$inferSelect;

interface AgentAuthOptions {
  issuer: string;
  jwtOptions: JwtOptions;
}

// Ressources protégées (oauth.ts) déclarées en base pour oauth-provider, qui
// refuse tout `resource` inconnu (invalid_target). Écriture idempotente
// (ON CONFLICT DO NOTHING) plutôt que le « lire puis insérer » du plugin :
// derrière le cache de Hyperdrive, sa lecture pouvait dater d'avant
// l'insertion et le doublon faisait échouer la requête. Une fois par isolate.
const seededIssuers = new Set<string>();

export async function ensureProtectedResources(issuer: string) {
  if (seededIssuers.has(issuer)) return;
  const db = await getDb();
  const now = new Date();
  await db
    .insert(oauthResource)
    .values(
      protectedResources(issuer).map((identifier) => ({
        id: crypto.randomUUID(),
        identifier,
        name: "Swiss3Design customer account (MCP)",
        disabled: false,
        dpopBoundAccessTokensRequired: false,
        policyVersion: 1,
        createdAt: now,
        updatedAt: now,
      })),
    )
    .onConflictDoNothing({ target: oauthResource.identifier });
  seededIssuers.add(issuer);
}

const agentError = (
  status: "BAD_REQUEST" | "UNAUTHORIZED" | "CONFLICT" | "GONE",
  error: string,
  description: string,
) => new APIError(status, { error, error_description: description });

// Erreurs du point de terminaison /oauth2/token : enveloppe RFC 6749 § 5.2.
const tokenError = (error: string, description: string) =>
  new APIError("BAD_REQUEST", { error, error_description: description });

const iso = (date: Date) => date.toISOString();
const tokenEndpoint = (baseURL: string) => `${baseURL}/oauth2/token`;
const claimEndpoint = (baseURL: string) => `${baseURL}/agent/identity/claim`;
const verificationUri = (issuer: string, attemptToken: string) =>
  `${issuer}${PATHS.agentClaim}?claim_attempt_token=${encodeURIComponent(attemptToken)}`;

async function newAttempt(registrationId: string) {
  const attemptToken = randomToken("cla_");
  const userCode = randomUserCode();
  return {
    attemptToken,
    userCode,
    // Le jeton de tentative voyage dans l'URL de vérification ; le code, lui,
    // n'est jamais affiché par le service : le client le recopie depuis son
    // agent. Haché avec l'id pour qu'un code identique ne donne pas la même
    // empreinte d'un enregistrement à l'autre.
    attemptTokenHash: await sha256Hex(attemptToken),
    userCodeHash: await sha256Hex(`${registrationId}:${userCode}`),
    attemptExpiresAt: new Date(Date.now() + ATTEMPT_TTL_S * 1000),
  };
}

// Identifiant public d'une tentative (dérivé, non secret) pour les réponses.
const attemptId = (attemptTokenHash: string) =>
  `cla_${attemptTokenHash.slice(0, 16)}`;

function ceremony(issuer: string, attemptToken: string, userCode: string) {
  return {
    user_code: userCode,
    expires_in: ATTEMPT_TTL_S,
    verification_uri: verificationUri(issuer, attemptToken),
    interval: POLL_INTERVAL_S,
  };
}

// Assertion d'identité signée par le service (échangeable au grant
// jwt-bearer). aud = point de terminaison de jeton : elle ne peut être
// présentée nulle part ailleurs, et un jeton d'accès (aud = ressource) ne
// peut pas se faire passer pour elle.
async function signIdentityAssertion(
  ctx: Parameters<typeof signJWT>[0],
  options: AgentAuthOptions,
  reg: AgentRegistration,
  scopes: readonly string[],
  expiresAt: Date,
  user?: { email: string; emailVerified: boolean },
) {
  const iat = Math.floor(Date.now() / 1000);
  return signJWT(ctx, {
    options: options.jwtOptions,
    header: { typ: IDENTITY_ASSERTION_TYP },
    payload: {
      iss: options.issuer,
      aud: tokenEndpoint(ctx.context.baseURL),
      sub: reg.id,
      jti: randomToken("", 16),
      iat,
      exp: Math.floor(expiresAt.getTime() / 1000),
      token_use: IDENTITY_TOKEN_USE,
      client_id: reg.clientId,
      registration_type: reg.type,
      scope: scopes.join(" "),
      ver: reg.assertionVersion,
      ...(user && { email: user.email, email_verified: user.emailVerified }),
    },
  });
}

const identityBody = z.record(z.string(), z.unknown());

export function agentAuthPlugin(options: AgentAuthOptions) {
  return {
    id: "agent-auth",
    endpoints: {
      // Étape 3 d'auth.md : enregistrement. Aucune session ni e-mail envoyé :
      // service_auth renvoie directement le code que l'agent montre au client.
      agentIdentity: createAuthEndpoint(
        "/agent/identity",
        { method: "POST", body: identityBody },
        async (ctx) => {
          const type = ctx.body.type;
          if (type === "identity_assertion")
            throw agentError(
              "BAD_REQUEST",
              "issuer_not_enabled",
              "This service trusts no ID-JAG issuer yet. Use service_auth (with the user's email) or anonymous.",
            );
          if (type !== "anonymous" && type !== "service_auth")
            throw agentError(
              "BAD_REQUEST",
              "invalid_request",
              'type must be "anonymous" or "service_auth".',
            );
          const loginHint = ctx.body.login_hint;
          if (type === "service_auth" && !isEmail(loginHint))
            throw agentError(
              "BAD_REQUEST",
              "invalid_login_hint",
              "login_hint must be the email address of the user's Swiss3Design account.",
            );

          const now = new Date();
          const registrationId = randomToken("reg_", 16);
          const clientId = randomToken("agt_", 18);
          const claimToken = randomToken("clm_");
          const claimExpiresAt = new Date(
            now.getTime() + CLAIM_WINDOW_S * 1000,
          );
          // Client OAuth public propre à l'enregistrement : les jetons d'accès
          // portent son client_id, la révocation de l'un coupe l'autre.
          await ctx.context.adapter.create({
            model: "oauthClient",
            data: {
              clientId,
              disabled: false,
              name:
                type === "anonymous"
                  ? "auth.md agent (anonymous)"
                  : "auth.md agent",
              scopes: [...POST_CLAIM_SCOPES],
              redirectUris: [],
              grantTypes: [JWT_BEARER_GRANT, CLAIM_GRANT],
              responseTypes: [],
              tokenEndpointAuthMethod: "none",
              createdAt: now,
              updatedAt: now,
            },
          });
          const attempt =
            type === "service_auth" ? await newAttempt(registrationId) : null;
          const db = await getDb();
          const [reg] = await db
            .insert(agentRegistrations)
            .values({
              id: registrationId,
              type: type as RegistrationType,
              clientId,
              claimTokenHash: await sha256Hex(claimToken),
              claimEmail:
                type === "service_auth"
                  ? normalizeEmail(loginHint as string)
                  : null,
              claimExpiresAt,
              ...(attempt && {
                attemptTokenHash: attempt.attemptTokenHash,
                userCodeHash: attempt.userCodeHash,
                attemptExpiresAt: attempt.attemptExpiresAt,
              }),
            })
            .returning();

          ctx.setHeader("Cache-Control", "no-store");
          const base = {
            registration_id: reg.id,
            registration_type: reg.type,
            claim_url: claimEndpoint(ctx.context.baseURL),
            claim_token: claimToken,
            claim_token_expires: iso(claimExpiresAt),
            post_claim_scopes: [...POST_CLAIM_SCOPES],
          };
          if (attempt)
            return ctx.json({
              ...base,
              claim: ceremony(
                options.issuer,
                attempt.attemptToken,
                attempt.userCode,
              ),
            });
          return ctx.json({
            ...base,
            identity_assertion: await signIdentityAssertion(
              ctx,
              options,
              reg,
              PRE_CLAIM_SCOPES,
              claimExpiresAt,
            ),
            assertion_expires: iso(claimExpiresAt),
            pre_claim_scopes: [...PRE_CLAIM_SCOPES],
          });
        },
      ),

      // Étape 4a : (re)lance une cérémonie. Pour un enregistrement anonyme,
      // l'e-mail lie la revendication au seul compte qui pourra la terminer.
      agentIdentityClaim: createAuthEndpoint(
        "/agent/identity/claim",
        { method: "POST", body: identityBody },
        async (ctx) => {
          const claimToken = ctx.body.claim_token;
          const email = ctx.body.email;
          if (typeof claimToken !== "string" || !claimToken)
            throw agentError(
              "UNAUTHORIZED",
              "invalid_claim_token",
              "claim_token is required.",
            );
          if (!isEmail(email))
            throw agentError(
              "BAD_REQUEST",
              "invalid_request",
              "email must be the email address of the user who will claim this agent.",
            );
          const db = await getDb();
          const reg = await findRegistration(
            eq(agentRegistrations.claimTokenHash, await sha256Hex(claimToken)),
          );
          if (!reg)
            throw agentError(
              "UNAUTHORIZED",
              "invalid_claim_token",
              "Unknown claim_token. Restart at registration.",
            );
          if (reg.status === "claimed")
            throw agentError(
              "CONFLICT",
              "claimed_or_in_flight",
              "This registration is already claimed.",
            );
          if (
            reg.status === "revoked" ||
            reg.deniedAt ||
            reg.claimExpiresAt <= new Date()
          )
            throw agentError(
              "GONE",
              "claim_expired",
              "This registration expired or was declined. Restart at registration.",
            );
          const claimEmail = normalizeEmail(email);
          if (reg.claimEmail && reg.claimEmail !== claimEmail)
            throw agentError(
              "BAD_REQUEST",
              "invalid_request",
              "email does not match the email bound to this registration.",
            );
          const attempt = await newAttempt(reg.id);
          await db
            .update(agentRegistrations)
            .set({
              claimEmail,
              attemptTokenHash: attempt.attemptTokenHash,
              userCodeHash: attempt.userCodeHash,
              attemptExpiresAt: attempt.attemptExpiresAt,
              attemptFailures: 0,
              lastPolledAt: null,
              updatedAt: new Date(),
            })
            .where(eq(agentRegistrations.id, reg.id));
          ctx.setHeader("Cache-Control", "no-store");
          return ctx.json({
            registration_id: reg.id,
            claim_attempt_id: attemptId(attempt.attemptTokenHash),
            status: "initiated",
            expires_at: iso(attempt.attemptExpiresAt),
            claim_attempt: ceremony(
              options.issuer,
              attempt.attemptToken,
              attempt.userCode,
            ),
          });
        },
      ),
    },
    // Limites par IP (stockage Postgres de better-auth) : un enregistrement
    // crée un client OAuth, on ne laisse pas un script en créer en masse.
    rateLimit: [
      {
        pathMatcher: (path: string) => path === "/agent/identity",
        window: 3600,
        max: 20,
      },
      {
        pathMatcher: (path: string) => path === "/agent/identity/claim",
        window: 600,
        max: 20,
      },
    ],
  } satisfies BetterAuthPlugin;
}

// Toujours lu hors cache Hyperdrive (db/fresh.ts) : revendication, révocation
// et sondage doivent voir la dernière écriture, pas un état vieux d'une minute.
async function findRegistration(where: SQL) {
  const db = await getDb();
  const [reg] = await db
    .select()
    .from(agentRegistrations)
    .where(and(where, uncached))
    .limit(1);
  return reg ?? null;
}

function requestedResources(body: Record<string, unknown>, issuer: string) {
  const raw = body.resource;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  // Sans resource explicite : le serveur MCP compte (jeton JWT avec aud).
  return list.length > 0 ? list.map(String) : [accountResource(issuer)];
}

function requestedScopes(
  body: Record<string, unknown>,
  granted: readonly string[],
) {
  const raw = typeof body.scope === "string" ? body.scope.trim() : "";
  if (!raw) return [...granted];
  const scopes = raw.split(/\s+/);
  for (const scope of scopes)
    if (!granted.includes(scope))
      throw tokenError(
        "invalid_scope",
        `scope ${scope} is not available to this registration`,
      );
  return scopes;
}

// Grants auth.md, exécutés par le point de terminaison /oauth2/token de
// better-auth (extension officielle d'oauth-provider).
export function agentAuthExtension(options: AgentAuthOptions) {
  return {
    grants: {
      // Étape 5 : assertion d'identité → jeton d'accès.
      [JWT_BEARER_GRANT]: async ({
        ctx,
        provider,
      }: OAuthExtensionGrantHandlerInput) => {
        const body = (ctx.body ?? {}) as Record<string, unknown>;
        const assertion = body.assertion;
        if (typeof assertion !== "string" || !assertion)
          throw tokenError("invalid_request", "assertion is required");
        let typ: unknown;
        try {
          typ = decodeProtectedHeader(assertion).typ;
        } catch {
          throw tokenError("invalid_grant", "malformed assertion");
        }
        const payload =
          typ === IDENTITY_ASSERTION_TYP
            ? await verifyJWT(assertion, {
                ...options.jwtOptions,
                jwt: {
                  ...options.jwtOptions.jwt,
                  issuer: options.issuer,
                  audience: tokenEndpoint(ctx.context.baseURL),
                },
              })
            : null;
        if (
          !payload ||
          payload.token_use !== IDENTITY_TOKEN_USE ||
          typeof payload.ver !== "number" ||
          typeof payload.client_id !== "string"
        )
          throw tokenError(
            "invalid_grant",
            "invalid, expired or foreign identity assertion",
          );
        const reg = await findRegistration(
          eq(agentRegistrations.id, payload.sub),
        );
        const now = new Date();
        const claimed = reg?.status === "claimed" && !!reg.userId;
        if (
          !reg ||
          reg.clientId !== payload.client_id ||
          reg.assertionVersion !== payload.ver ||
          reg.status === "revoked" ||
          (!claimed && reg.claimExpiresAt <= now)
        )
          throw tokenError(
            "invalid_grant",
            "identity assertion revoked or superseded; restart at registration",
          );
        const client = await provider.getClient(reg.clientId);
        if (!client || client.disabled)
          throw tokenError("invalid_client", "client disabled");
        const user = claimed
          ? await ctx.context.internalAdapter.findUserById(reg.userId!)
          : null;
        if (claimed && !user)
          throw tokenError("invalid_grant", "account no longer exists");
        return provider.issueTokens({
          client,
          scopes: requestedScopes(
            body,
            claimed ? POST_CLAIM_SCOPES : PRE_CLAIM_SCOPES,
          ),
          user: user ?? undefined,
          resources: requestedResources(body, options.issuer),
          accessTokenClaims: { reg: reg.id, ver: reg.assertionVersion },
        });
      },

      // Étape 4c : sondage de la cérémonie avec le claim_token.
      [CLAIM_GRANT]: async ({
        ctx,
        provider,
      }: OAuthExtensionGrantHandlerInput) => {
        const body = (ctx.body ?? {}) as Record<string, unknown>;
        const claimToken = body.claim_token;
        if (typeof claimToken !== "string" || !claimToken)
          throw tokenError("invalid_request", "claim_token is required");
        const reg = await findRegistration(
          eq(agentRegistrations.claimTokenHash, await sha256Hex(claimToken)),
        );
        if (!reg) throw tokenError("invalid_grant", "unknown claim_token");
        const now = new Date();
        const decision = decidePoll(reg, now);
        const db = await getDb();
        if (decision.kind === "error") {
          await db
            .update(agentRegistrations)
            .set({ lastPolledAt: now })
            .where(eq(agentRegistrations.id, reg.id));
          throw tokenError(decision.error, decision.description);
        }
        // Remise unique du jeton post-revendication, même si deux sondages
        // arrivent en même temps.
        const [won] = await db
          .update(agentRegistrations)
          .set({ redeemedAt: now, lastPolledAt: now, updatedAt: now })
          .where(
            and(
              eq(agentRegistrations.id, reg.id),
              eq(agentRegistrations.status, "claimed"),
              isNull(agentRegistrations.redeemedAt),
            ),
          )
          .returning();
        if (!won?.userId)
          throw tokenError("invalid_grant", "claim already completed");
        const [client, user] = await Promise.all([
          provider.getClient(won.clientId),
          ctx.context.internalAdapter.findUserById(won.userId),
        ]);
        if (!client || client.disabled || !user)
          throw tokenError("invalid_grant", "registration no longer valid");
        const assertionExpires = new Date(
          now.getTime() + POST_CLAIM_ASSERTION_TTL_S * 1000,
        );
        const assertion = await signIdentityAssertion(
          ctx,
          options,
          won,
          POST_CLAIM_SCOPES,
          assertionExpires,
          user,
        );
        return provider.issueTokens({
          client,
          scopes: [...POST_CLAIM_SCOPES],
          user,
          resources: [accountResource(options.issuer)],
          accessTokenClaims: { reg: won.id, ver: won.assertionVersion },
          tokenResponse: {
            identity_assertion: assertion,
            assertion_expires: iso(assertionExpires),
          },
        });
      },
    },

    // Bloc agent_auth des métadonnées du serveur d'autorisation, avec les deux
    // générations de noms du profil : identity_endpoint/claim_endpoint (v0.2+)
    // et register_uri/claim_uri (v0.1, encore lus par les scanners).
    metadata: ({ ctx }) => {
      const baseURL = ctx.context.baseURL;
      const identity = `${baseURL}/agent/identity`;
      return {
        service_documentation: `${options.issuer}${PATHS.authMd}`,
        ui_locales_supported: ["fr", "de", "it", "en"],
        op_policy_uri: `${options.issuer}/fr/legal/privacy`,
        op_tos_uri: `${options.issuer}/fr/legal/terms`,
        protected_resources: protectedResources(options.issuer),
        agent_auth: {
          skill: `${options.issuer}${PATHS.authMd}`,
          identity_endpoint: identity,
          register_uri: identity,
          claim_endpoint: claimEndpoint(baseURL),
          claim_uri: claimEndpoint(baseURL),
          identity_types_supported: ["anonymous", "service_auth"],
          anonymous: {
            credential_types_supported: ["access_token"],
            pre_claim_scopes: [...PRE_CLAIM_SCOPES],
            post_claim_scopes: [...POST_CLAIM_SCOPES],
          },
          service_auth: {
            credential_types_supported: ["access_token"],
            login_hint_types_supported: ["email"],
            post_claim_scopes: [...POST_CLAIM_SCOPES],
          },
          grant_types_supported: [JWT_BEARER_GRANT, CLAIM_GRANT],
        },
      };
    },
  } satisfies OAuthProviderExtension;
}

// Révocation par le client (page « Agents et applications ») : l'assertion
// et tous les jetons d'accès qui en dérivent (claim ver) deviennent invalides.
export async function revokeAgentRegistration(id: string, userId: string) {
  const db = await getDb();
  const [row] = await db
    .update(agentRegistrations)
    .set({
      status: "revoked",
      revokedAt: new Date(),
      updatedAt: new Date(),
      assertionVersion: sql`${agentRegistrations.assertionVersion} + 1`,
    })
    .where(
      and(eq(agentRegistrations.id, id), eq(agentRegistrations.userId, userId)),
    )
    .returning({ id: agentRegistrations.id });
  return !!row;
}
