// Test de variété du Studio (brief « Strates », §6.3.5) : pour chaque objet,
// 200 configurations aléatoires valides (graine fixe) en LOD `export` : chaque
// coque est fermée et orientée (arêtes partagées par exactement 2 triangles
// opposés), aucun triangle d'aire < 1e-6 mm², volume signé > 0, boîte dans
// 250³ mm. Plus : `writeBinaryStl` produit exactement 84 + 50 × n octets, un
// en-tête qui ne commence pas par « solid », des normales unitaires.
//
// WP-01 couvre le vase Lavaux ; WP-02 ajoute les trois autres objets au même
// fichier (même mécanique, même graine).
import { describe, expect, it } from "vitest";
import { buildStudioMesh, exportStl } from "./build";
import { checkManifold, meshVolume } from "./kernel/mesh";
import { mulberry32 } from "./kernel/rng";
import { buildLavaux } from "./objects/lavaux";
import { HERO_CONFIG, LAVAUX_PRESETS, heroVariant } from "./presets";
import { randomLavaux } from "./testing";
import { STL_MAX_TRIANGLES, stlHeader, writeBinaryStl } from "./stl";

describe("Lavaux : variété du maillage d'export", () => {
  it("200 configurations aléatoires : coque fermée, orientée, volume > 0, boîte ≤ 250³", () => {
    const rng = mulberry32(20260930);
    for (let i = 0; i < 200; i++) {
      const config = randomLavaux(rng);
      const mesh = buildLavaux(config, { lod: "export" });
      const report = checkManifold(mesh);
      const label = `#${i} ${JSON.stringify(config)}`;
      expect(report.closed, `${label} : ${JSON.stringify(report)}`).toBe(true);
      expect(report.components, label).toBe(1);
      expect(report.degenerateTriangles, label).toBe(0);
      expect(meshVolume(mesh), label).toBeGreaterThan(0);
      expect(report.componentVolumes[0], label).toBeGreaterThan(0);
      const [x0, y0, z0, x1, y1, z1] = mesh.bbox;
      expect(x1 - x0, label).toBeLessThanOrEqual(250);
      expect(y1 - y0, label).toBeLessThanOrEqual(250);
      expect(z1 - z0, label).toBeLessThanOrEqual(250);
      expect(z0, label).toBeCloseTo(0, 6);
      expect(z1, label).toBeCloseTo(config.h, 4);
      expect(mesh.triangles, label).toBeLessThanOrEqual(STL_MAX_TRIANGLES);
    }
  }, 240_000);

  it("les trois niveaux de détail et les préréglages sont tous des coques fermées", () => {
    const configs = [
      HERO_CONFIG,
      heroVariant("molasse", "vagues"),
      heroVariant("signal", "voronoi"),
      heroVariant("uni", "gradins"),
      ...LAVAUX_PRESETS.map((p) => p.config),
    ];
    for (const config of configs) {
      for (const lod of ["drag", "display", "export"] as const) {
        const mesh = buildLavaux(config, { lod });
        const report = checkManifold(mesh);
        expect(report.closed, `${lod} ${JSON.stringify(config.pattern)}`).toBe(
          true,
        );
        expect(report.components).toBe(1);
        expect(report.degenerateTriangles).toBe(0);
      }
    }
  });

  it("éclaté : une coque fermée par bande, jamais dans l'export", () => {
    const mesh = buildLavaux(HERO_CONFIG, {
      lod: "display",
      tier: 1,
      separateBands: true,
    });
    // Les coques se touchent aux frontières (anneaux dupliqués) : le Stage les
    // écarte de 12 mm par groupe ; on fait pareil avant de tester la variété.
    const spread = { ...mesh, positions: mesh.positions.slice() };
    for (const g of mesh.groups) {
      for (let i = g.start; i < g.start + g.count; i++) {
        spread.positions[mesh.indices[i] * 3 + 2] =
          mesh.positions[mesh.indices[i] * 3 + 2] + g.band * 12;
      }
    }
    const report = checkManifold(spread);
    expect(report.closed).toBe(true);
    expect(report.components).toBe(3);
    expect(report.componentVolumes.every((v) => v > 0)).toBe(true);
    expect(mesh.triangles).toBeLessThanOrEqual(45_000);
    // L'export ignore `separateBands` : une seule coque.
    const exported = buildLavaux(HERO_CONFIG, {
      lod: "export",
      separateBands: true,
    });
    expect(checkManifold(exported).components).toBe(1);
  });

  it("budgets de triangles : C2 ≈ 115 k, C1 ≈ 38 k, export ≤ 200 k", () => {
    const c2 = buildLavaux(HERO_CONFIG, { lod: "display", tier: 2 });
    const c1 = buildLavaux(HERO_CONFIG, { lod: "display", tier: 1 });
    expect(c2.triangles).toBeGreaterThan(90_000);
    expect(c2.triangles).toBeLessThanOrEqual(125_000);
    expect(c1.triangles).toBeGreaterThan(30_000);
    expect(c1.triangles).toBeLessThanOrEqual(42_000);
    const heavy = buildLavaux(heroVariant("leman", "voronoi"), {
      lod: "export",
    });
    expect(heavy.triangles).toBeLessThanOrEqual(STL_MAX_TRIANGLES);
  });

  it("normales unitaires et attribut side 0/1 ; groupes qui couvrent tous les index", () => {
    const mesh = buildLavaux(HERO_CONFIG, { lod: "display", tier: 1 });
    for (let i = 0; i < mesh.normals.length; i += 3) {
      const len = Math.hypot(
        mesh.normals[i],
        mesh.normals[i + 1],
        mesh.normals[i + 2],
      );
      expect(Math.abs(len - 1)).toBeLessThan(1e-4);
    }
    expect(mesh.side).toBeTruthy();
    const sides = new Set(mesh.side);
    expect([...sides].sort()).toEqual([0, 1]);
    let covered = 0;
    let expectedStart = 0;
    for (const g of mesh.groups) {
      expect(g.start).toBe(expectedStart);
      expect(g.count % 3).toBe(0);
      expectedStart += g.count;
      covered += g.count;
    }
    expect(covered).toBe(mesh.indices.length);
    expect(mesh.groups.map((g) => g.band)).toEqual([0, 1, 2]);
  });
});

