import { describe, expect, it } from "vitest";
import { RELIEF_DEFAULT } from "@/lib/studio/presets";
import { strataTops } from "@/lib/studio/ranges";
import type { Band } from "@/lib/studio/types";
import {
  addReliefBand,
  canAddReliefBand,
  canRemoveReliefBand,
  moveReliefBoundary,
  removeReliefBand,
  reliefStep,
} from "./band-ops";

const g = {
  base: RELIEF_DEFAULT.base,
  relief: RELIEF_DEFAULT.relief,
  levels: RELIEF_DEFAULT.levels,
};
const tops = strataTops(g.base, g.relief, g.levels);
const bands = RELIEF_DEFAULT.bands;

/** Une liste de bandes valide : strictement croissante, sur des sommets de strates, la dernière au sommet. */
function valid(list: readonly Band[]) {
  const toMm = list.map((band) => band.toMm);
  expect(toMm.every((z) => tops.includes(z))).toBe(true);
  expect(toMm.every((z, i) => i === 0 || z > toMm[i - 1])).toBe(true);
  expect(toMm.at(-1)).toBe(tops[g.levels]);
  expect(list.length).toBeGreaterThanOrEqual(2);
  expect(list.length).toBeLessThanOrEqual(4);
}

describe("bandes du sous-verre : calées sur les sommets de strates (§6.4)", () => {
  it("le cran d'une flèche est une strate", () => {
    expect(reliefStep(g)).toBeCloseTo(0.4, 5);
  });

  it("une frontière tirée n'importe où retombe sur un sommet, entre ses voisines", () => {
    for (const raw of [-5, 0, 3.1, 4.3, 5.35, 6, 9, 100]) {
      for (const index of [0, 1, 2]) {
        const moved = moveReliefBoundary(bands, index, raw, g);
        valid(moved);
        expect(moved).toHaveLength(bands.length);
      }
    }
  });

  it("la dernière frontière (le sommet) ne bouge pas", () => {
    expect(moveReliefBoundary(bands, bands.length - 1, 4, g)).toEqual(bands);
    expect(moveReliefBoundary(bands, 99, 4, g)).toEqual(bands);
  });

  it("aucune séquence d'ajouts, de retraits et de déplacements ne produit de bandes invalides", () => {
    let list: Band[] = bands.map((b) => ({ ...b }));
    const steps = [
      () => addReliefBand(list, g),
      () => removeReliefBand(list, 1, g),
      () => removeReliefBand(list, 0, g),
      () => addReliefBand(list, g),
      () => addReliefBand(list, g),
      () => moveReliefBoundary(list, 0, 5.5, g),
      () => removeReliefBand(list, list.length - 1, g),
    ];
    for (const step of steps) {
      list = step();
      valid(list);
    }
    expect(list.length).toBeGreaterThanOrEqual(2);
  });

  it("plafond de quatre bandes, plancher de deux", () => {
    let list: Band[] = bands.map((b) => ({ ...b }));
    while (canAddReliefBand(list, g)) list = addReliefBand(list, g);
    expect(list.length).toBeLessThanOrEqual(4);
    expect(canAddReliefBand(list, g)).toBe(false);
    while (canRemoveReliefBand(list)) list = removeReliefBand(list, 0, g);
    expect(list).toHaveLength(2);
    valid(list);
  });
});
