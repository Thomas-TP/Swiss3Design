// Lecture du fichier du visiteur pour l'atelier 3D : STL (binaire, ASCII), OBJ,
// 3MF, ou les triangles d'un STEP déjà converti (Worker d'OpenCascade). Un 3MF
// de Bambu Studio, OrcaSlicer ou PrusaSlicer (MakerWorld, Printables) garde ses
// couleurs : la peinture par triangle (`paint_color`, `slic3rpe:mmu_segmentation`),
// le filament de chaque objet et de chaque pièce, et la teinte de chaque filament.
// Les volumes qui ne s'impriment pas (modificateurs, volumes négatifs, bloqueurs
// de supports) sont écartés.
import type { PaintPart } from "./document";
import { decodePaint, type PaintNode } from "./selector";
import { readZipEntries, textOf } from "./zip";

const decoder = new TextDecoder();

export interface LoadedMesh {
  /** 9 nombres par triangle, en mm. */
  positions: Float32Array;
  parts: PaintPart[];
  /** Filament de chaque pièce (1 = le premier), 0 si le fichier n'en dit rien. */
  partFilaments: number[];
  /**
   * Peinture du fichier, en numéros de filament (0 = celui de la pièce). Vide
   * pour un STL, un OBJ, un STEP.
   */
  paint: Map<number, PaintNode>;
  /** Teinte de chaque filament du fichier (« #RRGGBB »), filament 1 en tête. */
  filamentColors: string[];
  /** Logiciel qui a écrit le fichier (3MF), pour le message affiché. */
  producer: "bambu" | "prusa" | "other" | null;
}

const empty = (positions: Float32Array): LoadedMesh => ({
  positions,
  parts: [{ name: "", first: 0, count: Math.floor(positions.length / 9) }],
  partFilaments: [0],
  paint: new Map(),
  filamentColors: [],
  producer: null,
});

// ── STL ──────────────────────────────────────────────────────────────────────

export function readStl(buffer: ArrayBuffer): LoadedMesh {
  if (buffer.byteLength >= 84) {
    const view = new DataView(buffer);
    const count = view.getUint32(80, true);
    if (count > 0 && 84 + count * 50 === buffer.byteLength) {
      const positions = new Float32Array(count * 9);
      for (let i = 0; i < count; i++) {
        const o = 84 + i * 50 + 12;
        for (let k = 0; k < 9; k++)
          positions[i * 9 + k] = view.getFloat32(o + k * 4, true);
      }
      return empty(positions);
    }
  }
  const text = decoder.decode(buffer);
  const re = /vertex\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)/g;
  const values: number[] = [];
  for (let m = re.exec(text); m; m = re.exec(text))
    values.push(Number(m[1]), Number(m[2]), Number(m[3]));
  const usable = values.length - (values.length % 9);
  return empty(Float32Array.from(values.slice(0, usable)));
}

// ── OBJ ──────────────────────────────────────────────────────────────────────

