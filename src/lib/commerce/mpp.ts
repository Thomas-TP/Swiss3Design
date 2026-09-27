// Machine Payments Protocol (MPP, https://mpp.dev) — schéma d'authentification
// HTTP « Payment » pour la méthode `stripe` (carte via Shared Payment Token),
// intention `charge`. Implémentation minimale compatible avec mppx (le client
// de référence de Stripe et du CLI Link), en Web Crypto uniquement :
// - défi 402 : `WWW-Authenticate: Payment id, realm, method, intent, request
//   (JSON canonique en base64url), description, expires` — l'`id` est un
//   HMAC-SHA256 de tous les champs : le serveur reste sans état ;
// - preuve : `Authorization: Payment <base64url(JSON {challenge, payload})>`,
//   `payload.spt` = le jeton à débiter ;
// - reçu : `Payment-Receipt: base64url(JSON {method, reference, status,
//   timestamp})`, erreurs en application/problem+json (paymentauth.org).

const encoder = new TextEncoder();

export function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function fromBase64url(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return new TextDecoder().decode(
    Uint8Array.from(binary, (char) => char.charCodeAt(0)),
  );
}

// JSON canonique (RFC 8785 pour nos types : chaînes, entiers, objets,
// tableaux) : clés triées, sans espace — même octets que mppx.
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value as Record<string, unknown>)
      .filter((k) => (value as Record<string, unknown>)[k] !== undefined)
      .sort()
      .map(
        (k) =>
          `${JSON.stringify(k)}:${canonicalJson((value as Record<string, unknown>)[k])}`,
      )
      .join(",")}}`;
  return JSON.stringify(value);
}

async function hmacBase64url(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return base64url(
    new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(data))),
  );
}

// Secret de liaison des défis dérivé de la clé Stripe (recette de la doc
// Stripe MPP) : aucun secret de plus à gérer, distinct entre test et live.
export async function challengeSecret(
  stripeSecretKey: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(stripeSecretKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode("mpp-challenge-signing"),
  );
  let binary = "";
  for (const byte of new Uint8Array(mac)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export interface StripeChargeRequest {
  amount: string;
  currency: string;
  description?: string;
  externalId?: string;
  methodDetails: {
    networkId: string;
    paymentMethodTypes: string[];
  };
}

export interface MppChallenge {
  id: string;
  realm: string;
  method: "stripe";
  intent: "charge";
  request: StripeChargeRequest;
  description?: string;
  expires: string;
}

function bindingInput(challenge: Omit<MppChallenge, "id">): string {
  // realm | method | intent | request | expires | digest | opaque
  return [
    challenge.realm,
    challenge.method,
    challenge.intent,
    base64url(encoder.encode(canonicalJson(challenge.request))),
    challenge.expires,
    "",
    "",
  ].join("|");
}

export async function createChallenge(
  secret: string,
  input: Omit<MppChallenge, "id">,
): Promise<MppChallenge> {
  // L'id calculé passe en dernier : jamais écrasé par un champ de l'entrée.
  return { ...input, id: await hmacBase64url(secret, bindingInput(input)) };
}

function authParam(name: string, value: string): string {
  if (/[\r\n]/.test(value)) throw new Error("invalid_header_value");
  const escaped = value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(
      /[Ā-￿]/g,
      (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`,
    );
  return `${name}="${escaped}"`;
}

export function serializeChallenge(challenge: MppChallenge): string {
  const parts = [
    authParam("id", challenge.id),
    authParam("realm", challenge.realm),
    authParam("method", challenge.method),
    authParam("intent", challenge.intent),
    authParam(
      "request",
      base64url(encoder.encode(canonicalJson(challenge.request))),
    ),
  ];
  if (challenge.description)
    parts.push(authParam("description", challenge.description));
  parts.push(authParam("expires", challenge.expires));
  return `Payment ${parts.join(", ")}`;
}

export interface MppCredential {
  challenge: {
    id: string;
    realm: string;
    method: string;
    intent: string;
    request: StripeChargeRequest;
    expires?: string;
    digest?: string;
    opaque?: string;
    description?: string;
  };
  payload: { spt?: unknown; externalId?: unknown };
}

// `Authorization: Payment <base64url>` (éventuellement parmi d'autres schémas).
export function parseCredential(header: string | null): MppCredential | null {
  if (!header) return null;
  const scheme = header
    .split(",")
    .map((part) => part.trim())
    .find((part) => /^Payment\s+/i.test(part));
  if (!scheme) return null;
  try {
    const wire = JSON.parse(fromBase64url(scheme.replace(/^Payment\s+/i, "")));
    const request =
      typeof wire?.challenge?.request === "string"
        ? JSON.parse(fromBase64url(wire.challenge.request))
        : wire?.challenge?.request;
    if (!wire?.challenge?.id || !request || typeof wire.payload !== "object")
      return null;
    return {
      challenge: { ...wire.challenge, request },
      payload: wire.payload ?? {},
    };
  } catch {
    return null;
  }
}

// Le défi présenté est-il bien l'un des nôtres, intact et encore valable ?
export async function verifyChallenge(
  secret: string,
  challenge: MppCredential["challenge"],
  realm: string,
): Promise<"ok" | "invalid" | "expired"> {
  if (
    challenge.realm !== realm ||
    challenge.method !== "stripe" ||
    challenge.intent !== "charge" ||
    challenge.digest ||
    challenge.opaque ||
    !challenge.expires
  )
    return "invalid";
  const expected = await hmacBase64url(
    secret,
    bindingInput({
      realm: challenge.realm,
      method: "stripe",
      intent: "charge",
      request: challenge.request,
      expires: challenge.expires,
    }),
  );
  if (!constantTimeEqual(expected, challenge.id)) return "invalid";
  const expires = Date.parse(challenge.expires);
  if (!Number.isFinite(expires) || expires < Date.now()) return "expired";
  return "ok";
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function receiptHeader(paymentIntentId: string, externalId?: string) {
  return base64url(
    encoder.encode(
      JSON.stringify({
        method: "stripe",
        reference: paymentIntentId,
        status: "success",
        timestamp: new Date().toISOString(),
        ...(externalId ? { externalId } : {}),
      }),
    ),
  );
}

export type ProblemType =
  | "payment-required"
  | "malformed-credential"
  | "invalid-challenge"
  | "payment-expired"
  | "verification-failed"
  | "payment-action-required"
  | "bad-request";

const TITLES: Record<ProblemType, string> = {
  "payment-required": "Payment Required",
  "malformed-credential": "Malformed Credential",
  "invalid-challenge": "Invalid Challenge",
  "payment-expired": "Payment Expired",
  "verification-failed": "Verification Failed",
  "payment-action-required": "Payment Action Required",
  "bad-request": "Bad Request",
};

export function problem(
  type: ProblemType,
  detail: string,
  status = 402,
  challengeId?: string,
) {
  return {
    type: `https://paymentauth.org/problems/${type}`,
    title: TITLES[type],
    status,
    detail,
    ...(challengeId ? { challengeId } : {}),
  };
}
