import { describe, expect, it } from "vitest";
import { buildBvh, queryBvhSphere, raycastBvh } from "./bvh";
import { PaintDocument, quarterTurn, rotationBetween } from "./document";
import { cubePositions, gridPositions } from "./fixtures";
import { mapFileFilaments, nearestColor, paletteRemap } from "./palette";
import {
  applyFilePaint,
  openProject,
  paintedPreview,
  projectMatters,
  projectSummary,
} from "./project";
import { read3mf } from "./read";
import { isSplit, leafCount } from "./selector";
import { paintStats } from "./stats";
import { parseColorProject } from "./summary";
import {
  fillRegion,
  paintHeightRange,
  paintSphere,
  paintTriangles,
  pointTriangleDistance2,
} from "./tools";
import { buildTopology } from "./topology";
import { write3mf } from "./write3mf";

describe("BVH", () => {
  const grid = gridPositions(40, 1);

  it("trouve le même premier triangle que la force brute", () => {
    const bvh = buildBvh(grid);
    for (const [x, y] of [
      [0.3, 0.7],
      [12.25, 30.6],
      [39.9, 0.05],
    ]) {
      const hit = raycastBvh(bvh, grid, [x, y, 5], [0, 0, -1]);
      expect(hit).not.toBeNull();
      const t = hit!.triangle;
      const o = t * 9;
      const xs = [grid[o], grid[o + 3], grid[o + 6]];
      const ys = [grid[o + 1], grid[o + 4], grid[o + 7]];
      expect(x).toBeGreaterThanOrEqual(Math.min(...xs));
      expect(x).toBeLessThanOrEqual(Math.max(...xs));
      expect(y).toBeGreaterThanOrEqual(Math.min(...ys));
      expect(y).toBeLessThanOrEqual(Math.max(...ys));
      expect(hit!.t).toBeCloseTo(5, 6);
    }
    expect(raycastBvh(bvh, grid, [50, 50, 5], [0, 0, -1])).toBeNull();
  });

  it("écarte un impact refusé (plan de coupe) et garde le suivant", () => {
    const cube = cubePositions(10);
    const bvh = buildBvh(cube);
    const top = raycastBvh(bvh, cube, [5, 5, 20], [0, 0, -1]);
    expect(top!.point[2]).toBeCloseTo(10);
    const below = raycastBvh(
      bvh,
      cube,
      [5, 5, 20],
      [0, 0, -1],
      (_x, _y, z) => z < 9,
    );
    expect(below!.point[2]).toBeCloseTo(0);
  });

  it("donne au moins tous les triangles qui touchent la sphère", () => {
    const bvh = buildBvh(grid);
    const found = new Set<number>();
    queryBvhSphere(bvh, 10, 10, 0, 2.5, (t) => found.add(t));
    const touching: number[] = [];
    for (let t = 0; t < grid.length / 9; t++)
      if (
        pointTriangleDistance2(grid.subarray(t * 9, t * 9 + 9), 10, 10, 0) <=
        6.25
      )
        touching.push(t);
    expect(touching.length).toBeGreaterThan(10);
    expect(touching.filter((t) => !found.has(t))).toEqual([]);
  });
});

describe("topologie", () => {
  it("soude les sommets du cube et relie chaque triangle à trois voisins", () => {
    const topology = buildTopology(cubePositions());
    expect(topology.vertexCount).toBe(8);
    expect(Array.from(topology.neighbours).every((n) => n >= 0)).toBe(true);
    expect(topology.areas.reduce((a, b) => a + b, 0)).toBeCloseTo(600);
  });
});

