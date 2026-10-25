import { describe, expect, it } from "vitest";
import { buildBvh, queryBvhSphere, raycastBvh } from "./bvh";
import { PaintDocument, quarterTurn, rotationBetween } from "./document";
import { cubePositions, gridPositions } from "./fixtures";
import { mapFileFilaments, nearestColor, printedPalette } from "./palette";
import {
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

  it("un filament du fichier = un emplacement, même si deux ont la même couleur du stock", () => {
    const mapping = mapFileFilaments(
      [
        { filament: 1, area: 100, hex: "#FFFFFF" },
        { filament: 2, area: 50, hex: "#111111" },
        { filament: 3, area: 10, hex: "#EEEEEE" },
        { filament: 4, area: 30, hex: "#D0302A" },
      ],
      stock,
    )!;
    // Blanc et gris très clair tombent sur « white » : deux zones quand même.
    expect(mapping.refs).toEqual(["white", "black", "white", "red"]);
    expect([1, 2, 3, 4].map((f) => mapping.stateOf.get(f))).toEqual([
      1, 2, 3, 4,
    ]);
    expect(mapping.merged).toBe(false);
  });

  it("au-delà de quatre filaments, les moins présents rejoignent la teinte la plus proche", () => {
    const mapping = mapFileFilaments(
      [
        { filament: 1, area: 100, hex: "#FFFFFF" },
        { filament: 2, area: 50, hex: "#111111" },
        { filament: 3, area: 5, hex: "#EEEEEE" },
        { filament: 4, area: 30, hex: "#D0302A" },
        { filament: 6, area: 20, hex: "#3050C0" },
      ],
      stock,
    )!;
    expect(mapping.refs).toHaveLength(4);
    expect(mapping.merged).toBe(true);
    // Le gris clair (filament 3) rejoint le blanc (filament 1, emplacement 1).
    expect(mapping.stateOf.get(3)).toBe(1);
    expect(mapping.stateOf.get(6)).toBe(4);
  });

  it("couleurs imprimées : doublons réunis, une seule couleur = tout au filament 1", () => {
    const printed = printedPalette(["white", "red", "white", "blue"], true);
    expect(printed.refs).toEqual(["white", "red", "blue"]);
    expect(printed.states.slice(0, 6)).toEqual([0, 1, 2, 1, 3, 0]);
    const single = printedPalette(["white", "red"], false);
    expect(single.refs).toEqual(["white"]);
    expect(single.states.slice(0, 4)).toEqual([0, 0, 0, 0]);
  });

  it("retirer une couleur rend ses zones à la base, et « Annuler » les rend", () => {
    const doc = new PaintDocument({
      positions: cubePositions(10),
      palette: [
        { ref: "white", origin: null },
        { ref: "red", origin: "#FF0000" },
        { ref: "blue", origin: null },
      ],
    });
    doc.beginStep();
    paintTriangles(doc, [2, 3], 2);
    paintTriangles(doc, [4, 5], 3);
    // Une tache sur la face de droite (triangles 8 et 9) : des feuilles.
    paintSphere(doc, [10, 5, 5], { state: 2, radius: 2, facing: null });
    doc.endStep();
    const painted = Array.from({ length: 12 }, (_, t) => doc.node(t));
    doc.removeSlot(1);
    expect(doc.palette.map((p) => p.ref)).toEqual(["white", "blue"]);
    expect(doc.node(2)).toBe(0);
    expect(doc.node(4)).toBe(2);
    expect(doc.undo()).toBe(true);
    expect(doc.palette.map((p) => p.ref)).toEqual(["white", "red", "blue"]);
    for (let t = 0; t < 12; t++) expect(doc.node(t)).toEqual(painted[t]);
    expect(doc.redo()).toBe(true);
    expect(doc.palette).toHaveLength(2);
    // Changer une couleur : une étape, sans toucher aux zones.
    doc.setPalette([
      { ref: "black", origin: null },
      { ref: "blue", origin: null },
    ]);
    expect(doc.node(4)).toBe(2);
    expect(doc.undo()).toBe(true);
    expect(doc.palette[0].ref).toBe("white");
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

  it("retrouve les zones et les couleurs d'un 3MF de l'atelier", async () => {
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
    // Les zones du fichier sont en place d'office, hors de l'historique.
    for (let t = 0; t < 24; t++) expect(opened.doc.node(t)).toBe(doc.node(t));
    expect(opened.doc.canUndo()).toBe(false);
  });

  it("l'export réunit deux emplacements de même couleur", async () => {
    const doc = new PaintDocument({ positions: cubePositions(10) });
    doc.beginStep();
    paintTriangles(doc, [2, 3], 2);
    paintTriangles(doc, [4, 5], 3);
    doc.endStep();
    const { states } = printedPalette(["white", "red", "red"], true);
    const blob = await write3mf(doc, { title: "Doublon", states });
    const loaded = await read3mf(await blob.arrayBuffer());
    expect(loaded.paint.get(2)).toBe(2);
    expect(loaded.paint.get(4)).toBe(2);
    // Une seule couleur : aucune peinture écrite.
    const plain = await write3mf(doc, {
      title: "Uni",
      states: printedPalette(["white", "red"], false).states,
    });
    expect((await read3mf(await plain.arrayBuffer())).paint.size).toBe(0);
  });

  it("résume le projet et le relit côté serveur", () => {
    const doc = new PaintDocument({ positions: cubePositions(10) });
    doc.beginStep();
    paintTriangles(doc, [2, 3], 2);
    doc.endStep();
    doc.setTransform(quarterTurn("x", 1), 1.5);
    expect(projectMatters(doc, ["white", "red"], true)).toBe(true);
    const summary = projectSummary(doc, ["white", "red"], true, "painted");
    expect(summary.size).toEqual([15, 15, 15]);
    expect(summary.rotated).toBe(true);
    expect(summary.colors.map((c) => c.ref)).toEqual(["white", "red"]);
    expect(summary.colors[1].share).toBeCloseTo(1 / 6, 2);
    expect(parseColorProject(JSON.stringify(summary))).toEqual(summary);
    expect(parseColorProject("{}")).toBeNull();
    expect(parseColorProject("pas du json")).toBeNull();
    const preview = paintedPreview(doc);
    expect(preview.states.length).toBe(12);
    // Une seule couleur : la peinture reste dans l'atelier, le résumé n'en a qu'une.
    const single = projectSummary(doc, ["white", "red"], false, "painted");
    expect(single.colors.map((c) => c.ref)).toEqual(["white"]);
    expect(single.changes).toBe(0);
    // Deux emplacements de même couleur : une seule couleur imprimée.
    const twins = projectSummary(doc, ["red", "red"], true, "painted");
    expect(twins.colors).toEqual([{ ref: "red", share: 1 }]);
    expect(projectMatters(doc, ["red", "red"], true)).toBe(true); // tournée

    expect(
      Math.min(...preview.positions.filter((_, i) => i % 3 === 2)),
    ).toBeCloseTo(0);
  });
});