describe("Lavaux : déterminisme", () => {
  it("même entrée, mêmes octets (maillage et STL)", () => {
    const rng = mulberry32(99);
    for (let i = 0; i < 6; i++) {
      const config = randomLavaux(rng);
      const a = buildLavaux(config, { lod: "export" });
      const b = buildLavaux(structuredClone(config), { lod: "export" });
      // Comparaison d'octets (`equals`) : `toEqual` sur des Mo de Buffer est très lent.
      expect(
        Buffer.from(a.positions.buffer).equals(Buffer.from(b.positions.buffer)),
      ).toBe(true);
      expect(
        Buffer.from(a.indices.buffer).equals(Buffer.from(b.indices.buffer)),
      ).toBe(true);
      expect(
        Buffer.from(a.normals.buffer).equals(Buffer.from(b.normals.buffer)),
      ).toBe(true);
    }
    const s1 = exportStl(HERO_CONFIG);
    const s2 = exportStl(structuredClone(HERO_CONFIG));
    expect(Buffer.from(s1.buffer).equals(Buffer.from(s2.buffer))).toBe(true);
    expect(s1.hash).toBe(s2.hash);
    expect(s1.fileName).toBe(`s3d-lavaux-${s1.hash}.stl`);
  });

  it("un autre réglage donne une autre empreinte", () => {
    const other = { ...HERO_CONFIG, h: 151 };
    expect(exportStl(other).hash).not.toBe(exportStl(HERO_CONFIG).hash);
  });
});

describe("STL binaire", () => {
  it("84 + 50 × n octets, en-tête sans « solid », normales unitaires", () => {
    const stl = exportStl(HERO_CONFIG);
    expect(stl.bytes).toBe(84 + 50 * stl.triangles);
    expect(stl.buffer.byteLength).toBe(stl.bytes);
    const bytes = new Uint8Array(stl.buffer);
    const header = new TextDecoder("ascii").decode(bytes.slice(0, 80));
    expect(header.startsWith("solid")).toBe(false);
    expect(header.startsWith("Swiss3Design Studio v1 lavaux ")).toBe(true);
    expect(header.endsWith(" ")).toBe(true);
    expect(header).toHaveLength(80);
    const view = new DataView(stl.buffer);
    expect(view.getUint32(80, true)).toBe(stl.triangles);
    for (let t = 0; t < stl.triangles; t += 97) {
      const o = 84 + 50 * t;
      const len = Math.hypot(
        view.getFloat32(o, true),
        view.getFloat32(o + 4, true),
        view.getFloat32(o + 8, true),
      );
      expect(Math.abs(len - 1)).toBeLessThan(1e-4);
      expect(view.getUint16(o + 48, true)).toBe(0);
    }
  });

  it("refuse un en-tête « solid » et un maillage au-delà du plafond", () => {
    const mesh = buildStudioMesh(HERO_CONFIG, {}, { lod: "drag" });
    expect(() => writeBinaryStl(mesh, "solid oups")).toThrow(/solid/);
    expect(() => writeBinaryStl(mesh, "  Solid oups")).toThrow(/solid/);
    expect(stlHeader("lavaux", "abcd1234")).toHaveLength(80);
    const tooMany = { ...mesh, triangles: STL_MAX_TRIANGLES + 1 };
    expect(() => writeBinaryStl(tooMany, "ok")).toThrow(/trop lourd/);
  });

  it("les normales d'un triangle suivent le sens trigonométrique (sortantes)", () => {
    const stl = exportStl({ ...HERO_CONFIG, pattern: { kind: "lisse" } });
    const view = new DataView(stl.buffer);
    // Premier triangle du fond : son plan est z = 0 et sa normale pointe vers le bas,
    // car le solide est au-dessus.
    let found = 0;
    for (let t = 0; t < stl.triangles && found < 5; t++) {
      const o = 84 + 50 * t;
      const z = [
        view.getFloat32(o + 20, true),
        view.getFloat32(o + 32, true),
        view.getFloat32(o + 44, true),
      ];
      if (z.every((v) => v === 0)) {
        expect(view.getFloat32(o + 8, true)).toBeCloseTo(-1, 4);
        found++;
      }
    }
    expect(found).toBeGreaterThan(0);
  });
});
