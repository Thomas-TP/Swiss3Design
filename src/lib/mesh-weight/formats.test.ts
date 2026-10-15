import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { estimateFromMesh } from "./estimate";
import {
  meshFormatOf,
  parse3mf,
  parseMesh,
  parseObj,
  parseStl,
} from "./formats";

// Cube de 20 mm : V = 8000 mm³, A = 2400 mm². Poids du Studio : coque
// min(8000, 2400 × 0,8) = 1920, puis + 15 % de 6080 = 2832 mm³ imprimés, soit
// 2832 / 1000 × 1,24 = 3,51 g, arrondis à 4 g.
const SIZE = 20;
const CORNERS: [number, number, number][] = [
  [0, 0, 0],
  [1, 0, 0],
  [1, 1, 0],
  [0, 1, 0],
  [0, 0, 1],
  [1, 0, 1],
  [1, 1, 1],
  [0, 1, 1],
];
// 12 triangles, normales vers l'extérieur.
const FACES: [number, number, number][] = [
  [0, 2, 1],
  [0, 3, 2],
  [4, 5, 6],
  [4, 6, 7],
  [0, 1, 5],
  [0, 5, 4],
  [1, 2, 6],
  [1, 6, 5],
  [2, 3, 7],
  [2, 7, 6],
  [3, 0, 4],
  [3, 4, 7],
];
const at = (i: number, scale: number) =>
  CORNERS[i].map((c) => c * scale) as [number, number, number];

function binaryStl(scale = SIZE): ArrayBuffer {
  const buffer = new ArrayBuffer(84 + FACES.length * 50);
  const view = new DataView(buffer);
  view.setUint32(80, FACES.length, true);
  FACES.forEach((face, f) => {
    let o = 84 + f * 50 + 12;
    for (const corner of face)
      for (const value of at(corner, scale)) {
        view.setFloat32(o, value, true);
        o += 4;
      }
  });
  return buffer;
}

function asciiStl(scale = SIZE): ArrayBuffer {
  const lines = ["solid cube"];
  for (const face of FACES) {
    lines.push("facet normal 0 0 0", "outer loop");
    for (const corner of face)
      lines.push(`vertex ${at(corner, scale).join(" ")}`);
    lines.push("endloop", "endfacet");
  }
  lines.push("endsolid cube");
  return new TextEncoder().encode(lines.join("\n")).buffer as ArrayBuffer;
}

function obj(scale = SIZE, negative = false): ArrayBuffer {
  const lines = ["# cube"];
  for (let i = 0; i < 8; i++) lines.push(`v ${at(i, scale).join(" ")}`);
  for (const [a, b, c] of FACES)
    lines.push(
      negative
        ? `f ${a - 8}/1/1 ${b - 8}/1/1 ${c - 8}/1/1`
        : `f ${a + 1}//1 ${b + 1}//1 ${c + 1}//1`,
    );
  return new TextEncoder().encode(lines.join("\n")).buffer as ArrayBuffer;
}

// ── 3MF : une archive ZIP minimale (stockée ou « deflate ») ──────────────────
function zip(files: Record<string, string>, deflate: boolean): ArrayBuffer {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const raw = Buffer.from(content, "utf8");
    const data = deflate ? deflateRawSync(raw) : raw;
    const nameBytes = Buffer.from(name, "utf8");
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(deflate ? 8 : 0, 8);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    parts.push(local, nameBytes, data);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(deflate ? 8 : 0, 10);
    entry.writeUInt32LE(data.length, 20);
    entry.writeUInt32LE(raw.length, 24);
    entry.writeUInt16LE(nameBytes.length, 28);
    entry.writeUInt32LE(offset, 42);
    central.push(entry, nameBytes);
    offset += local.length + nameBytes.length + data.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  const all = Buffer.concat([...parts, directory, end]);
  return all.buffer.slice(
    all.byteOffset,
    all.byteOffset + all.length,
  ) as ArrayBuffer;
}

function meshXml(id: string, scale: number): string {
  const vertices = CORNERS.map(
    (c) =>
      `<vertex x="${c[0] * scale}" y="${c[1] * scale}" z="${c[2] * scale}"/>`,
  ).join("");
  const triangles = FACES.map(
    ([a, b, c]) => `<triangle v1="${a}" v2="${b}" v3="${c}"/>`,
  ).join("");
  return `<object id="${id}" type="model"><mesh><vertices>${vertices}</vertices><triangles>${triangles}</triangles></mesh></object>`;
}

const model = (unit: string, objects: string, build: string) =>
  `<?xml version="1.0"?><model unit="${unit}" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06"><resources>${objects}</resources><build>${build}</build></model>`;

