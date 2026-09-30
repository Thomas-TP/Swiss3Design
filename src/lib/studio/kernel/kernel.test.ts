// Tests du noyau géométrique (brief « Strates », §6.3.2) : PRNG, empreintes,
// bruits, cubique monotone, constructeur de maillage et test de variété,
// Douglas–Peucker, extrusion de polygones avec trous.
import { describe, expect, it } from "vitest";
import { canonicalJson, fnv1a32, fnv1a64, hash8 } from "./hash";
import { MeshBuilder, checkManifold, mergeMeshes, meshArea, meshVolume } from "./mesh";
import { monotoneCubic, smootherstep, smoothstep } from "./monotone";
import {
  createPeriodicNoise2,
  createSimplex,
  fbm2,
  periodicFbm2,
} from "./noise";
import { intBetween, mulberry32, shuffled } from "./rng";
import { simplifyClosed, simplifyPolyline, type Vec2 } from "./simplify";
import {
  classifyRings,
  extrudePolygon,
  polygonArea,
  ringArea,
} from "./extrude";

describe("mulberry32", () => {
  it("rejoue la même suite pour la même graine, sur tout moteur", () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    const seq = Array.from({ length: 8 }, () => a());
    expect(Array.from({ length: 8 }, () => b())).toEqual(seq);
    // Valeurs de référence (mulberry32 canonique) : figent la suite pour
    // toujours, sinon un changement de PRNG casserait les liens partagés.
    expect(seq[0]).toBeCloseTo(0.9797282677609473, 12);
    expect(seq[1]).toBeCloseTo(0.3067522644996643, 12);
  });

  it("reste dans [0, 1) et varie", () => {
    const rng = mulberry32(7);
    const values = Array.from({ length: 2000 }, () => rng());
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThan(1);
    expect(new Set(values).size).toBeGreaterThan(1990);
  });

  it("intBetween inclut les deux bornes, shuffled garde les éléments", () => {
    const rng = mulberry32(3);
    const seen = new Set(Array.from({ length: 400 }, () => intBetween(rng, 2, 5)));
    expect([...seen].sort()).toEqual([2, 3, 4, 5]);
    expect(shuffled(mulberry32(9), [1, 2, 3, 4, 5]).sort()).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("empreintes FNV-1a", () => {
  it("fnv1a32 : vecteurs de référence", () => {
    expect(fnv1a32("")).toBe(0x811c9dc5);
    expect(fnv1a32("a")).toBe(0xe40c292c);
    expect(fnv1a32("foobar")).toBe(0xbf9cf968);
  });

  it("fnv1a64 : vecteurs de référence", () => {
    expect(fnv1a64("")).toBe("cbf29ce484222325");
    expect(fnv1a64("a")).toBe("af63dc4c8601ec8c");
    expect(fnv1a64("foobar")).toBe("85944171f73967e8");
  });

  it("travaille sur des octets UTF-8, pas des unités UTF-16", () => {
    expect(fnv1a32("é")).not.toBe(fnv1a32("e"));
    expect(fnv1a32("😀")).toBe(fnv1a32("😀"));
  });

  it("JSON canonique : indépendant de l'ordre des clés", () => {
    expect(canonicalJson({ b: 1, a: { d: [1, { y: 2, x: 1 }], c: undefined } })).toBe(
      '{"a":{"d":[1,{"x":1,"y":2}]},"b":1}',
    );
    expect(hash8({ a: 1, b: 2 })).toBe(hash8({ b: 2, a: 1 }));
    expect(hash8({ a: 1 })).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe("bruits", () => {
  it("simplex : déterministe par graine, borné, non constant", () => {
    const a = createSimplex(42);
    const b = createSimplex(42);
    const c = createSimplex(43);
    let differs = false;
    let max = 0;
    for (let i = 0; i < 300; i++) {
      const x = i * 0.137;
      const y = i * 0.091 - 5;
      const v = a.noise2(x, y);
      expect(v).toBe(b.noise2(x, y));
      if (v !== c.noise2(x, y)) differs = true;
      max = Math.max(max, Math.abs(v), Math.abs(a.noise3(x, y, x - y)));
    }
    expect(differs).toBe(true);
    expect(max).toBeLessThanOrEqual(1.05);
    expect(max).toBeGreaterThan(0.4);
  });

  it("FBM : normalisé dans [-1, 1]", () => {
    const s = createSimplex(1);
    for (let i = 0; i < 200; i++) {
      const v = fbm2(s.noise2, i * 0.31, i * 0.17);
      expect(Math.abs(v)).toBeLessThanOrEqual(1.05);
    }
  });

  it("bruit périodique : exactement périodique, octaves comprises", () => {
    const n = createPeriodicNoise2(5);
    for (let i = 0; i < 50; i++) {
      const x = i * 0.41 + 0.13;
      const y = i * 0.23 + 0.07;
      expect(periodicFbm2(n, x + 6, y, 6, 4)).toBeCloseTo(periodicFbm2(n, x, y, 6, 4), 9);
      expect(periodicFbm2(n, x, y + 4, 6, 4)).toBeCloseTo(periodicFbm2(n, x, y, 6, 4), 9);
    }
  });
});

describe("cubique monotone", () => {
  it("passe par les points de contrôle et ne dépasse jamais", () => {
    const xs = [0, 0.2, 0.5, 0.8, 1];
    const ys = [0.66, 0.92, 1, 0.9, 0.72];
    const curve = monotoneCubic(xs, ys);
    xs.forEach((x, i) => expect(curve.value(x)).toBeCloseTo(ys[i], 12));
    for (let i = 0; i <= 1000; i++) {
      const v = curve.value(i / 1000);
      expect(v).toBeLessThanOrEqual(1 + 1e-9);
      expect(v).toBeGreaterThanOrEqual(0.66 - 1e-9);
    }
  });

  it("la pente analytique suit la valeur (différences finies)", () => {
    const curve = monotoneCubic([0, 0.2, 0.5, 0.8, 1], [0.6, 0.9, 1, 0.8, 0.7]);
    for (const t of [0.05, 0.3, 0.45, 0.65, 0.9]) {
      const e = 1e-6;
      const fd = (curve.value(t + e) - curve.value(t - e)) / (2 * e);
      expect(curve.slope(t)).toBeCloseTo(fd, 4);
    }
  });

  it("lissages de Hermite", () => {
    expect(smootherstep(0)).toBe(0);
    expect(smootherstep(1)).toBe(1);
    expect(smootherstep(0.5)).toBeCloseTo(0.5, 12);
    expect(smoothstep(2, 4, 3)).toBeCloseTo(0.5, 12);
    expect(smoothstep(2, 4, 9)).toBe(1);
  });
});

function cubeMesh() {
  const b = new MeshBuilder(8, 12);
  const v = [
    b.addVertex(0, 0, 0, 0, 0, -1),
    b.addVertex(1, 0, 0, 0, 0, -1),
    b.addVertex(1, 1, 0, 0, 0, -1),
    b.addVertex(0, 1, 0, 0, 0, -1),
    b.addVertex(0, 0, 1, 0, 0, 1),
    b.addVertex(1, 0, 1, 0, 0, 1),
    b.addVertex(1, 1, 1, 0, 0, 1),
    b.addVertex(0, 1, 1, 0, 0, 1),
  ];
  // Sens trigonométrique vu de l'extérieur.
  b.addQuad(v[0], v[3], v[2], v[1]); // bas
  b.addQuad(v[4], v[5], v[6], v[7]); // haut
  b.addQuad(v[0], v[1], v[5], v[4]); // y = 0
  b.addQuad(v[1], v[2], v[6], v[5]); // x = 1
  b.addQuad(v[2], v[3], v[7], v[6]); // y = 1
  b.addQuad(v[3], v[0], v[4], v[7]); // x = 0
  return b.build();
}

describe("maillage : constructeur et test de variété", () => {
  it("un cube est fermé, orienté, de volume 1 et d'aire 6", () => {
    const m = cubeMesh();
    const r = checkManifold(m);
    expect(r).toMatchObject({
      closed: true,
      openEdges: 0,
      nonManifoldEdges: 0,
      orientationErrors: 0,
      degenerateTriangles: 0,
      components: 1,
    });
    expect(meshVolume(m)).toBeCloseTo(1, 9);
    expect(meshArea(m)).toBeCloseTo(6, 9);
    expect(m.bbox).toEqual([0, 0, 0, 1, 1, 1]);
    expect(m.triangles).toBe(12);
  });

  it("détecte un trou, un triangle retourné et un triangle dégénéré", () => {
    const m = cubeMesh();
    const open = { ...m, indices: m.indices.slice(0, m.indices.length - 3) };
    expect(checkManifold(open).closed).toBe(false);
    expect(checkManifold(open).openEdges).toBeGreaterThan(0);

    const flipped = { ...m, indices: m.indices.slice() };
    const [a, b] = [flipped.indices[0], flipped.indices[1]];
    flipped.indices[0] = b;
    flipped.indices[1] = a;
    expect(checkManifold(flipped).orientationErrors).toBeGreaterThan(0);

    const flat = new MeshBuilder();
    const p0 = flat.addVertex(0, 0, 0, 0, 0, 1);
    const p1 = flat.addVertex(1, 0, 0, 0, 0, 1);
    const p2 = flat.addVertex(2, 0, 0, 0, 0, 1);
    flat.addTriangle(p0, p1, p2);
    expect(checkManifold(flat.build()).degenerateTriangles).toBe(1);
  });

  it("fusion de coques : deux cubes donnent deux composantes", () => {
    const a = cubeMesh();
    const moved = cubeMesh();
    for (let i = 0; i < moved.positions.length; i += 3) moved.positions[i] += 5;
    const merged = mergeMeshes([a, moved]);
    expect(merged.triangles).toBe(24);
    const r = checkManifold(merged);
    expect(r.closed).toBe(true);
    expect(r.components).toBe(2);
    expect(r.componentVolumes.every((v) => Math.abs(v - 1) < 1e-6)).toBe(true);
  });

  it("groupes par bande : contigus, en unités d'index", () => {
    const b = new MeshBuilder();
    const v = [0, 1, 2, 3].map((i) => b.addVertex(i, 0, 0, 0, 0, 1));
    b.addTriangle(v[0], v[1], v[2], 1);
    b.addTriangle(v[0], v[2], v[3], 0);
    b.addTriangle(v[1], v[2], v[3], 1);
    const m = b.build();
    expect(m.groups).toEqual([
      { start: 0, count: 3, band: 0 },
      { start: 3, count: 6, band: 1 },
    ]);
  });
});

describe("Douglas–Peucker", () => {
  it("garde les extrémités et supprime les points alignés", () => {
    const line: Vec2[] = Array.from({ length: 50 }, (_, i) => [i, 0.001 * (i % 2)]);
    const s = simplifyPolyline(line, 0.01);
    expect(s).toEqual([
      [0, 0],
      [49, 0.001],
    ]);
  });

  it("contour fermé : le cercle reste un cercle à la tolérance près", () => {
    const n = 720;
    const ring: Vec2[] = Array.from({ length: n }, (_, i) => [
      50 * Math.cos((i * 2 * Math.PI) / n),
      50 * Math.sin((i * 2 * Math.PI) / n),
    ]);
    const s = simplifyClosed(ring, 0.15);
    expect(s.length).toBeLessThan(120);
    expect(s.length).toBeGreaterThan(20);
    for (const p of s) expect(Math.abs(Math.hypot(p[0], p[1]) - 50)).toBeLessThan(0.15);
    expect(Math.abs(ringArea(s) - Math.PI * 2500) / (Math.PI * 2500)).toBeLessThan(0.01);
  });
});

function square(x: number, y: number, s: number): Vec2[] {
  return [
    [x, y],
    [x + s, y],
    [x + s, y + s],
    [x, y + s],
  ];
}

describe("extrusion de polygones avec trous", () => {
  it("plaque avec un trou : coque fermée, volume = aire × épaisseur", () => {
    const b = new MeshBuilder();
    const poly = { outer: square(0, 0, 20), holes: [square(5, 5, 6)] };
    extrudePolygon(b, poly, 0, 2);
    const m = b.build();
    const r = checkManifold(m);
    expect(r.closed).toBe(true);
    expect(r.components).toBe(1);
    expect(meshVolume(m)).toBeCloseTo((400 - 36) * 2, 4);
    expect(polygonArea(poly)).toBeCloseTo(364, 9);
  });

  it("accepte les contours dans n'importe quel sens", () => {
    const b = new MeshBuilder();
    extrudePolygon(b, { outer: square(0, 0, 10).reverse(), holes: [square(2, 2, 3)] }, 1, 3);
    const m = b.build();
    expect(checkManifold(m).closed).toBe(true);
    expect(meshVolume(m)).toBeCloseTo((100 - 9) * 2, 4);
  });

  it("classe les contours par inclusion : îlot dans un trou redevient un extérieur", () => {
    const rings = [square(0, 0, 30), square(5, 5, 20), square(10, 10, 10), square(40, 0, 5)];
    const polys = classifyRings(rings);
    expect(polys).toHaveLength(3);
    const withHole = polys.find((p) => (p.holes ?? []).length === 1);
    expect(withHole).toBeTruthy();
    const b = new MeshBuilder();
    for (const p of polys) extrudePolygon(b, p, 0, 1);
    const m = b.build();
    expect(checkManifold(m).closed).toBe(true);
    // 900 − 400 + 100 + 25
    expect(meshVolume(m)).toBeCloseTo(625, 4);
  });

  it("z1 ≤ z0 est refusé", () => {
    expect(() => extrudePolygon(new MeshBuilder(), { outer: square(0, 0, 1) }, 1, 1)).toThrow();
  });
});
