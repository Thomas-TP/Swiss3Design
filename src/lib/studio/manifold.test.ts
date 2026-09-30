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
import type { LavauxConfig, MeshData } from "./types";
import { STL_MAX_TRIANGLES, stlHeader, writeBinaryStl } from "./stl";

/**
 * Éclaté d'affichage : les coques de bandes se touchent aux frontières (anneaux
 * dupliqués) ; le Stage les écarte de 12 mm par groupe. On fait pareil avant de
 * vérifier que chaque bande est une coque fermée et orientée.
 */
function spreadByBand(mesh: MeshData) {
  const positions = mesh.positions.slice();
  for (const g of mesh.groups) {
    for (let i = g.start; i < g.start + g.count; i++) {
      positions[mesh.indices[i] * 3 + 2] =
        mesh.positions[mesh.indices[i] * 3 + 2] + g.band * 12;
    }
  }
  return checkManifold({ ...mesh, positions });
}
describe("Lavaux : variété du maillage d'export", () => {
  it("200 configurations aléatoires : coque fermée, orientée, volume > 0, boîte ≤ 250³", () => {
    const rng = mulberry32(20260930);
    for (let i = 0; i < 200; i++) {
      const config = randomLavaux(rng);
      const mesh = buildLavaux(config, { lod: "export" });
      const report = checkManifold(mesh);
      const label = `#${i} ${JSON.stringify(config)}`;
      expect(report.closed, `${label} : ${JSON.stringify(report)}`).toBe(true);
      expect(report.components, `${label}`).toBe(1);
      expect(report.degenerateTriangles, `${label}`).toBe(0);
      expect(meshVolume(mesh), `${label}`).toBeGreaterThan(0);
      expect(report.componentVolumes[0], `${label}`).toBeGreaterThan(0);
      const [x0, y0, z0, x1, y1, z1] = mesh.bbox;
      expect(x1 - x0, `${label}`).toBeLessThanOrEqual(250);
      expect(y1 - y0, `${label}`).toBeLessThanOrEqual(250);
      expect(z1 - z0, `${label}`).toBeLessThanOrEqual(250);
      expect(z0, `${label}`).toBeCloseTo(0, 6);
      expect(z1, `${label}`).toBeCloseTo(config.h, 4);
      expect(mesh.triangles, `${label}`).toBeLessThanOrEqual(STL_MAX_TRIANGLES);
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
    // écarte de 12 mm par groupe ; spreadByBand fait pareil avant le test de variété.
    const report = spreadByBand(mesh);
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

  it("frontières de bande posées sur un retrait de gradin, sur le sommet d'une rampe ou près du plancher", () => {
    const aligned = {
      ...HERO_CONFIG,
      // 40 et 105 sont des multiples du pas (5 mm) : frontière ET corniche au même z.
      bands: [
        { filament: "rouge-signal", toMm: 40 },
        { filament: "encre", toMm: 105 },
        { filament: "blanc-neve", toMm: 150 },
      ],
    } as LavauxConfig;
    const nearFloor = {
      ...HERO_CONFIG,
      bands: [
        { filament: "ambre", toMm: 2 },
        { filament: "glacier", toMm: 4.2 },
        { filament: "blanc-neve", toMm: 150 },
      ],
    } as LavauxConfig;
    for (const config of [aligned, nearFloor]) {
      for (const lod of ["drag", "display", "export"] as const) {
        const mesh = buildLavaux(config, { lod });
        const report = checkManifold(mesh);
        expect(report.closed, `${lod} ${JSON.stringify(config.bands)}`).toBe(
          true,
        );
        expect(report.components).toBe(1);
        expect(report.degenerateTriangles).toBe(0);
      }
      const split = buildLavaux(config, {
        lod: "display",
        tier: 1,
        separateBands: true,
      });
      expect(spreadByBand(split).closed).toBe(true);
      expect(spreadByBand(split).components).toBe(3);
    }
  });

  it("60 vases aléatoires en affichage C1 et C2, éclatés par bande : coques fermées", () => {
    const rng = mulberry32(8080);
    const configs = Array.from({ length: 60 }, () => randomLavaux(rng));
    configs.forEach((config, i) => {
      for (const tier of [1, 2] as const) {
        const mesh = buildLavaux(config, { lod: "display", tier });
        const report = checkManifold(mesh);
        expect(report.closed, `#${i} C${tier} ${JSON.stringify(config)}`).toBe(
          true,
        );
        expect(report.components).toBe(1);
      }
    });
    // Éclaté : seulement les vases à plusieurs bandes (une coque fermée par bande).
    const multi = configs
      .map((config, i) => ({ config, i }))
      .filter(({ config }) => config.bands.length > 1);
    expect(multi.length).toBeGreaterThan(20);
    for (const { config, i } of multi) {
      const split = spreadByBand(
        buildLavaux(config, { lod: "display", tier: 1, separateBands: true }),
      );
      expect(split.closed, `#${i} éclaté ${JSON.stringify(config.bands)}`).toBe(
        true,
      );
      expect(split.components).toBe(config.bands.length);
      expect(split.componentVolumes.every((v) => v > 0)).toBe(true);
    }
  }, 120_000);

  it("budgets de triangles : C2 ≈ 115 k, C1 ≈ 38 k, export ≤ 200 k", () => {
    const c2 = buildLavaux(HERO_CONFIG, { lod: "display", tier: 2 });
    const c1 = buildLavaux(HERO_CONFIG, { lod: "display", tier: 1 });
    expect(c2.triangles).toBeGreaterThan(90_000);
    expect(c2.triangles).toBeLessThanOrEqual(125_000);
    expect(c1.triangles).toBeGreaterThan(30_000);
    expect(c1.triangles).toBeLessThanOrEqual(42_000);
    // Cible du brief : 1 à 3 Mo de STL (≈ 20 000 à 60 000 triangles) pour le héros.
    const hero = buildLavaux(HERO_CONFIG, { lod: "export" });
    expect(84 + 50 * hero.triangles).toBeLessThan(3_000_000);
    expect(84 + 50 * hero.triangles).toBeGreaterThan(1_000_000);
    const heavy = buildLavaux(heroVariant("leman", "voronoi"), {
      lod: "export",
    });
    expect(heavy.triangles).toBeLessThanOrEqual(STL_MAX_TRIANGLES);
  });

  it("les normales de sommet suivent le sens des triangles (héros, préréglages, 20 vases aléatoires)", () => {
    // Cosinus entre la normale géométrique d'un triangle et la moyenne de ses
    // normales de sommet : un signe inversé éclairerait le vase à l'envers.
    // Statistique (moyenne haute, presque aucun triangle négatif) : sur un relief
    // très marqué (voronoï 2,2 mm, nervures torsadées) quelques triangles de
    // flanc s'écartent de plus de 90° de la normale lissée, sans inversion.
    const agreement = (mesh: MeshData) => {
      const p = mesh.positions;
      const n = mesh.normals;
      const ix = mesh.indices;
      let sum = 0;
      let negative = 0;
      let counted = 0;
      for (let t = 0; t < ix.length; t += 3) {
        const a = ix[t] * 3;
        const b = ix[t + 1] * 3;
        const c = ix[t + 2] * 3;
        const ux = p[b] - p[a];
        const uy = p[b + 1] - p[a + 1];
        const uz = p[b + 2] - p[a + 2];
        const vx = p[c] - p[a];
        const vy = p[c + 1] - p[a + 1];
        const vz = p[c + 2] - p[a + 2];
        const gx = uy * vz - uz * vy;
        const gy = uz * vx - ux * vz;
        const gz = ux * vy - uy * vx;
        const gl = Math.hypot(gx, gy, gz);
        if (gl < 1e-9) continue;
        const sx = n[a] + n[b] + n[c];
        const sy = n[a + 1] + n[b + 1] + n[c + 1];
        const sz = n[a + 2] + n[b + 2] + n[c + 2];
        const sl = Math.hypot(sx, sy, sz) || 1;
        const cos = (gx * sx + gy * sy + gz * sz) / (gl * sl);
        sum += cos;
        if (cos < 0) negative++;
        counted++;
      }
      return { mean: sum / counted, negativeShare: negative / counted };
    };
    const rng = mulberry32(5150);
    const configs = [
      HERO_CONFIG,
      heroVariant("leman", "vagues"),
      heroVariant("leman", "voronoi"),
      ...LAVAUX_PRESETS.map((p) => p.config),
      ...Array.from({ length: 20 }, () => randomLavaux(rng)),
    ];
    for (const config of configs) {
      for (const lod of ["display", "export"] as const) {
        const { mean, negativeShare } = agreement(buildLavaux(config, { lod }));
        expect(
          mean,
          `${lod} ${JSON.stringify(config.pattern)}`,
        ).toBeGreaterThan(0.95);
        expect(
          negativeShare,
          `${lod} ${JSON.stringify(config.pattern)}`,
        ).toBeLessThan(0.001);
      }
    }
  }, 120_000);
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
    const bottomNormalsZ: number[] = [];
    for (let t = 0; t < stl.triangles && bottomNormalsZ.length < 5; t++) {
      const o = 84 + 50 * t;
      const z = [
        view.getFloat32(o + 20, true),
        view.getFloat32(o + 32, true),
        view.getFloat32(o + 44, true),
      ];
      if (z.every((v) => v === 0))
        bottomNormalsZ.push(view.getFloat32(o + 8, true));
    }
    expect(bottomNormalsZ.length).toBeGreaterThan(0);
    for (const nz of bottomNormalsZ) expect(nz).toBeCloseTo(-1, 4);
  });
});
