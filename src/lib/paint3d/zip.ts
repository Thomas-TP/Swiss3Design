// Archives ZIP (un 3MF en est une) : lecture des entrées utiles et écriture
// « deflate », sans dépendance. Compression et décompression par les flux
// natifs du navigateur (CompressionStream « deflate-raw », Chrome 80, Safari
// 16.4, Firefox 113 ; Node 18 pour les tests), hors du fil principal.

const decoder = new TextDecoder();

/** Garde-fou contre une archive piégée : 400 Mo décompressés au plus. */
export const MAX_INFLATED_BYTES = 400 * 1024 * 1024;

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * Entrées d'une archive dont le nom passe `wanted` (chemin sans « / » initial),
 * décompressées. Lève « zip » pour une archive illisible.
 */
export async function readZipEntries(
  buffer: ArrayBuffer,
  wanted: (name: string) => boolean,
): Promise<Map<string, Uint8Array>> {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  let eocd = -1;
  for (
    let i = bytes.length - 22;
    i >= Math.max(0, bytes.length - 22 - 65535);
    i--
  ) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("zip");
  const entries = view.getUint16(eocd + 10, true);
  let cursor = view.getUint32(eocd + 16, true);
  const out = new Map<string, Uint8Array>();
  let inflated = 0;
  for (let n = 0; n < entries; n++) {
    if (cursor + 46 > bytes.length) throw new Error("zip");
    if (view.getUint32(cursor, true) !== 0x02014b50) throw new Error("zip");
    const method = view.getUint16(cursor + 10, true);
    const compressed = view.getUint32(cursor + 20, true);
    const uncompressed = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const local = view.getUint32(cursor + 42, true);
    const name = decoder
      .decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength))
      .replace(/^\/+/, "");
    cursor += 46 + nameLength + extraLength + commentLength;
    if (!wanted(name)) continue;
    inflated += uncompressed;
    if (inflated > MAX_INFLATED_BYTES) throw new Error("zip-too-large");
    if (view.getUint32(local, true) !== 0x04034b50) throw new Error("zip");
    const start =
      local +
      30 +
      view.getUint16(local + 26, true) +
      view.getUint16(local + 28, true);
    const raw = bytes.subarray(start, start + compressed);
    const data =
      method === 0 ? raw : method === 8 ? await inflateRaw(raw) : null;
    if (!data) throw new Error("zip-method");
    out.set(name, data);
  }
  return out;
}

export const textOf = (data: Uint8Array | undefined) =>
  data ? decoder.decode(data) : undefined;

// ── Écriture ─────────────────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array, crc = 0): number {
  let c = ~crc >>> 0;
  for (let i = 0; i < data.length; i++)
    c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return ~c >>> 0;
}

export interface ZipInput {
  name: string;
  /** Contenu : octets, ou morceaux produits à la demande (gros XML). */
  data: Uint8Array | AsyncIterable<Uint8Array> | Iterable<Uint8Array>;
}

function dosDateTime(date: Date): { time: number; date: number } {
  const year = Math.max(1980, date.getFullYear());
  return {
    time:
      (date.getHours() << 11) |
      (date.getMinutes() << 5) |
      Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

async function deflate(
  source: ZipInput["data"],
): Promise<{ parts: Uint8Array[]; size: number; raw: number; crc: number }> {
  const stream = new CompressionStream("deflate-raw");
  const writer = stream.writable.getWriter();
  const reader = stream.readable.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  const pump = (async () => {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      parts.push(value);
      size += value.byteLength;
    }
  })();
  let crc = 0;
  let raw = 0;
  const chunks =
    source instanceof Uint8Array
      ? [source]
      : (source as AsyncIterable<Uint8Array>);
  for await (const chunk of chunks) {
    crc = crc32(chunk, crc);
    raw += chunk.byteLength;
    await writer.write(chunk as BufferSource);
  }
  await writer.close();
  await pump;
  return { parts, size, raw, crc };
}

/** Archive ZIP (méthode « deflate », noms UTF-8) des entrées, dans l'ordre. */
export async function writeZip(
  entries: readonly ZipInput[],
  now = new Date(),
): Promise<Blob> {
  const encoder = new TextEncoder();
  const { time, date } = dosDateTime(now);
  const body: BlobPart[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const { parts, size, raw, crc } = await deflate(entry.data);
    if (raw > 0xffffffff || size > 0xffffffff) throw new Error("zip-too-large");
    const local = new Uint8Array(30 + name.length);
    const l = new DataView(local.buffer);
    l.setUint32(0, 0x04034b50, true);
    l.setUint16(4, 20, true);
    l.setUint16(6, 0x0800, true);
    l.setUint16(8, 8, true);
    l.setUint16(10, time, true);
    l.setUint16(12, date, true);
    l.setUint32(14, crc, true);
    l.setUint32(18, size, true);
    l.setUint32(22, raw, true);
    l.setUint16(26, name.length, true);
    local.set(name, 30);
    const header = new Uint8Array(46 + name.length);
    const h = new DataView(header.buffer);
    h.setUint32(0, 0x02014b50, true);
    h.setUint16(4, 20, true);
    h.setUint16(6, 20, true);
    h.setUint16(8, 0x0800, true);
    h.setUint16(10, 8, true);
    h.setUint16(12, time, true);
    h.setUint16(14, date, true);
    h.setUint32(16, crc, true);
    h.setUint32(20, size, true);
    h.setUint32(24, raw, true);
    h.setUint16(28, name.length, true);
    h.setUint32(42, offset, true);
    header.set(name, 46);
    central.push(header);
    body.push(local as BlobPart, ...(parts as BlobPart[]));
    offset += local.length + size;
  }
  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true);
  e.setUint16(8, entries.length, true);
  e.setUint16(10, entries.length, true);
  e.setUint32(12, centralSize, true);
  e.setUint32(16, offset, true);
  return new Blob([...body, ...(central as BlobPart[]), end as BlobPart], {
    type: "model/3mf",
  });
}
