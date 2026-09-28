import {
  ATTEMPT_TTL_S,
  CLAIM_GRANT,
  CLAIM_WINDOW_S,
  JWT_BEARER_GRANT,
  MAX_CODE_FAILURES,
  POLL_INTERVAL_S,
} from "./agent-auth-core";
import { ACCOUNT_TOOL_NAMES, accountToolScope } from "./account-tools";
import { STORE } from "./config";
import {
  AUTH_BASE_PATH,
  OAUTH_SCOPES,
  POST_CLAIM_SCOPES,
  PRE_CLAIM_SCOPES,
  accountResource,
  protectedResourceMetadataUrl,
} from "./oauth";
import { PATHS } from "./paths";
import { TOOL_NAMES } from "./tools";

// /auth.md : mode d'emploi des agents pour agir au nom d'un client, au format
// du profil auth.md (https://github.com/workos/auth.md) — H1 contenant
// « auth.md », étapes numérotées, requêtes HTTP d'exemple. Généré depuis les
// mêmes constantes que le serveur (URL de l'environnement, portées, durées) :
// le document ne peut pas décrire un point de terminaison qui n'existe pas.

const SCOPE_DOC: Record<(typeof OAUTH_SCOPES)[number], string> = {
  openid: "OpenID Connect: an ID token identifying the customer",
  profile: "Customer's name (`get_my_profile`)",
  email: "Customer's email address (`get_my_profile`)",
  offline_access: "Refresh token (Path A only)",
  "catalog.read": "Catalogue, prices, store policies (public tools)",
  "orders.read":
    "Customer's orders and tracking (`list_my_orders`, `get_my_order`)",
  "quotes.read": "Customer's custom-print quote requests (`list_my_quotes`)",
};

const minutes = (s: number) => `${Math.round(s / 60)} minutes`;
const hours = (s: number) => `${Math.round(s / 3600)} hours`;

