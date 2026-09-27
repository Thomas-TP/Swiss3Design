import { routing } from "@/i18n/routing";
import { PATHS } from "./paths";

// Serveur d'autorisation OAuth 2.1 des agents (plugin better-auth
// oauth-provider) : constantes partagées par la configuration better-auth,
// les documents /.well-known/, le serveur MCP « compte client » et /auth.md.
// Toutes les URL dérivent de l'origine réelle (BETTER_AUTH_URL) et non de
// SITE_URL : en preview, l'émetteur des jetons doit être l'URL *.workers.dev
// qui les émet, sinon aucun client ne valide la chaîne.

// Émetteur = origine du site, sans chemin : ses métadonnées vivent donc à
// /.well-known/oauth-authorization-server (RFC 8414), là où tout client et
// tout scanner les cherche en premier, même si les points de terminaison
// restent sous /api/auth (basePath better-auth).
export const oauthIssuer = (betterAuthUrl: string) =>
  new URL(betterAuthUrl).origin;

export const AUTH_BASE_PATH = "/api/auth";

// Portées. openid/profile/email/offline_access : OpenID Connect standard.
// Les autres décrivent ce que le serveur MCP compte (/mcp/account) expose.
export const RESOURCE_SCOPES = [
  "catalog.read",
  "orders.read",
  "quotes.read",
  "profile",
  "email",
] as const;

export const OAUTH_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "catalog.read",
  "orders.read",
  "quotes.read",
] as const;

export type OAuthScope = (typeof OAUTH_SCOPES)[number];

// Portées annoncées dans les métadonnées de ressource protégée : celles que
// l'API comprend, plus offline_access pour que les clients MCP demandent un
// jeton de rafraîchissement (sinon reconnexion toutes les heures).
export const PRM_SCOPES = [...RESOURCE_SCOPES, "offline_access"] as const;

// Agents auth.md : un enregistrement anonyme ne lit que le catalogue public ;
// une fois revendiqué par le client, il lit aussi son compte.
export const PRE_CLAIM_SCOPES = ["catalog.read"] as const;
export const POST_CLAIM_SCOPES = [
  "catalog.read",
  "orders.read",
  "quotes.read",
  "profile",
  "email",
] as const;

// Ressources protégées (RFC 8707 / RFC 9728). La ressource canonique est le
// serveur MCP compte client ; l'origine et les racines de langue en sont des
// alias, car un agent qui part de https://swiss3design.ch/ (redirigé vers
// /fr) cherche les métadonnées sous /.well-known/oauth-protected-resource/fr
// et y exige `resource` identique à l'URL de départ (RFC 9728 § 3.3). Un jeton
// émis pour n'importe lequel de ces identifiants est accepté par /mcp/account.
export function protectedResources(issuer: string) {
  return [
    `${issuer}${PATHS.mcpAccount}`,
    issuer,
    ...routing.locales.map((locale) => `${issuer}/${locale}`),
  ];
}

export const accountResource = (issuer: string) =>
  `${issuer}${PATHS.mcpAccount}`;

// Document de métadonnées de ressource protégée (RFC 9728) pour l'identifiant
// `resource` demandé. null si l'identifiant n'est pas une ressource connue.
export function protectedResourceMetadata(issuer: string, resource: string) {
  if (!protectedResources(issuer).includes(resource)) return null;
  return {
    resource,
    resource_name: "Swiss3Design customer account (MCP)",
    resource_documentation: `${issuer}${PATHS.authMd}`,
    resource_logo_uri: `${issuer}/brand/app/icon-192.png`,
    authorization_servers: [issuer],
    scopes_supported: [...PRM_SCOPES],
    bearer_methods_supported: ["header"],
    resource_policy_uri: `${issuer}/fr/legal/privacy`,
    resource_tos_uri: `${issuer}/fr/legal/terms`,
  };
}

// URL du document de métadonnées d'un identifiant de ressource : insertion de
// /.well-known/oauth-protected-resource entre l'origine et le chemin (§ 3.1).
export function protectedResourceMetadataUrl(resource: string) {
  const url = new URL(resource);
  const path = url.pathname === "/" ? "" : url.pathname.replace(/\/$/, "");
  return `${url.origin}${PATHS.protectedResource}${path}`;
}

// Défi RFC 6750 + RFC 9728 d'une réponse 401/403 du serveur de ressources :
// l'agent y trouve l'URL des métadonnées, donc le serveur d'autorisation.
export function bearerChallenge(
  issuer: string,
  error?: {
    code: "invalid_token" | "insufficient_scope" | "invalid_request";
    description: string;
    scope?: readonly string[];
  },
) {
  const parts = [
    `resource_metadata="${protectedResourceMetadataUrl(accountResource(issuer))}"`,
    `scope="${(error?.scope ?? PRM_SCOPES).join(" ")}"`,
  ];
  if (error)
    parts.unshift(
      `error="${error.code}"`,
      `error_description="${error.description.replace(/"/g, "'")}"`,
    );
  return `Bearer ${parts.join(", ")}`;
}
