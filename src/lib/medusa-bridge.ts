// Pont d'authentification vers Medusa : mint un JWT HS256 court (2 min,
// jamais stocké) à partir d'une session Better Auth déjà valide, que le
// storefront SolidStart échange contre un token Medusa via l'Auth Module
// Provider custom (apps/medusa/apps/backend/src/modules/better-auth-bridge).
// Signature en Web Crypto (Workers-compatible), même style que
// src/lib/email-proof.ts — pas de dépendance jsonwebtoken côté Worker.

const encoder = new TextEncoder();

// Origines autorisées à appeler ce pont en cross-origin : le storefront
// SolidStart tourne sur un port/Worker distinct de swiss3design.ch pendant
// toute la migration (et possiblement après, selon la décision de bascule
// Phase 6). Étendre cette liste quand une nouvelle origine de storefront
// apparaît (preview, domaine final).
export const STOREFRONT_ORIGINS = [
  "http://localhost:4001",
  "https://swiss3design-storefront.thomastp.workers.dev",
];

export function corsHeadersFor(origin: string | null): HeadersInit {
  const allowed = origin && STOREFRONT_ORIGINS.includes(origin) ? origin : STOREFRONT_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    // Le client Better Auth force `credentials: "include"` dès que
    // l'environnement le supporte (voir better-auth/dist/client/config.mjs) :
    // sans cet en-tête, le navigateur rejette toute réponse cross-origine,
    // même si le cookie de session (SameSite=Lax/Strict) n'est de toute façon
    // jamais transmis cross-origine — seul le jeton porteur (Authorization)
    // circule réellement.
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Expose-Headers": "set-auth-token",
    Vary: "Origin",
  };
}

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

export async function createMedusaBridgeToken(
  user: { id: string; email: string; emailVerified: boolean },
  secret: string,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    sub: user.id,
    email: user.email,
    email_verified: user.emailVerified,
    iat: now,
    exp: now + 2 * 60, // echange immediat cote client, jamais persiste
  };
  const headerB64 = base64url(encoder.encode(JSON.stringify(header)));
  const payloadB64 = base64url(encoder.encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;
  const signature = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(secret),
    encoder.encode(signingInput),
  );
  return `${signingInput}.${base64url(new Uint8Array(signature))}`;
}
