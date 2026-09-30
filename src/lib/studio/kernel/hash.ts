// Empreintes du Studio (brief « Strates », §6.8 et §6.9) : FNV-1a.
//
// - fnv1a32 : altitude fictive du sommet du sous-verre (annexe B) ;
// - fnv1a64 : clé de cache d'un envoi (`s3d-studio-upload-v1`, JSON canonique
//   de la configuration + des textes) et « hash8 » du nom de fichier et de
//   l'en-tête STL.
// Ce ne sont pas des empreintes de sécurité : seulement des clés de cache
// stables d'un moteur à l'autre (octets UTF-8, jamais d'unités UTF-16).

const encoder = new TextEncoder();

/** FNV-1a 32 bits sur les octets UTF-8, entier non signé. */
export function fnv1a32(text: string): number {
  let hash = 0x811c9dc5;
  for (const byte of encoder.encode(text)) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

// BigInt par appel de fonction et non par littéral `0n` : le tsconfig cible
// ES2017, où seuls les littéraux BigInt sont interdits (les opérations, elles,
// viennent de lib esnext et de tous les moteurs visés).
const OFFSET_64 = BigInt("0xcbf29ce484222325");
const PRIME_64 = BigInt("0x100000001b3");

/** FNV-1a 64 bits sur les octets UTF-8, en 16 caractères hexadécimaux. */
export function fnv1a64(text: string): string {
  let hash = OFFSET_64;
  for (const byte of encoder.encode(text)) {
    hash = BigInt.asUintN(64, (hash ^ BigInt(byte)) * PRIME_64);
  }
  return hash.toString(16).padStart(16, "0");
}

/**
 * JSON canonique : clés d'objet triées, pas d'espace, `undefined` omis. Deux
 * configurations égales donnent la même chaîne quel que soit l'ordre dans
 * lequel leurs clés ont été écrites.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => canonicalJson(v)).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`);
  return `{${entries.join(",")}}`;
}

/** Empreinte courte (8 caractères hexadécimaux) d'une valeur JSON. */
export function hash8(value: unknown): string {
  return fnv1a64(canonicalJson(value)).slice(0, 8);
}
