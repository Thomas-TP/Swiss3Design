import { describe, expect, it } from "vitest";
import {
  accumulateShares,
  collapse,
  decodePaint,
  encodePaint,
  forEachLeaf,
  leafCount,
  remapNode,
  splitCorners,
  splitRule,
  type PaintNode,
} from "./selector";

describe("format de peinture des trancheurs", () => {
  it("écrit les feuilles comme Bambu Studio (filament 1 → 4, 3 → 0C)", () => {
    expect(encodePaint(0)).toBe("");
    expect(encodePaint(1)).toBe("4");
    expect(encodePaint(2)).toBe("8");
    expect(encodePaint(3)).toBe("0C");
    expect(encodePaint(4)).toBe("1C");
    expect(encodePaint(5)).toBe("2C");
    // 3 + 15 + 2 : un quartet 0b1111 par tranche de 15.
    expect(encodePaint(20)).toBe("2FC");
  });

  it("relit ce qu'il écrit, arbres compris", () => {
    const trees: PaintNode[] = [
      1,
      4,
      20,
      { s: 3, k: 0, c: [1, 2, 0, 4] },
      { s: 1, k: 2, c: [{ s: 2, k: 1, c: [3, 0, 1] }, 2] },
      { s: 2, k: 0, c: [0, { s: 3, k: 0, c: [1, 1, 2, 5] }, 1] },
    ];
    for (const tree of trees)
      expect(decodePaint(encodePaint(tree))).toEqual(tree);
  });

  it("écrit les enfants du dernier au premier, quartets inversés", () => {
    // Nœud 3 côtés (quartet 3), enfants 3..0 = 8, 4, 4, 4 → « 44483 ».
    expect(encodePaint({ s: 3, k: 0, c: [1, 1, 1, 2] })).toBe("44483");
    expect(decodePaint("44483")).toEqual({ s: 3, k: 0, c: [1, 1, 1, 2] });
  });

  it("refuse une chaîne malformée (minuscules, tronquée, côté impossible)", () => {
    expect(decodePaint("c")).toBeNull();
    expect(decodePaint("4G")).toBeNull();
    expect(decodePaint("3")).toBeNull(); // enfants manquants
    expect(decodePaint("C")).toBeNull(); // état long sans suite
    expect(decodePaint("444F")).toBeNull(); // côté spécial 3
  });

  it("refuse un arbre trop profond (fichier piégé)", () => {
    expect(decodePaint("1".repeat(200))).toBeNull();
  });
});

describe("découpe des triangles", () => {
  const tri = [0, 0, 0, 4, 0, 0, 0, 4, 0];
  const area = (p: ArrayLike<number>) => {
    const ax = p[3] - p[0];
    const ay = p[4] - p[1];
    const bx = p[6] - p[0];
    const by = p[7] - p[1];
    return Math.abs(ax * by - ay * bx) / 2;
  };

  it("garde l'aire du parent dans ses enfants, quel que soit le côté spécial", () => {
    for (const s of [1, 2, 3] as const)
      for (const k of [0, 1, 2]) {
        const children = splitCorners(tri, s, k);
        expect(children).toHaveLength(s + 1);
        const sum = children.reduce((total, child) => total + area(child), 0);
        expect(sum).toBeCloseTo(area(tri), 10);
      }
  });

  it("place le triangle central des quatre enfants en dernier", () => {
    const [, , , center] = splitCorners(tri, 3, 0);
    expect(Array.from(center)).toEqual([2, 0, 0, 2, 2, 0, 0, 2, 0]);
  });

  it("coupe un côté : le sommet opposé au côté spécial reste entier", () => {
    // k = 0 : côté opposé au sommet 0, entre (4,0) et (0,4) ; milieu (2,2).
    const [first, second] = splitCorners(tri, 1, 0);
    expect(Array.from(first)).toEqual([0, 0, 0, 4, 0, 0, 2, 2, 0]);
    expect(Array.from(second)).toEqual([2, 2, 0, 0, 4, 0, 0, 0, 0]);
  });

  it("ne coupe que les côtés trop longs (règle des trancheurs)", () => {
    expect(splitRule(tri, 10)).toBeNull();
    // Hypoténuse 5,66 > 5 seulement : un côté, le côté 0.
    expect(splitRule(tri, 5)).toEqual({ s: 1, k: 0 });
    expect(splitRule(tri, 1)).toEqual({ s: 3, k: 0 });
    // Deux côtés trop longs : le côté gardé est le spécial.
    expect(splitRule([0, 0, 0, 10, 0, 0, 10, 1, 0], 5)).toEqual({ s: 2, k: 0 });
  });

  it("compte les feuilles, leurs parts d'aire et les fusionne", () => {
    const tree: PaintNode = {
      s: 2,
      k: 0,
      c: [1, { s: 1, k: 0, c: [2, 2] }, 1],
    };
    expect(leafCount(tree)).toBe(4);
    const shares = new Float64Array(3);
    accumulateShares(tree, 8, shares);
    expect(Array.from(shares)).toEqual([0, 6, 2]);
    expect(collapse(tree)).toEqual({ s: 2, k: 0, c: [1, 2, 1] });
    expect(
      collapse({ s: 3, k: 0, c: [1, 1, { s: 1, k: 0, c: [1, 1] }, 1] }),
    ).toBe(1);
    expect(remapNode(tree, [0, 2, 2])).toBe(2);
    let leaves = 0;
    forEachLeaf(tree, tri, () => leaves++);
    expect(leaves).toBe(4);
  });
});
