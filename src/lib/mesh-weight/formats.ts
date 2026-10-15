// Lecture de STL (binaire et ASCII), OBJ et 3MF, SANS dépendance : on n'en tire que
// le volume, la surface et la boîte englobante (MeshStats). Pur TypeScript : tourne
// dans un Web Worker du navigateur (worker.ts) comme sous Node (tests). Les
// unités des STL et OBJ sont supposées en millimètres (comme les trancheurs) ;
// un 3MF porte la sienne (`unit`), convertie.
import { MeshAccumulator, type MeshStats } from "./geometry";

const decoder = new TextDecoder();

// ── STL ──────────────────────────────────────────────────────────────────────

export function parseStl(buffer: ArrayBuffer): MeshStats | null {
  const acc = new MeshAccumulator();
  if (buffer.byteLength >= 84) {
    const view = new DataView(buffer);
    const count = view.getUint32(80, true);
    // Binaire : 80 octets d'en-tête, un compteur, puis 50 octets par triangle.
    if (count > 0 && 84 + count * 50 === buffer.byteLength) {
      for (let i = 0; i < count; i++) {
        const o = 84 + i * 50 + 12; // les 12 premiers octets sont la normale
        acc.triangle(
          view.getFloat32(o, true),
          view.getFloat32(o + 4, true),
          view.getFloat32(o + 8, true),
          view.getFloat32(o + 12, true),
          view.getFloat32(o + 16, true),
          view.getFloat32(o + 20, true),
          view.getFloat32(o + 24, true),
          view.getFloat32(o + 28, true),
          view.getFloat32(o + 32, true),
        );
      }
      return acc.stats();
    }
  }
  const text = decoder.decode(buffer);
  const re = /vertex\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)/g;
  const v: number[] = [];
  for (let m = re.exec(text); m; m = re.exec(text)) {
    v.push(Number(m[1]), Number(m[2]), Number(m[3]));
    if (v.length === 9) {
      acc.triangle(v[0], v[1], v[2], v[3], v[4], v[5], v[6], v[7], v[8]);
      v.length = 0;
    }
  }
  return acc.triangles > 0 ? acc.stats() : null;
}

// ── OBJ ──────────────────────────────────────────────────────────────────────

export function parseObj(buffer: ArrayBuffer): MeshStats | null {
  const text = decoder.decode(buffer);
  const acc = new MeshAccumulator();
  const verts: number[] = [];
  let from = 0;
  while (from < text.length) {
    let end = text.indexOf("\n", from);
    if (end < 0) end = text.length;
    const first = text.charCodeAt(from);
    // « v x y z » (pas vt, vn, vp) puis « f a/b/c … »
    if (first === 118 && text.charCodeAt(from + 1) === 32) {
      const parts = text
        .slice(from + 2, end)
        .trim()
        .split(/\s+/);
      verts.push(Number(parts[0]), Number(parts[1]), Number(parts[2]));
    } else if (first === 102 && text.charCodeAt(from + 1) === 32) {
      const idx = text
        .slice(from + 2, end)
        .trim()
        .split(/\s+/)
        .map((token) => {
          const i = Number.parseInt(token.split("/")[0], 10);
          return i < 0 ? verts.length / 3 + i : i - 1;
        });
      for (let k = 1; k + 1 < idx.length; k++) {
        const a = idx[0] * 3;
        const b = idx[k] * 3;
        const c = idx[k + 1] * 3;
        if (!(a >= 0 && b >= 0 && c >= 0 && c + 2 < verts.length)) continue;
        acc.triangle(
          verts[a],
          verts[a + 1],
          verts[a + 2],
          verts[b],
          verts[b + 1],
          verts[b + 2],
          verts[c],
          verts[c + 1],
          verts[c + 2],
        );
      }
    }
    from = end + 1;
  }
  return acc.triangles > 0 ? acc.stats() : null;
}

// ── 3MF (archive ZIP de fichiers .model en XML) ──────────────────────────────

/** Garde-fou contre une archive piégée : 400 Mo décompressés au plus. */
const MAX_INFLATED_BYTES = 400 * 1024 * 1024;

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Les fichiers `.model` d'une archive ZIP (stockés ou « deflate »), par chemin sans « / » initial. */
export async function readModelFiles(
  buffer: ArrayBuffer,
): Promise<Map<string, string>> {
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
  const out = new Map<string, string>();
  let inflated = 0;
  for (let n = 0; n < entries; n++) {
    if (view.getUint32(cursor, true) !== 0x02014b50) throw new Error("zip");
    const method = view.getUint16(cursor + 10, true);
    const compressed = view.getUint32(cursor + 20, true);
    const uncompressed = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const local = view.getUint32(cursor + 42, true);
    const name = decoder.decode(
      bytes.subarray(cursor + 46, cursor + 46 + nameLength),
    );
    cursor += 46 + nameLength + extraLength + commentLength;
    if (!name.toLowerCase().endsWith(".model")) continue;
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
    out.set(name.replace(/^\/+/, ""), decoder.decode(data));
  }
  return out;
}

type Matrix = readonly number[]; // 12 nombres, convention 3MF : [m00 m01 m02 m10 … m30 m31 m32]
const IDENTITY: Matrix = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];

function parseMatrix(raw: string | undefined): Matrix {
  if (!raw) return IDENTITY;
  const n = raw.trim().split(/\s+/).map(Number);
  return n.length === 12 && n.every(Number.isFinite) ? n : IDENTITY;
}

/** `a` appliqué d'abord, puis `b` (vecteur ligne : v' = v · M + t). */
function multiply(a: Matrix, b: Matrix): Matrix {
  const out = Array.from({ length: 12 }, () => 0);
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 3; c++) {
      let sum = r === 3 ? b[9 + c] : 0;
      for (let k = 0; k < 3; k++) sum += a[r * 3 + k] * b[k * 3 + c];
      out[r * 3 + c] = sum;
    }
  return out;
}