export function readObj(buffer: ArrayBuffer): LoadedMesh {
  const text = decoder.decode(buffer);
  const verts: number[] = [];
  const out: number[] = [];
  let from = 0;
  while (from < text.length) {
    let end = text.indexOf("\n", from);
    if (end < 0) end = text.length;
    const first = text.charCodeAt(from);
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
        if (
          !(a >= 0 && b >= 0 && c >= 0 && Math.max(a, b, c) + 2 < verts.length)
        )
          continue;
        out.push(
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
  return empty(Float32Array.from(out));
}

// ── 3MF ──────────────────────────────────────────────────────────────────────

/** 12 nombres, convention 3MF (vecteur ligne) : v' = v · M + t. */
type Matrix = readonly number[];
const IDENTITY: Matrix = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];

function parseMatrix(raw: string | undefined): Matrix {
  if (!raw) return IDENTITY;
  const n = raw.trim().split(/\s+/).map(Number);
  return n.length === 12 && n.every(Number.isFinite) ? n : IDENTITY;
}

/** `a` d'abord, puis `b`. */
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

/** Valeur d'un attribut dans le texte d'une balise (insensible à l'ordre). */
export function attrOf(tag: string, name: string): string | undefined {
  let from = 0;
  for (;;) {
    const at = tag.indexOf(`${name}="`, from);
    if (at < 0) return undefined;
    const before = at === 0 ? " " : tag[at - 1];
    if (
      before === " " ||
      before === "\t" ||
      before === "\n" ||
      before === "\r"
    ) {
      const start = at + name.length + 2;
      const end = tag.indexOf('"', start);
      return end < 0 ? undefined : tag.slice(start, end);
    }
    from = at + 1;
  }
}

const xmlUnescape = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

interface MeshObject {
  name: string;
  vertices: Float64Array;
  triangles: Uint32Array;
  /** Chaîne de peinture des triangles qui en ont une. */
  paint: Map<number, string>;
  components: { id: string; path?: string; transform: Matrix }[];
}

interface Model {
  unit: number;
  objects: Map<string, MeshObject>;
  items: { id: string; transform: Matrix }[];
}

function parseModel(xml: string): Model {
  const unit =
    UNIT_MM[
      attrOf(/<model\b[^>]*>/.exec(xml)?.[0] ?? "", "unit") ?? "millimeter"
    ] ?? 1;
  const objects = new Map<string, MeshObject>();
  const objectRe = /<object\b([^>]*)>([\s\S]*?)<\/object>/g;
  for (let m = objectRe.exec(xml); m; m = objectRe.exec(xml)) {
    const id = attrOf(m[1], "id");
    if (id === undefined) continue;
    const body = m[2];
    const v: number[] = [];
    const vRe = /<vertex\b([^>]*?)\/?>/g;
    for (let a = vRe.exec(body); a; a = vRe.exec(body))
      v.push(
        Number(attrOf(a[1], "x")),
        Number(attrOf(a[1], "y")),
        Number(attrOf(a[1], "z")),
      );
    const t: number[] = [];
    const paint = new Map<number, string>();
    const tRe = /<triangle\b([^>]*?)\/?>/g;
    for (let a = tRe.exec(body); a; a = tRe.exec(body)) {
      const tag = a[1];
      t.push(
        Number(attrOf(tag, "v1")),
        Number(attrOf(tag, "v2")),
        Number(attrOf(tag, "v3")),
      );
      const painted =
        attrOf(tag, "paint_color") ?? attrOf(tag, "slic3rpe:mmu_segmentation");
      if (painted) paint.set(t.length / 3 - 1, painted);
    }
    const components: MeshObject["components"] = [];
    const cRe = /<component\b([^>]*?)\/?>/g;
    for (let a = cRe.exec(body); a; a = cRe.exec(body)) {
      const cid = attrOf(a[1], "objectid");
      if (cid === undefined) continue;
      components.push({
        id: cid,
        path: attrOf(a[1], "p:path") ?? attrOf(a[1], "path"),
        transform: parseMatrix(attrOf(a[1], "transform")),
      });
    }
    objects.set(id, {
      name: xmlUnescape(attrOf(m[1], "name") ?? ""),
      vertices: Float64Array.from(v),
      triangles: Uint32Array.from(t),
      paint,
      components,
    });
  }
  const items: Model["items"] = [];
  const itemRe = /<item\b([^>]*?)\/?>/g;
  for (let a = itemRe.exec(xml); a; a = itemRe.exec(xml)) {
    const id = attrOf(a[1], "objectid");
    if (id !== undefined)
      items.push({ id, transform: parseMatrix(attrOf(a[1], "transform")) });
  }
  return { unit, objects, items };
}

/** Réglages des objets et des pièces (filament, type) écrits par le trancheur. */
interface ObjectSettings {
  filament: number;
  /** Bambu : par id du sous-objet ; Prusa : par plage de triangles. */
  parts: Map<string, { filament: number; printable: boolean; name: string }>;
  ranges: {
    first: number;
    last: number;
    filament: number;
    printable: boolean;
  }[];
}

const PRINTABLE_SUBTYPES = new Set(["", "normal_part", "ModelPart"]);

function metadataOf(body: string): Map<string, string> {
  const out = new Map<string, string>();
  const re = /<metadata\b([^>]*?)\/?>/g;
  for (let m = re.exec(body); m; m = re.exec(body)) {
    const key = attrOf(m[1], "key");
    const value = attrOf(m[1], "value");
    if (key !== undefined && value !== undefined) out.set(key, value);
  }
  return out;
}

/** Bambu Studio / OrcaSlicer (model_settings.config) et PrusaSlicer (Slic3r_PE_model.config). */
function parseSettings(xml: string | undefined): Map<string, ObjectSettings> {
  const out = new Map<string, ObjectSettings>();
  if (!xml) return out;
  const objectRe = /<object\b([^>]*)>([\s\S]*?)<\/object>/g;
  for (let m = objectRe.exec(xml); m; m = objectRe.exec(xml)) {
    const id = attrOf(m[1], "id");
    if (id === undefined) continue;
    const body = m[2];
    const settings: ObjectSettings = {
      filament: 0,
      parts: new Map(),
      ranges: [],
    };
    const volumeRe = /<(part|volume)\b([^>]*)>([\s\S]*?)<\/\1>/g;
    let stripped = body;
    for (let v = volumeRe.exec(body); v; v = volumeRe.exec(body)) {
      stripped = stripped.replace(v[0], "");
      const meta = metadataOf(v[3]);
      const filament = Number(meta.get("extruder") ?? 0) || 0;
      const subtype = attrOf(v[2], "subtype") ?? meta.get("volume_type") ?? "";
      const modifier = meta.get("modifier") === "1";
      const printable = PRINTABLE_SUBTYPES.has(subtype) && !modifier;
      if (v[1] === "part") {
        const partId = attrOf(v[2], "id");
        if (partId !== undefined)
          settings.parts.set(partId, {
            filament,
            printable,
            name: xmlUnescape(meta.get("name") ?? ""),
          });
      } else {
        const first = Number(attrOf(v[2], "firstid"));
        const last = Number(attrOf(v[2], "lastid"));
        if (Number.isFinite(first) && Number.isFinite(last))
          settings.ranges.push({ first, last, filament, printable });
      }
    }
    settings.filament = Number(metadataOf(stripped).get("extruder") ?? 0) || 0;
    out.set(id, settings);
  }
  return out;
}

/** « #RRGGBB » (alpha retiré), ou null. */
function hexColor(raw: string): string | null {
  const m = /^#?([0-9a-f]{6})/i.exec(raw.trim());
  return m ? `#${m[1].toUpperCase()}` : null;
}

/** Teintes des filaments : project_settings.config (JSON) ou Slic3r_PE.config (ini). */
function parseFilamentColors(
  bambu: string | undefined,
  prusa: string | undefined,
): string[] {
  if (bambu) {
    try {
      const json = JSON.parse(bambu) as Record<string, unknown>;
      const colors = json.filament_colour;
      if (Array.isArray(colors))
        return colors.map((c) => hexColor(String(c)) ?? "#FFFFFF");
    } catch {
      // Réglages illisibles : les teintes manquent, la peinture reste.
    }
  }
  if (prusa) {
    const read = (key: string) =>
      new RegExp(`^; ${key} = (.*)$`, "m")
        .exec(prusa)?.[1]
        ?.replace(/"/g, "")
        .split(";")
        .map((c) => hexColor(c));
    const extruder = read("extruder_colour");
    const filament = read("filament_colour");
    const length = Math.max(extruder?.length ?? 0, filament?.length ?? 0);
    return Array.from(
      { length },
      (_, i) => extruder?.[i] ?? filament?.[i] ?? "#FFFFFF",
    );
  }
  return [];
}

export async function read3mf(buffer: ArrayBuffer): Promise<LoadedMesh> {
  const files = await readZipEntries(buffer, (name) => {
    const lower = name.toLowerCase();
    return (
      lower.endsWith(".model") ||
      lower === "metadata/model_settings.config" ||
      lower === "metadata/slic3r_pe_model.config" ||
      lower === "metadata/project_settings.config" ||
      lower === "metadata/slic3r_pe.config"
    );
  });
  const find = (lower: string) =>
    [...files.keys()].find((k) => k.toLowerCase() === lower);
  const modelPaths = [...files.keys()].filter((k) =>
    k.toLowerCase().endsWith(".model"),
  );
  const mainPath = find("3d/3dmodel.model") ?? modelPaths[0];
  if (!mainPath) throw new Error("empty");
  const models = new Map<string, Model>();
  for (const path of modelPaths)
    models.set(path, parseModel(textOf(files.get(path))!));
  const main = models.get(mainPath)!;

  const bambuSettings = textOf(
    files.get(find("metadata/model_settings.config") ?? ""),
  );
  const prusaSettings = textOf(
    files.get(find("metadata/slic3r_pe_model.config") ?? ""),
  );
  const settings = parseSettings(bambuSettings ?? prusaSettings);
  const sliced = parseFilamentColors(
    textOf(files.get(find("metadata/project_settings.config") ?? "")),
    textOf(files.get(find("metadata/slic3r_pe.config") ?? "")),
  );
  // Un 3MF de l'atelier 3D porte ses teintes en métadonnée propre.
  const own = new RegExp(
    `<metadata name="(?:Kreya|Swiss3Design):FilamentColours">([^<]*)</metadata>`,
  ).exec(textOf(files.get(mainPath)) ?? "")?.[1];
  const filamentColors = sliced.length
    ? sliced
    : (own
        ?.split(";")
        .map((c) => hexColor(c))
        .filter((c): c is string => c !== null) ?? []);
  const producer: LoadedMesh["producer"] = bambuSettings
    ? "bambu"
    : prusaSettings
      ? "prusa"
      : "other";

  const positions: number[] = [];
  const parts: PaintPart[] = [];
  const partFilaments: number[] = [];
  const paint = new Map<number, PaintNode>();

  /**
   * Ajoute les triangles d'un objet maillé (ou d'une plage de triangles, pour
   * PrusaSlicer) comme une pièce, transformée en mm.
   */
  function addMesh(
    model: Model,
    object: MeshObject,
    matrix: Matrix,
    filament: number,
    name: string,
    range?: { first: number; last: number },
  ) {
    const scale = model.unit;
    const { vertices: v, triangles: t } = object;
    const first = Math.floor(positions.length / 9);
    const from = range ? range.first : 0;
    const to = range
      ? Math.min(range.last, t.length / 3 - 1)
      : t.length / 3 - 1;
    for (let i = from; i <= to; i++) {
      const a = t[i * 3] * 3;
      const b = t[i * 3 + 1] * 3;
      const c = t[i * 3 + 2] * 3;
      if (Math.max(a, b, c) + 2 >= v.length) continue;
      const index = Math.floor(positions.length / 9);
      for (const o of [a, b, c]) {
        const x = v[o] * scale;
        const y = v[o + 1] * scale;
        const z = v[o + 2] * scale;
        positions.push(
          x * matrix[0] + y * matrix[3] + z * matrix[6] + matrix[9] * scale,
          x * matrix[1] + y * matrix[4] + z * matrix[7] + matrix[10] * scale,
          x * matrix[2] + y * matrix[5] + z * matrix[8] + matrix[11] * scale,
        );
      }
      const painted = object.paint.get(i);
      if (painted) {
        const node = decodePaint(painted);
        if (node !== null && node !== 0) paint.set(index, node);
      }
    }
    const count = Math.floor(positions.length / 9) - first;
    if (count > 0) {
      parts.push({ name, first, count });
      partFilaments.push(filament);
    }
  }

  function walk(
    modelPath: string,
    id: string,
    matrix: Matrix,
    depth: number,
    owner: ObjectSettings | undefined,
    filament: number,
    name: string,
    /** `name` vient des réglages de la pièce (Bambu) : il l'emporte. */
    named = false,
  ) {
    const model = models.get(modelPath);
    const object = model?.objects.get(id);
    if (!model || !object || depth > 8) return;
    if (object.triangles.length > 0) {
      if (owner && owner.ranges.length > 0) {
        // PrusaSlicer : une plage de triangles par volume, dans un seul maillage.
        for (const range of owner.ranges)
          if (range.printable)
            addMesh(
              model,
              object,
              matrix,
              range.filament || filament,
              name,
              range,
            );
      } else
        addMesh(
          model,
          object,
          matrix,
          filament,
          named ? name : object.name || name,
        );
    }
    for (const component of object.components) {
      // Bambu Studio : chaque composant est une pièce, réglée par son id.
      const part = owner?.parts.get(component.id);
      if (part && !part.printable) continue;
      walk(
        component.path ? component.path.replace(/^\/+/, "") : modelPath,
        component.id,
        multiply(component.transform, matrix),
        depth + 1,
        undefined,
        part?.filament || filament,
        part?.name || name,
        Boolean(part?.name),
      );
    }
  }

  const items = main.items.length
    ? main.items
    : [...main.objects.keys()].map((id) => ({ id, transform: IDENTITY }));
  for (const item of items) {
    const owner = settings.get(item.id);
    walk(
      mainPath,
      item.id,
      item.transform,
      0,
      owner,
      owner?.filament ?? 0,
      main.objects.get(item.id)?.name ?? "",
    );
  }
  if (positions.length === 0) throw new Error("empty");
  return {
    positions: Float32Array.from(positions),
    parts,
    partFilaments,
    paint,
    filamentColors,
    producer,
  };
}

/** Triangles d'un STEP (Worker d'OpenCascade). */
export function readTriangles(positions: Float32Array): LoadedMesh {
  return empty(positions);
}

export type LoadableFormat = "stl" | "obj" | "3mf";

export async function readMesh(
  format: LoadableFormat,
  buffer: ArrayBuffer,
): Promise<LoadedMesh> {
  if (format === "stl") return readStl(buffer);
  if (format === "obj") return readObj(buffer);
  return read3mf(buffer);
}