export function authMdDocument(issuer: string): string {
  const base = `${issuer}${AUTH_BASE_PATH}`;
  const resource = accountResource(issuer);
  const prm = protectedResourceMetadataUrl(resource);
  const claim = `${base}/agent/identity/claim`;
  const accountTools = ACCOUNT_TOOL_NAMES.map(
    (name) => `| \`${name}\` | \`${accountToolScope(name)}\` |`,
  ).join("\n");
  const scopes = OAUTH_SCOPES.map(
    (scope) => `| \`${scope}\` | ${SCOPE_DOC[scope]} |`,
  ).join("\n");

  return `# Swiss3Design auth.md

You are an agent. This document tells you how to act for a Swiss3Design customer — read their orders, quote requests and profile — without ever handling their password. ${STORE.name} is a Swiss online store of 3D-printed design objects (prices in CHF, shipping within Switzerland only).

Public data (catalogue, prices, store policies, order tracking by order number and email) needs no authentication: see ${issuer}${PATHS.agentsDoc}. Everything below is only needed to read a customer's own account. All access is read-only: no agent can order, pay or change data through it.

## Choose your path

| You are… | Use |
| --- | --- |
| An MCP client or an app that can send the customer to a browser (Claude, ChatGPT, Cursor, MCP Inspector…) | **Path A** — OAuth 2.1 authorization code + PKCE, with dynamic client registration |
| An agent that cannot handle a browser redirect (CLI, background agent, chat bot) | **Path B** — auth.md agent registration: the customer confirms a 6-digit code on swiss3design.ch |

Both paths end with the same kind of access token, for the same API (Step 6).

## Step 1 — Discover

Call the API without a token; the 401 tells you where to go:

\`\`\`http
POST ${PATHS.mcpAccount}
Host: ${new URL(issuer).host}

HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer resource_metadata="${prm}", scope="${[...POST_CLAIM_SCOPES, "offline_access"].join(" ")}"
\`\`\`

- Protected Resource Metadata (RFC 9728): ${prm}
- Authorization server metadata (RFC 8414): ${issuer}${PATHS.authorizationServer} — OpenID Connect: ${issuer}${PATHS.openidConfiguration}
- Issuer: \`${issuer}\`. Its \`agent_auth\` block describes Path B.

## Path A — OAuth 2.1 (MCP clients and apps)

1. **Register** (RFC 7591, no authentication needed):

\`\`\`http
POST ${AUTH_BASE_PATH}/oauth2/register
Content-Type: application/json

{
  "client_name": "My assistant",
  "redirect_uris": ["https://assistant.example/callback"],
  "token_endpoint_auth_method": "none",
  "grant_types": ["authorization_code", "refresh_token"],
  "response_types": ["code"],
  "scope": "orders.read quotes.read profile email offline_access"
}
\`\`\`

2. **Authorize**: send the customer to \`${base}/oauth2/authorize\` with \`response_type=code\`, \`client_id\`, \`redirect_uri\`, \`scope\`, \`state\`, \`code_challenge\` + \`code_challenge_method=S256\` (PKCE is required) and \`resource=${resource}\`. The customer signs in on swiss3design.ch and approves on a consent screen that lists your scopes.
3. **Token**: \`POST ${AUTH_BASE_PATH}/oauth2/token\` (form-encoded) with \`grant_type=authorization_code\`, \`code\`, \`code_verifier\`, \`redirect_uri\`, \`client_id\` and \`resource=${resource}\`.
4. **Refresh**: \`grant_type=refresh_token\` (request \`offline_access\` to get one). Refresh tokens rotate.

Always send \`resource=${resource}\` (RFC 8707): the API only accepts tokens issued for it.

## Path B — auth.md agent registration

This service follows the auth.md profile with two identity types: \`anonymous\` and \`service_auth\`. \`identity_assertion\` (ID-JAG) is not enabled: no identity provider is trusted yet, so the registration endpoint answers \`issuer_not_enabled\`.

### Step 2 — Pick a method

1. You know the customer's email address → **service_auth** (claim ceremony right away).
2. You don't → **anonymous**: you immediately get an identity assertion for a catalogue-only token (\`${PRE_CLAIM_SCOPES.join(" ")}\`); ask for the email later to claim the account scopes.

### Step 3 — Register

\`\`\`http
POST ${AUTH_BASE_PATH}/agent/identity
Content-Type: application/json

{ "type": "service_auth", "login_hint": "customer@example.com" }
\`\`\`

\`\`\`json
{
  "registration_id": "reg_…",
  "registration_type": "service_auth",
  "claim_url": "${claim}",
  "claim_token": "clm_…",
  "claim_token_expires": "…",
  "post_claim_scopes": ${JSON.stringify(POST_CLAIM_SCOPES)},
  "claim": {
    "user_code": "123456",
    "expires_in": ${ATTEMPT_TTL_S},
    "verification_uri": "${issuer}${PATHS.agentClaim}?claim_attempt_token=…",
    "interval": ${POLL_INTERVAL_S}
  }
}
\`\`\`

Anonymous: send \`{ "type": "anonymous" }\`. The response carries \`identity_assertion\` (exchange it at Step 5 for a catalogue-only access token), \`claim_token\` and \`claim_url\` — no \`claim\` block until Step 4a. Keep \`claim_token\` in memory only: it is returned once.

No email is sent by the service: you show the code to the customer yourself.

### Step 4 — Claim ceremony

**4a. Start a ceremony** — anonymous registrations start here; any registration also uses it to get a fresh code when one expired (\`service_auth\`: send the \`login_hint\` email):

\`\`\`http
POST ${AUTH_BASE_PATH}/agent/identity/claim
Content-Type: application/json

{ "claim_token": "clm_…", "email": "customer@example.com" }
\`\`\`

The response has a \`claim_attempt\` block (same shape as \`claim\` above). Only the account with this email can complete it.

**4b. Hand off to the customer**, in one message:

> Open this link, sign in to swiss3design.ch (or create an account), and enter this 6-digit code: **123456**
> ${issuer}${PATHS.agentClaim}?claim_attempt_token=…

The code goes into the page on swiss3design.ch, never back to you. The customer can also decline.

**4c. Poll** every \`interval\` seconds:

\`\`\`http
POST ${AUTH_BASE_PATH}/oauth2/token
Content-Type: application/x-www-form-urlencoded

grant_type=${CLAIM_GRANT}&claim_token=clm_…
\`\`\`

While waiting: \`authorization_pending\`; too fast: \`slow_down\` (add 5 s); \`expired_token\`: call 4a again for a new code (\`claim_expired\` there means start over); \`access_denied\`: the customer declined, stop. On success you get a standard token response plus \`identity_assertion\` and \`assertion_expires\`. Any pre-claim assertion and access token stop working at that moment.

### Step 5 — Exchange the assertion

\`\`\`http
POST ${AUTH_BASE_PATH}/oauth2/token
Content-Type: application/x-www-form-urlencoded

grant_type=${JWT_BEARER_GRANT}&assertion=<identity_assertion>&resource=${resource}
\`\`\`

The same \`identity_assertion\` mints new access tokens until it expires: there is no refresh token in Path B. \`invalid_grant\` means it expired, was revoked or was superseded by a claim: if a claim was under way, poll Step 4c (it returns the post-claim assertion once the customer has confirmed), otherwise restart at Step 3.

## Step 6 — Call the API

The customer-account API is an MCP server (Streamable HTTP, JSON-RPC over POST, stateless) at ${resource}:

\`\`\`http
POST ${PATHS.mcpAccount}
Authorization: Bearer <access_token>
Content-Type: application/json

{ "jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": { "name": "list_my_orders", "arguments": { "limit": 5 } } }
\`\`\`

| Account tool | Required scope |
| --- | --- |
${accountTools}

The public tools (${TOOL_NAMES.map((n) => `\`${n}\``).join(", ")}) are available with any valid token. A missing scope returns \`403\` with \`WWW-Authenticate: Bearer error="insufficient_scope"\`.

## Scopes

| Scope | Grants |
| --- | --- |
${scopes}

Path B scopes: anonymous before claim = \`${PRE_CLAIM_SCOPES.join(" ")}\`; after claim = \`${POST_CLAIM_SCOPES.join(" ")}\`.

## Tokens and limits

- Access tokens: JWT signed RS256 (\`typ: at+jwt\`), valid 1 hour, audience = the resource. Keys: ${base}/jwks
- Refresh tokens (Path A, \`offline_access\`): 30 days, rotated on use.
- Identity assertions (Path B): anonymous until the claim window closes (${hours(CLAIM_WINDOW_S)}); claimed: 30 days.
- Claim window ${hours(CLAIM_WINDOW_S)}; each 6-digit code lasts ${minutes(ATTEMPT_TTL_S)} and locks after ${MAX_CODE_FAILURES} wrong entries; poll interval ${POLL_INTERVAL_S} s.
- Registration and claim endpoints are rate-limited per IP (\`429\`).

## Revocation

The customer can remove any agent or application at any time on swiss3design.ch (My account → AI agents). It takes effect immediately: the API rejects the tokens with \`401 invalid_token\`, and Path B assertions stop being exchangeable. On a \`401\` from a token that used to work: Path A → refresh once; Path B → if a claim was under way, poll Step 4c first (pre-claim tokens stop working as soon as the customer confirms the code), otherwise retry Step 5 once; if that fails too, start over at Step 1. Refresh tokens can also be revoked with RFC 7009 at ${base}/oauth2/revoke.

## Errors

| Code | Where | What to do |
| --- | --- | --- |
| \`invalid_login_hint\` | \`/agent/identity\` | Send the email address of the customer's account. |
| \`issuer_not_enabled\` | \`/agent/identity\` | ID-JAG is not accepted: use \`service_auth\` or \`anonymous\`. |
| \`invalid_claim_token\` | \`/agent/identity/claim\` | Unknown \`claim_token\`: restart at Step 3. |
| \`claimed_or_in_flight\` | \`/agent/identity/claim\` | Already claimed: poll the token endpoint or use your assertion. |
| \`claim_expired\` | \`/agent/identity/claim\` | Registration expired or declined: restart at Step 3. |
| \`authorization_pending\`, \`slow_down\`, \`expired_token\`, \`access_denied\` | claim grant | See Step 4c. |
| \`invalid_grant\` | \`/oauth2/token\` | Assertion, code or refresh token expired, revoked or reused. |
| \`invalid_target\` | \`/oauth2/token\` | Unknown \`resource\`: use ${resource}. |
| \`invalid_scope\` | \`/oauth2/token\` (Path B) | Requested \`scope\` exceeds what this registration has: omit \`scope\`, or stay within the pre-claim or post-claim scopes. |
| \`invalid_request\` | \`/agent/identity\`, \`/agent/identity/claim\` | Missing or malformed \`type\` or \`email\`, or an \`email\` different from the registration's \`login_hint\`. |

## Privacy

Swiss3Design is subject to the Swiss Federal Act on Data Protection (nLPD). The account API never exposes postal addresses or payment details. Privacy policy: ${issuer}/en/legal/privacy — contact: ${STORE.email}.
`;
}