describe("STL, OBJ : volume et surface d'un cube de 20 mm", () => {
  it("STL binaire", () => {
    const s = parseStl(binaryStl())!;
    expect(s.volumeMm3).toBeCloseTo(8000, 3);
    expect(s.areaMm2).toBeCloseTo(2400, 3);
    expect(s.triangles).toBe(12);
    expect(s.bbox).toEqual([0, 0, 0, 20, 20, 20]);
  });
  it("STL ASCII", () => {
    const s = parseStl(asciiStl())!;
    expect(s.volumeMm3).toBeCloseTo(8000, 3);
    expect(s.areaMm2).toBeCloseTo(2400, 3);
  });
  it("OBJ, indices positifs puis négatifs", () => {
    expect(parseObj(obj())!.volumeMm3).toBeCloseTo(8000, 3);
    expect(parseObj(obj(SIZE, true))!.volumeMm3).toBeCloseTo(8000, 3);
  });
  it("un fichier qui n'est pas un maillage rend null", () => {
    expect(
      parseStl(new TextEncoder().encode("rien").buffer as ArrayBuffer),
    ).toBeNull();
    expect(
      parseObj(new TextEncoder().encode("# vide").buffer as ArrayBuffer),
    ).toBeNull();
  });
  it("une normale inversée ne change pas le volume (valeur absolue)", () => {
    const flipped = binaryStl();
    const view = new DataView(flipped);
    for (let f = 0; f < FACES.length; f++) {
      const o = 84 + f * 50 + 12;
      for (let k = 0; k < 3; k++) {
        const b = view.getFloat32(o + 12 + k * 4, true);
        view.setFloat32(
          o + 12 + k * 4,
          view.getFloat32(o + 24 + k * 4, true),
          true,
        );
        view.setFloat32(o + 24 + k * 4, b, true);
      }
    }
    expect(parseStl(flipped)!.volumeMm3).toBeCloseTo(8000, 3);
  });
});

describe("3MF", () => {
  const main = "3D/3dmodel.model";
  it("archive stockée et archive « deflate », unité en millimètres", async () => {
    const xml = model("millimeter", meshXml("1", SIZE), '<item objectid="1"/>');
    for (const deflate of [false, true]) {
      const s = (await parse3mf(zip({ [main]: xml }, deflate)))!;
      expect(s.volumeMm3).toBeCloseTo(8000, 3);
      expect(s.areaMm2).toBeCloseTo(2400, 3);
    }
  });
  it("convertit l'unité du modèle (centimètres → millimètres)", async () => {
    const xml = model("centimeter", meshXml("1", 2), '<item objectid="1"/>');
    const s = (await parse3mf(zip({ [main]: xml }, true)))!;
    expect(s.volumeMm3).toBeCloseTo(8000, 3);
  });
  it("applique la transformation de l'élément (échelle ×2 : volume ×8)", async () => {
    const xml = model(
      "millimeter",
      meshXml("1", SIZE),
      '<item objectid="1" transform="2 0 0 0 2 0 0 0 2 5 5 5"/>',
    );
    const s = (await parse3mf(zip({ [main]: xml }, false)))!;
    expect(s.volumeMm3).toBeCloseTo(64000, 2);
    expect(s.bbox[0]).toBeCloseTo(5, 6);
  });
  it("suit les composants, même dans un autre fichier .model (extension de production)", async () => {
    const part = model("millimeter", meshXml("7", SIZE), "");
    const assembly = model(
      "millimeter",
      '<object id="1"><components><component objectid="7" p:path="/3D/Objects/part.model"/><component objectid="7" p:path="/3D/Objects/part.model" transform="1 0 0 0 1 0 0 0 1 50 0 0"/></components></object>',
      '<item objectid="1"/>',
    );
    const s = (await parse3mf(
      zip({ [main]: assembly, "3D/Objects/part.model": part }, true),
    ))!;
    expect(s.volumeMm3).toBeCloseTo(16000, 3);
    expect(s.bbox[3]).toBeCloseTo(70, 6);
  });
  it("sans élément de construction, tous les objets comptent ; archive illisible : erreur", async () => {
    const xml = model(
      "millimeter",
      meshXml("1", SIZE) + meshXml("2", SIZE),
      "",
    );
    expect(
      (await parse3mf(zip({ [main]: xml }, false)))!.volumeMm3,
    ).toBeCloseTo(16000, 3);
    await expect(parse3mf(new ArrayBuffer(10))).rejects.toThrow("zip");
  });
});

describe("estimateFromMesh : la physique du Studio", () => {
  it("cube de 20 mm : 4 g (coque 0,8 mm + remplissage 15 %, PLA 1,24 g/cm³)", () => {
    const e = estimateFromMesh(parseStl(binaryStl())!);
    expect(e).toEqual({ grams: 4, issue: null, blocking: false });
  });
  it("un cube plus petit que 2 mm est bloqué : l'unité est probablement fausse", () => {
    const e = estimateFromMesh(parseStl(binaryStl(1))!);
    expect(e).toMatchObject({ issue: "tiny", blocking: true });
  });
  it("un maillage vide est bloqué", () => {
    expect(
      estimateFromMesh({
        volumeMm3: 0,
        areaMm2: 0,
        bbox: [0, 0, 0, 0, 0, 0],
        triangles: 0,
      }),
    ).toMatchObject({ issue: "empty", blocking: true });
  });
  it("un volume plus grand que la boîte englobante est plafonné, pas bloqué", () => {
    const e = estimateFromMesh({
      volumeMm3: 50_000,
      areaMm2: 2400,
      bbox: [0, 0, 0, 20, 20, 20],
      triangles: 12,
    });
    expect(e).toMatchObject({ issue: "overlap", blocking: false, grams: 4 });
  });
});

describe("meshFormatOf / parseMesh", () => {
  it("reconnaît les extensions, sans tenir compte de la casse", () => {
    expect(meshFormatOf("Piece.STL")).toBe("stl");
    expect(meshFormatOf("a.b.3mf")).toBe("3mf");
    expect(meshFormatOf("modele.step")).toBeNull();
  });
  it("distribue par format", async () => {
    expect((await parseMesh("stl", binaryStl()))!.triangles).toBe(12);
  });
});