describe("outils de peinture", () => {
  it("le pinceau coupe un grand triangle pour un trait rond", () => {
    const doc = new PaintDocument({ positions: cubePositions(20) });
    doc.beginStep();
    // Centre du dessus (z = 20), rayon 3 mm : le grand triangle est découpé.
    const changed = paintSphere(doc, [10, 10, 20], {
      state: 2,
      radius: 3,
      facing: [0, 0, 1],
    });
    expect(doc.endStep()).toBe(true);
    expect(changed).toBeGreaterThan(0);
    // Dessus = triangles 2 et 3 du cube.
    expect(doc.isSplit(2) || doc.isSplit(3)).toBe(true);
    // Le dessous (tourné à l'opposé de la caméra) n'est pas touché.
    expect(doc.node(0)).toBe(0);
    const stats = paintStats(doc);
    // ≈ π·3² = 28 mm² peints, à la découpe près.
    expect(stats.areaBySlot[1]).toBeGreaterThan(18);
    expect(stats.areaBySlot[1]).toBeLessThan(45);
  });

  it("annule et rétablit un trait", () => {
    const doc = new PaintDocument({ positions: cubePositions() });
    doc.beginStep();
    paintTriangles(doc, [0, 1], 3);
    doc.endStep();
    expect(doc.node(0)).toBe(3);
    expect(doc.undo()).toBe(true);
    expect(doc.node(0)).toBe(0);
    expect(doc.redo()).toBe(true);
    expect(doc.node(1)).toBe(3);
    expect(doc.canRedo()).toBe(false);
  });

  it("remplit une face plane sans passer l'arête vive", () => {
    const doc = new PaintDocument({ positions: cubePositions() });
    const region = fillRegion(doc, 2, "smooth", 30);
    expect(Array.from(region).sort()).toEqual([2, 3]);
    expect(fillRegion(doc, 2, "part", 30)).toHaveLength(12);
    doc.beginStep();
    paintTriangles(doc, region, 2);
    doc.endStep();
    expect(
      Array.from(fillRegion(doc, 4, "color", 180)).sort((a, b) => a - b),
    ).toEqual([0, 1, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it("peint une bande de hauteur nette, même sur de grands triangles", () => {
    const doc = new PaintDocument({ positions: cubePositions(20) });
    doc.beginStep();
    paintHeightRange(doc, 10, Infinity, 2, 0.5);
    doc.endStep();
    const stats = paintStats(doc);
    // Moitié haute : dessus (400) + moitié des 4 côtés (4 × 200).
    expect(stats.areaBySlot[1]).toBeGreaterThan(1150);
    expect(stats.areaBySlot[1]).toBeLessThan(1250);
    expect(doc.node(2)).toBe(2);
    expect(isSplit(doc.node(4))).toBe(true);
    // Deux couleurs empilées : un seul changement de filament.
    expect(stats.changes).toBe(1);
  });

  it("pose la pièce sur le plateau après une rotation", () => {
    const doc = new PaintDocument({ positions: cubePositions(10) });
    doc.setTransform(quarterTurn("x", 1), 2);
    const bounds = doc.worldBounds();
    expect(bounds.size.map((v) => Math.round(v))).toEqual([20, 20, 20]);
    expect(bounds.min[2]).toBe(0);
    expect(
      doc
        .toModel(...doc.toWorld(1, 2, 3))
        .map((v) => Math.round(v * 1e6) / 1e6),
    ).toEqual([1, 2, 3]);
    expect(doc.undo()).toBe(true);
    expect(doc.scale).toBe(1);
    const flip = rotationBetween([0, 0, 1], [0, 0, -1]);
    expect(Math.round(flip[8])).toBe(-1);
  });
});

describe("palette", () => {
  const stock = [
    { id: "white", hexes: ["#FFFFFF"] },
    { id: "black", hexes: ["#000000"] },
    { id: "red", hexes: ["#C12E1F"] },
    { id: "rainbow", hexes: ["#FF0000", "#00FF00", "#0000FF"] },
  ];

  it("prend la teinte unie la plus proche", () => {
    expect(nearestColor("#F2F2F2", stock)?.id).toBe("white");
    expect(nearestColor("#FF0000", stock)?.id).toBe("red");
  });

  it("fusionne au-delà de quatre couleurs et garde l'ordre des filaments", () => {
    const mapping = mapFileFilaments(
      [
        { filament: 1, area: 100, hex: "#FFFFFF" },
        { filament: 2, area: 50, hex: "#111111" },
        { filament: 3, area: 10, hex: "#EEEEEE" },
        { filament: 4, area: 30, hex: "#D0302A" },
      ],
      stock,
    )!;
    expect(mapping.refs).toEqual(["white", "black", "red"]);
    expect(mapping.stateOf.get(3)).toBe(1);
    expect(mapping.stateOf.get(4)).toBe(3);
    expect(mapping.merged).toBe(true);
  });

  it("renumérote les états quand la palette change", () => {
    expect(paletteRemap(["a", "b", "c"], ["c", "a"])).toEqual([0, 2, 0, 1]);
  });
});

describe("export 3MF", () => {
  it("relit la peinture, la taille et les pièces qu'il écrit", async () => {
    const positions = new Float32Array([
      ...cubePositions(10),
      ...cubePositions(5),
    ]);
    const doc = new PaintDocument({
      positions,
      parts: [
        { name: "Grand", first: 0, count: 12 },
        { name: "Petit", first: 12, count: 12 },
      ],
    });
    doc.beginStep();
    paintTriangles(doc, [2, 3], 2);
    paintSphere(doc, [5, 0, 5], { state: 4, radius: 2, facing: null });
    doc.endStep();
    doc.setTransform(quarterTurn("z", 1), 1.5);
    const blob = await write3mf(doc, {
      title: "Cube & co",
      now: new Date(2026, 9, 16),
    });
    const loaded = await read3mf(await blob.arrayBuffer());
    expect(loaded.parts.map((p) => [p.name, p.count])).toEqual([
      ["Grand", 12],
      ["Petit", 12],
    ]);
    expect(loaded.positions.length).toBe(positions.length);
    // Posé au centre du plateau, à la taille choisie.
    let minZ = Infinity;
    let maxX = -Infinity;
    let minX = Infinity;
    for (let i = 0; i < loaded.positions.length; i += 3) {
      minZ = Math.min(minZ, loaded.positions[i + 2]);
      maxX = Math.max(maxX, loaded.positions[i]);
      minX = Math.min(minX, loaded.positions[i]);
    }
    expect(minZ).toBeCloseTo(0);
    expect((minX + maxX) / 2).toBeCloseTo(128);
    expect(maxX - minX).toBeCloseTo(15);
    // Même peinture, triangle par triangle.
    for (let t = 0; t < doc.triangleCount; t++) {
      const expected = doc.node(t);
      expect(loaded.paint.get(t) ?? 0).toEqual(expected);
    }
    expect(
      [...loaded.paint.values()].some((n) => isSplit(n) && leafCount(n) > 1),
    ).toBe(true);
  });
});

describe("projet de couleurs (fichier ↔ atelier)", () => {
  const stock = [
    { id: "white", hexes: ["#F4EFEB"] },
    { id: "red", hexes: ["#C12E1F"] },
    { id: "blue", hexes: ["#39699E"] },
  ];

  it("retrouve les couleurs d'un 3MF de l'atelier, proposées puis appliquées", async () => {
    const positions = new Float32Array([
      ...cubePositions(10),
      ...cubePositions(4),
    ]);
    const doc = new PaintDocument({
      positions,
      parts: [
        { name: "Corps", first: 0, count: 12 },
        { name: "Bouton", first: 12, count: 12 },
      ],
    });
    doc.beginStep();
    paintTriangles(doc, [2, 3], 2);
    paintTriangles(
      doc,
      Array.from({ length: 12 }, (_, i) => 12 + i),
      3,
    );
    doc.endStep();
    const blob = await write3mf(doc, {
      title: "Projet",
      colors: ["#F4EFEB", "#C12E1F", "#39699E"],
    });
    const opened = await openProject(
      { format: "3mf", buffer: await blob.arrayBuffer() },
      stock,
      4,
    );
    expect(opened.fileRefs).toEqual(["white", "red", "blue"]);
    // Le document s'ouvre d'une couleur ; la peinture du fichier attend.
    expect(opened.doc.node(2)).toBe(0);
    applyFilePaint(opened.doc, opened.filePaint!);
    for (let t = 0; t < 24; t++) expect(opened.doc.node(t)).toBe(doc.node(t));
    expect(opened.doc.undo()).toBe(true);
    expect(opened.doc.node(2)).toBe(0);
  });

  it("résume le projet et le relit côté serveur", () => {
    const doc = new PaintDocument({ positions: cubePositions(10) });
    doc.beginStep();
    paintTriangles(doc, [2, 3], 2);
    doc.endStep();
    doc.setTransform(quarterTurn("x", 1), 1.5);
    expect(projectMatters(doc, ["white", "red"])).toBe(true);
    const summary = projectSummary(doc, ["white", "red"], "painted");
    expect(summary.size).toEqual([15, 15, 15]);
    expect(summary.rotated).toBe(true);
    expect(summary.colors.map((c) => c.ref)).toEqual(["white", "red"]);
    expect(summary.colors[1].share).toBeCloseTo(1 / 6, 2);
    expect(parseColorProject(JSON.stringify(summary))).toEqual(summary);
    expect(parseColorProject("{}")).toBeNull();
    expect(parseColorProject("pas du json")).toBeNull();
    const preview = paintedPreview(doc);
    expect(preview.states.length).toBe(12);
    expect(
      Math.min(...preview.positions.filter((_, i) => i % 3 === 2)),
    ).toBeCloseTo(0);
  });
});
