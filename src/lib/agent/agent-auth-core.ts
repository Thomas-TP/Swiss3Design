// Cœur sans dépendance du profil auth.md (WorkOS v0.6) : constantes, secrets
// et décisions de la machine à états, en fonctions pures — testées sans base
// ni better-auth (agent.test.ts). Le branchement HTTP vit dans agent-auth.ts.

// Grants du point de terminaison /oauth2/token (RFC 7523 + profil auth.md).
export const JWT_BEARER_GRANT = "urn:ietf:params:oauth:grant-type:jwt-bearer";
export const CLAIM_GRANT = "urn:workos:agent-auth:grant-type:claim";

// En-tête typ des assertions d'identité signées par le service : distinct de
// at+jwt (jetons d'accès) et des jetons d'identité OIDC, pour qu'aucun jeton
// ne puisse se faire passer pour un autre.
export const IDENTITY_ASSERTION_TYP = "agent-identity+jwt";
export const IDENTITY_TOKEN_USE = "agent_identity";

export const CLAIM_WINDOW_S = 24 * 60 * 60; // fenêtre extérieure
export const ATTEMPT_TTL_S = 10 * 60; // validité d'un code à 6 chiffres
export const POLL_INTERVAL_S = 5;
export const MAX_CODE_FAILURES = 5;
// L'assertion post-revendication remplace le jeton de rafraîchissement
// (profil auth.md) : révocable à tout moment côté compte (version).
export const POST_CLAIM_ASSERTION_TTL_S = 30 * 24 * 60 * 60;

export type RegistrationType = "anonymous" | "service_auth";

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function randomToken(prefix: string, bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return `${prefix}${base64url(buf)}`;
}

// Code à 6 chiffres uniforme : tirage par rejet (un simple modulo biaiserait
// les petits codes).
export function randomUserCode(): string {
  const limit = Math.floor(0x100000000 / 1_000_000) * 1_000_000;
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0] < limit) return String(buf[0] % 1_000_000).padStart(6, "0");
  }
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

// Comparaison à temps constant de deux empreintes hexadécimales.
export function sameHash(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isEmail = (value: unknown): value is string =>
  typeof value === "string" && value.length <= 254 && EMAIL_RE.test(value);

// État d'un enregistrement vu par le sondage /oauth2/token (grant « claim »).
export interface RegistrationState {
  status: "unclaimed" | "claimed" | "revoked";
  claimExpiresAt: Date;
  attemptTokenHash: string | null;
  attemptExpiresAt: Date | null;
  deniedAt: Date | null;
  claimedAt: Date | null;
  redeemedAt: Date | null;
  lastPolledAt: Date | null;
}

export type PollError =
  | "authorization_pending"
  | "slow_down"
  | "expired_token"
  | "access_denied"
  | "invalid_grant";

export type PollDecision =
  | { kind: "ready" }
  | { kind: "error"; error: PollError; description: string };

const pollError = (error: PollError, description: string): PollDecision => ({
  kind: "error",
  error,
  description,
});

// Vocabulaire RFC 8628 § 3.5, repris par auth.md (étape 4c).
export function decidePoll(reg: RegistrationState, now: Date): PollDecision {
  if (reg.deniedAt)
    return pollError(
      "access_denied",
      "The account holder declined this agent. Start over with a new registration.",
    );
  if (reg.status === "revoked")
    return pollError("invalid_grant", "This registration was revoked.");
  if (reg.redeemedAt)
    return pollError(
      "invalid_grant",
      "The claim was already completed. Exchange your identity_assertion with the jwt-bearer grant instead.",
    );
  if (reg.status === "claimed" && reg.claimedAt) return { kind: "ready" };
  if (reg.claimExpiresAt <= now)
    return pollError(
      "expired_token",
      "The claim window has closed. Register again.",
    );
  if (!reg.attemptTokenHash || !reg.attemptExpiresAt)
    return pollError(
      "invalid_grant",
      "No claim ceremony in progress. Call the claim endpoint first.",
    );
  if (reg.attemptExpiresAt <= now)
    return pollError(
      "expired_token",
      "The user_code expired. Call the claim endpoint again for a fresh code.",
    );
  if (
    reg.lastPolledAt &&
    now.getTime() - reg.lastPolledAt.getTime() < (POLL_INTERVAL_S - 1) * 1000
  )
    return pollError(
      "slow_down",
      `Polling too fast: wait at least ${POLL_INTERVAL_S + 5} seconds between requests.`,
    );
  return pollError(
    "authorization_pending",
    "The account holder has not confirmed the code yet.",
  );
}

// Vérifications de la page /agent/claim avant de comparer le code saisi.
export type ClaimCheck =
  | "ok"
  | "invalid"
  | "expired"
  | "already_claimed"
  | "locked"
  | "wrong_account";

export function checkClaimAttempt(
  reg:
    | (RegistrationState & {
        claimEmail: string | null;
        attemptFailures: number;
      })
    | null,
  sessionEmail: string,
  now: Date,
): ClaimCheck {
  if (!reg || reg.status === "revoked" || reg.deniedAt) return "invalid";
  if (reg.status === "claimed") return "already_claimed";
  if (
    reg.claimExpiresAt <= now ||
    !reg.attemptExpiresAt ||
    reg.attemptExpiresAt <= now
  )
    return "expired";
  if (reg.attemptFailures >= MAX_CODE_FAILURES) return "locked";
  if (reg.claimEmail && reg.claimEmail !== normalizeEmail(sessionEmail))
    return "wrong_account";
  return "ok";
}

// E-mail masqué pour la page de revendication (ex. j•••@gmail.com) : indique
// quel compte est attendu sans afficher l'adresse complète.
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "•••";
  return `${local.slice(0, 1)}•••@${domain}`;
}
