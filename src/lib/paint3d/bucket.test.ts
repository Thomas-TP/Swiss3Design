import { describe, expect, it } from "vitest";
import {
  bucketRegion,
  forEachSelectedLeaf,
  inSelection,
  leafAt,
  paintSelection,
  selectionSize,
} from "./bucket";
import { PaintDocument } from "./document";
import { cubePositions, gridPositions } from "./fixtures";
import { forEachLeaf, isSplit } from "./selector";
import { paintStats } from "./stats";
import { paintSphere } from "./tools";

const ZONE = { sameColor: true, angle: 30 };

/** Aire peinte de chaque état (feuilles), en mm². */
function areaByState(doc: PaintDocument): Map<number, number> {
  const out = new Map<number, number>();
  for (let t = 0; t < doc.triangleCount; t++) {
    const area = doc.topology.areas[t];
    forEachLeaf(doc.node(t), doc.corners(t), (_c, state, share) =>
      out.set(state, (out.get(state) ?? 0) + area * share),
    );
  }
  return out;
}

/** Nombre de feuilles d'un état sur toute la pièce. */
function leavesOf(doc: PaintDocument, state: number): number {
  let n = 0;
  for (let t = 0; t < doc.triangleCount; t++)
    forEachLeaf(doc.node(t), doc.corners(t), (_c, s) => {
      if (s === state) n++;
    });
  return n;
}

function spot(
  doc: PaintDocument,
  center: [number, number, number],
  radius: number,
  state: number,
) {
  doc.beginStep();
  paintSphere(doc, center, { state, radius, facing: null });
  doc.endStep();
}