const UNIT_MM: Record<string, number> = {
  micron: 0.001,
  millimeter: 1,
  centimeter: 10,
  inch: 25.4,
  foot: 304.8,
  meter: 1000,
};

const attr = (source: string, name: string) =>
  new RegExp(`\\b${name}="([^"]*)"`).exec(source)?.[1];

interface ModelObject {
  vertices: Float64Array;
  triangles: Uint32Array;
  components: { id: string; path?: string; transform: Matrix }[];
}

interface Model {
  unit: number;
  objects: Map<string, ModelObject>;
  items: { id: string; transform: Matrix }[];
}

function parseModel(xml: string): Model {
  const unit =
    UNIT_MM[
      attr(/<model\b[^>]*>/.exec(xml)?.[0] ?? "", "unit") ?? "millimeter"
    ] ?? 1;
  const objects = new Map<string, ModelObject>();
  const objectRe = /<object\b([^>]*)>([\s\S]*?)<\/object>/g;
  for (let m = objectRe.exec(xml); m; m = objectRe.exec(xml)) {
    const id = attr(m[1], "id");
    if (id === undefined) continue;
    const body = m[2];
    const v: number[] = [];
    const t: number[] = [];
    const vRe =
      /<vertex\b[^>]*?\bx="([^"]+)"[^>]*?\by="([^"]+)"[^>]*?\bz="([^"]+)"/g;
    for (let a = vRe.exec(body); a; a = vRe.exec(body))
      v.push(Number(a[1]), Number(a[2]), Number(a[3]));
    const tRe =
      /<triangle\b[^>]*?\bv1="(\d+)"[^>]*?\bv2="(\d+)"[^>]*?\bv3="(\d+)"/g;
    for (let a = tRe.exec(body); a; a = tRe.exec(body))
      t.push(Number(a[1]), Number(a[2]), Number(a[3]));
    const components: ModelObject["components"] = [];
    const cRe = /<component\b([^>]*?)\/?>/g;
    for (let a = cRe.exec(body); a; a = cRe.exec(body)) {
      const cid = attr(a[1], "objectid");
      if (cid === undefined) continue;
      components.push({
        id: cid,
        path: attr(a[1], "(?:p:)?path"),
        transform: parseMatrix(attr(a[1], "transform")),
      });
    }
    objects.set(id, {
      vertices: Float64Array.from(v),
      triangles: Uint32Array.from(t),
      components,
    });
  }
  const items: Model["items"] = [];
  const itemRe = /<item\b([^>]*?)\/?>/g;
  for (let a = itemRe.exec(xml); a; a = itemRe.exec(xml)) {
    const id = attr(a[1], "objectid");
    if (id !== undefined)
      items.push({ id, transform: parseMatrix(attr(a[1], "transform")) });
  }
  return { unit, objects, items };
}

export async function parse3mf(buffer: ArrayBuffer): Promise<MeshStats | null> {
  const files = await readModelFiles(buffer);
  const mainPath =
    [...files.keys()].find((k) => k.toLowerCase() === "3d/3dmodel.model") ??
    [...files.keys()][0];
  if (!mainPath) return null;
  const models = new Map<string, Model>();
  for (const [path, xml] of files) models.set(path, parseModel(xml));
  const main = models.get(mainPath)!;
  const acc = new MeshAccumulator();

  function walk(modelPath: string, id: string, matrix: Matrix, depth: number) {
    const model = models.get(modelPath);
    const object = model?.objects.get(id);
    if (!model || !object || depth > 8) return;
    const scale = model.unit;
    const { vertices: v, triangles: t } = object;
    if (t.length > 0) {
      const at = (i: number): [number, number, number] => {
        const x = v[i * 3] * scale;
        const y = v[i * 3 + 1] * scale;
        const z = v[i * 3 + 2] * scale;
        return [
          x * matrix[0] + y * matrix[3] + z * matrix[6] + matrix[9] * scale,
          x * matrix[1] + y * matrix[4] + z * matrix[7] + matrix[10] * scale,
          x * matrix[2] + y * matrix[5] + z * matrix[8] + matrix[11] * scale,
        ];
      };
      for (let i = 0; i < t.length; i += 3) {
        if (
          t[i] * 3 + 2 >= v.length ||
          t[i + 1] * 3 + 2 >= v.length ||
          t[i + 2] * 3 + 2 >= v.length
        )
          continue;
        const a = at(t[i]);
        const b = at(t[i + 1]);
        const c = at(t[i + 2]);
        acc.triangle(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
      }
    }
    for (const component of object.components)
      walk(
        component.path ? component.path.replace(/^\/+/, "") : modelPath,
        component.id,
        multiply(component.transform, matrix),
        depth + 1,
      );
  }

  if (main.items.length > 0)
    for (const item of main.items) walk(mainPath, item.id, item.transform, 0);
  else for (const id of main.objects.keys()) walk(mainPath, id, IDENTITY, 0);
  return acc.triangles > 0 ? acc.stats() : null;
}

// ── Distribution par extension ───────────────────────────────────────────────

export type MeshFormat = "stl" | "obj" | "3mf";

export function meshFormatOf(fileName: string): MeshFormat | null {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return ext === "stl" || ext === "obj" || ext === "3mf" ? ext : null;
}

export async function parseMesh(
  format: MeshFormat,
  buffer: ArrayBuffer,
): Promise<MeshStats | null> {
  if (format === "stl") return parseStl(buffer);
  if (format === "obj") return parseObj(buffer);
  return parse3mf(buffer);
}
