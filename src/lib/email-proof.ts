// Preuve signée qu'une adresse e-mail a été vérifiée au checkout (invités).
// Jeton HMAC-SHA256 autoporté : "<expiration>.<signature hex>" — aucune
// donnée à stocker côté serveur, vérifiable avec BETTER_AUTH_SECRET.

const encoder = new TextEncoder();

const PROOF_TTL_MS = 2 * 60 * 60 * 1000; // 2 h : large pour finir sa commande

async function hmacKey(secret: string, usage: KeyUsage): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    [usage],
  );
}

function payload(email: string, exp: number) {
  return encoder.encode(`checkout-email:${email.trim().toLowerCase()}:${exp}`);
}

export async function createEmailProof(
  email: string,
  secret: string,
): Promise<string> {
  const exp = Date.now() + PROOF_TTL_MS;
  const sig = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(secret, "sign"),
    payload(email, exp),
  );
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${exp}.${hex}`;
}

export async function verifyEmailProof(
  email: string,
  proof: string,
  secret: string,
): Promise<boolean> {
  const [expStr, hex] = proof.split(".");
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  if (!hex || hex.length !== 64 || /[^0-9a-f]/.test(hex)) return false;
  const sig = new Uint8Array(
    hex.match(/.{2}/g)!.map((byte) => parseInt(byte, 16)),
  );
  return crypto.subtle.verify(
    "HMAC",
    await hmacKey(secret, "verify"),
    sig,
    payload(email, exp),
  );
}
