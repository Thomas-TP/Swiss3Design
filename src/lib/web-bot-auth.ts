// Web Bot Auth (groupe IETF webbotauth) : le site s'identifie comme robot
// quand il envoie lui-même des requêtes (notifications IndexNow), par une
// signature HTTP Message Signatures (RFC 9421) vérifiable par le destinataire.
//   - clé privée Ed25519 : secret Worker WEB_BOT_AUTH_PRIVATE_KEY (JWK) ;
//   - clé publique : /.well-known/http-message-signatures-directory (JWKS),
//     réponse elle-même signée (draft-meunier-http-message-signatures-directory) ;
//   - requêtes : en-têtes Signature-Agent, Signature-Input, Signature
//     (draft-meunier-web-bot-auth-architecture), comme le décrit Cloudflare
//     (developers.cloudflare.com/bots/reference/bot-verification/web-bot-auth).

export interface BotKey {
  privateKey: CryptoKey;
  publicJwk: { kty: "OKP"; crv: "Ed25519"; x: string };
  keyid: string;
}

// Fenêtre de validité des signatures : assez longue pour le transit, assez
// courte pour limiter le rejeu (Cloudflare recommande au moins une minute).
const SIGNATURE_TTL_S = 300;

const encoder = new TextEncoder();

function base64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

const base64url = (bytes: Uint8Array) =>
  base64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function nonce(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64(bytes);
}

// Empreinte JWK (RFC 7638, clés OKP : RFC 8037 § A.3) = keyid des signatures.
export async function jwkThumbprint(x: string): Promise<string> {
  const canonical = JSON.stringify({ crv: "Ed25519", kty: "OKP", x });
  const digest = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(canonical),
  );
  return base64url(new Uint8Array(digest));
}

export async function loadBotKey(
  secret: string | undefined,
): Promise<BotKey | null> {
  if (!secret) return null;
  let jwk: JsonWebKey;
  try {
    jwk = JSON.parse(secret) as JsonWebKey;
  } catch {
    return null;
  }
  if (jwk.kty !== "OKP" || jwk.crv !== "Ed25519" || !jwk.d || !jwk.x)
    return null;
  const privateKey = await crypto.subtle.importKey(
    "jwk",
    { kty: "OKP", crv: "Ed25519", d: jwk.d, x: jwk.x },
    { name: "Ed25519" },
    false,
    ["sign"],
  );
  return {
    privateKey,
    publicJwk: { kty: "OKP", crv: "Ed25519", x: jwk.x },
    keyid: await jwkThumbprint(jwk.x),
  };
}

// Liste de composants + paramètres, sérialisés en champ structuré (RFC 8941)
// tels qu'ils figurent dans Signature-Input et dans "@signature-params".
function signatureParams(
  components: string[],
  params: [string, string | number][],
): string {
  return `(${components.join(" ")})${params
    .map(([key, value]) =>
      typeof value === "number" ? `;${key}=${value}` : `;${key}="${value}"`,
    )
    .join("")}`;
}

// Base de signature (RFC 9421 § 2.5) : une ligne par composant, puis la ligne
// "@signature-params", sans saut de ligne final.
export function signatureBase(
  components: [identifier: string, value: string][],
  params: string,
): string {
  return [
    ...components.map(([identifier, value]) => `${identifier}: ${value}`),
    `"@signature-params": ${params}`,
  ].join("\n");
}

async function sign(key: CryptoKey, base: string): Promise<string> {
  const signature = await crypto.subtle.sign(
    { name: "Ed25519" },
    key,
    encoder.encode(base),
  );
  return base64(new Uint8Array(signature));
}

// En-têtes d'une requête sortante du robot (tag « web-bot-auth ») : couvre
// @authority (domaine visé) et Signature-Agent (origine du répertoire de clés).
export async function botRequestHeaders(
  key: BotKey,
  url: string,
  agentOrigin: string,
  now = Date.now(),
): Promise<Record<string, string>> {
  const created = Math.floor(now / 1000);
  const signatureAgent = `"${agentOrigin}"`;
  const params = signatureParams(
    ['"@authority"', '"signature-agent"'],
    [
      ["created", created],
      ["keyid", key.keyid],
      ["alg", "ed25519"],
      ["expires", created + SIGNATURE_TTL_S],
      ["nonce", nonce()],
      ["tag", "web-bot-auth"],
    ],
  );
  const base = signatureBase(
    [
      ['"@authority"', new URL(url).host],
      ['"signature-agent"', signatureAgent],
    ],
    params,
  );
  return {
    "Signature-Agent": signatureAgent,
    "Signature-Input": `sig1=${params}`,
    Signature: `sig1=:${await sign(key.privateKey, base)}:`,
  };
}

// Signature de la réponse du répertoire (tag
// « http-message-signatures-directory ») : @authority de la requête reçue, pour
// qu'un tiers ne puisse pas republier le répertoire à son nom.
export async function directoryResponseHeaders(
  key: BotKey,
  requestAuthority: string,
  now = Date.now(),
): Promise<Record<string, string>> {
  const created = Math.floor(now / 1000);
  const params = signatureParams(
    ['"@authority";req'],
    [
      ["alg", "ed25519"],
      ["keyid", key.keyid],
      ["nonce", nonce()],
      ["tag", "http-message-signatures-directory"],
      ["created", created],
      ["expires", created + SIGNATURE_TTL_S],
    ],
  );
  const base = signatureBase([['"@authority";req', requestAuthority]], params);
  return {
    "Signature-Input": `sig1=${params}`,
    Signature: `sig1=:${await sign(key.privateKey, base)}:`,
  };
}