describe("remplissage « Zone » (feuilles, à la manière de Bambu Studio)", () => {
  it("cube non peint : un clic prend la face entière, pas plus", () => {
    const doc = new PaintDocument({ positions: cubePositions(10) });
    const region = bucketRegion(doc, 2, 0, ZONE);
    expect([...region.triangles.keys()].sort((a, b) => a - b)).toEqual([2, 3]);
    expect(region.triangles.get(2)).toBeNull();
    // Sans limite d'angle : toute la pièce.
    const all = bucketRegion(doc, 2, 0, { sameColor: true, angle: null });
    expect(all.triangles.size).toBe(12);
  });

  it("une tache peinte se reprend exactement, sans déborder", () => {
    const doc = new PaintDocument({ positions: gridPositions(6, 2) });
    spot(doc, [6, 6, 0], 2.5, 2);
    const before = areaByState(doc);
    // Feuille de la tache sous son centre.
    const hit = [6, 6, 0] as [number, number, number];
    let seed = -1;
    for (let t = 0; t < doc.triangleCount && seed < 0; t++) {
      const c = doc.corners(t);
      const xs = [c[0], c[3], c[6]];
      const ys = [c[1], c[4], c[7]];
      if (
        Math.min(...xs) <= 6 &&
        Math.max(...xs) >= 6 &&
        Math.min(...ys) <= 6 &&
        Math.max(...ys) >= 6
      )
        seed = t;
    }
    const leaf = leafAt(doc, seed, hit);
    const region = bucketRegion(doc, seed, leaf, ZONE);
    expect(region.seedState).toBe(2);
    expect(selectionSize(doc, region)).toBe(leavesOf(doc, 2));
    // Recolorer la zone : la tache change de couleur, le reste ne bouge pas.
    doc.beginStep();
    paintSelection(doc, region, 3);
    doc.endStep();
    const after = areaByState(doc);
    expect(after.get(2) ?? 0).toBe(0);
    expect(after.get(3)).toBeCloseTo(before.get(2)!, 6);
    expect(after.get(0)).toBeCloseTo(before.get(0)!, 6);
  });

  it("le fond autour d'une tache reste d'un seul tenant (sous-triangles de tailles différentes)", () => {
    const doc = new PaintDocument({ positions: gridPositions(6, 2) });
    // Deux pinceaux de tailles différentes : des voisins coupés plus ou moins finement.
    spot(doc, [5, 5, 0], 1.2, 2);
    spot(doc, [7.5, 6, 0], 0.6, 2);
    let split = 0;
    for (let t = 0; t < doc.triangleCount; t++) if (doc.isSplit(t)) split++;
    expect(split).toBeGreaterThan(2);
    // Un coin non peint : le remplissage atteint toutes les feuilles non peintes.
    const region = bucketRegion(doc, 0, 0, ZONE);
    expect(region.seedState).toBe(0);
    expect(selectionSize(doc, region)).toBe(leavesOf(doc, 0));
    // Aucune feuille de la tache n'y entre.
    let painted = 0;
    for (let t = 0; t < doc.triangleCount; t++) {
      let i = 0;
      forEachLeaf(doc.node(t), doc.corners(t), (_c, state) => {
        if (state === 2 && inSelection(region, t, i)) painted++;
        i++;
      });
    }
    expect(painted).toBe(0);
  });

  it("deux taches de la même couleur restent deux zones", () => {
    const doc = new PaintDocument({ positions: gridPositions(8, 2) });
    spot(doc, [3, 3, 0], 1.5, 2);
    spot(doc, [13, 13, 0], 1.5, 2);
    const total = leavesOf(doc, 2);
    let seed = -1;
    let leaf = -1;
    for (let t = 0; t < doc.triangleCount && seed < 0; t++) {
      if (!doc.isSplit(t)) continue;
      let i = 0;
      forEachLeaf(doc.node(t), doc.corners(t), (c, state) => {
        if (seed < 0 && state === 2 && c[0] < 8) {
          seed = t;
          leaf = i;
        }
        i++;
      });
    }
    const region = bucketRegion(doc, seed, leaf, ZONE);
    const size = selectionSize(doc, region);
    expect(size).toBeGreaterThan(0);
    expect(size).toBeLessThan(total);
    // Toutes ses feuilles sont du côté de la première tache.
    forEachSelectedLeaf(doc, region, (c) => {
      expect((c[0] + c[3] + c[6]) / 3).toBeLessThan(8);
    });
  });

  it("une arête vive arrête la zone même sur une couleur identique", () => {
    const doc = new PaintDocument({ positions: cubePositions(10) });
    // Toute la pièce en 2, puis un clic : seule la face touchée.
    doc.beginStep();
    for (let t = 0; t < 12; t++) doc.setNode(t, 2);
    doc.endStep();
    const region = bucketRegion(doc, 4, 0, ZONE);
    expect(region.triangles.size).toBe(2);
    // Sans angle : la couleur seule décide (toute la pièce).
    expect(
      bucketRegion(doc, 4, 0, { sameColor: true, angle: null }).triangles.size,
    ).toBe(12);
  });

  it("la base non peinte (0) et la base peinte (1) sont la même couleur", () => {
    const doc = new PaintDocument({ positions: gridPositions(2, 1) });
    doc.beginStep();
    doc.setNode(0, 1);
    doc.endStep();
    const region = bucketRegion(doc, 0, 0, ZONE);
    expect(region.triangles.size).toBe(8);
  });

  it("leafAt trouve la feuille sous le point", () => {
    const doc = new PaintDocument({ positions: gridPositions(4, 2) });
    spot(doc, [4, 4, 0], 1.5, 3);
    for (let t = 0; t < doc.triangleCount; t++) {
      if (!isSplit(doc.node(t))) continue;
      let i = 0;
      forEachLeaf(doc.node(t), doc.corners(t), (c, state) => {
        const center: [number, number, number] = [
          (c[0] + c[3] + c[6]) / 3,
          (c[1] + c[4] + c[7]) / 3,
          (c[2] + c[5] + c[8]) / 3,
        ];
        expect(leafAt(doc, t, center)).toBe(i);
        expect(state).toBeGreaterThanOrEqual(0);
        i++;
      });
    }
    // Le bilan reste cohérent après un remplissage.
    expect(paintStats(doc, 4).totalArea).toBeCloseTo(64, 6);
  });
});
