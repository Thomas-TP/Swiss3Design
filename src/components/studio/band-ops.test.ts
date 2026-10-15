import { describe, expect, it } from "vitest";
import { MONTAGNE_DEFAULT } from "@/lib/studio/presets";
import {
  MIN_BAND_MM,
  montagneTotal,
  normalizeMontagneBands,
} from "@/lib/studio/ranges";
import type { Band } from "@/lib/studio/types";
import {
  addMontagneBand,
  canAddMontagneBand,
  canRemoveMontagneBand,
  LOCKED_BOUNDARIES,
  moveMontagneBoundary,
  removeMontagneBand,
} from "./band-ops";

const bands = MONTAGNE_DEFAULT.bands;
const { plinth, height } = MONTAGNE_DEFAULT;
const total = montagneTotal(plinth, height);

/**
 * Une liste de bandes valide : la première finit au dessus du socle, la dernière
 * au sommet, frontières à la couche, 2 mm d'épaisseur au moins, 2 à 4 bandes.
 */
function valid(list: readonly Band[]) {
  expect(list.length).toBeGreaterThanOrEqual(2);
  expect(list.length).toBeLessThanOrEqual(4);
  expect(list[0].toMm).toBe(plinth);
  expect(list.at(-1)!.toMm).toBe(total);
  const thicknesses = list.slice(1).map((band, k) => band.toMm - list[k].toMm);
  expect(Math.min(...thicknesses)).toBeGreaterThanOrEqual(MIN_BAND_MM - 1e-9);
  const offGrid = list.map((band) =>
    Math.abs(band.toMm / 0.2 - Math.round(band.toMm / 0.2)),
  );
  expect(Math.max(...offGrid)).toBeLessThan(1e-6);
  // Une liste valide est un point fixe de la normalisation.
  expect(normalizeMontagneBands(list, plinth, height)).toEqual(list);
}

describe("bandes de la Montagne : le socle est la première bande, verrouillée (§6.4)", () => {
  it("le défaut est valide : socle encre, prairie à 40 %, roche à 75 %, neige", () => {
    valid(bands);
    expect(bands.map((b) => b.filament)).toEqual([
      "encre",
      "vert-foret",
      "gris-molasse",
      "blanc-neve",
    ]);
    expect(bands[1].toMm).toBeCloseTo(plinth + 0.4 * height, 1);
    expect(bands[2].toMm).toBeCloseTo(plinth + 0.75 * height, 1);
  });

  it("la frontière du socle ne bouge jamais, quoi qu'on tire", () => {
    expect(LOCKED_BOUNDARIES).toBe(1);
    for (const raw of [-5, 0, 3, plinth, 12, 100]) {
      expect(moveMontagneBoundary(bands, 0, raw)).toEqual(bands);
    }
  });

  it("une frontière tirée n'importe où reste entre ses voisines, à la couche", () => {
    for (const raw of [-5, 0, 8, 20.13, 35, 70, 100, 500]) {
      for (const index of [1, 2]) {
        const moved = moveMontagneBoundary(bands, index, raw);
        valid(moved);
        expect(moved).toHaveLength(bands.length);
      }
    }
  });

  it("la dernière frontière (le sommet) ne bouge pas", () => {
    expect(moveMontagneBoundary(bands, bands.length - 1, 4)).toEqual(bands);
    expect(moveMontagneBoundary(bands, 99, 4)).toEqual(bands);
  });

  it("aucune séquence d'ajouts, de retraits et de déplacements ne produit de bandes invalides", () => {
    let list: Band[] = bands.map((b) => ({ ...b }));
    const steps = [
      () => addMontagneBand(list),
      () => removeMontagneBand(list, 1),
      () => removeMontagneBand(list, 0),
      () => addMontagneBand(list),
      () => addMontagneBand(list),
      () => moveMontagneBoundary(list, 1, 20.1),
      () => removeMontagneBand(list, list.length - 1),
    ];
    for (const step of steps) {
      list = step();
      valid(list);
    }
    expect(list.length).toBeGreaterThanOrEqual(2);
  });

  it("plafond de quatre bandes, plancher de deux : le socle reste", () => {
    let list: Band[] = bands.map((b) => ({ ...b }));
    expect(canAddMontagneBand(list)).toBe(false);
    list = removeMontagneBand(list, 2);
    expect(canAddMontagneBand(list)).toBe(true);
    while (canAddMontagneBand(list)) list = addMontagneBand(list);
    expect(list).toHaveLength(4);
    expect(canRemoveMontagneBand(list, 0)).toBe(false);
    while (canRemoveMontagneBand(list, list.length - 1))
      list = removeMontagneBand(list, list.length - 1);
    expect(list).toHaveLength(2);
    valid(list);
    expect(list[0].filament).toBe("encre");
  });

  it("une bande qu'on ajoute coupe la plus épaisse de la montagne, jamais le socle", () => {
    const two: Band[] = [
      { filament: "encre", toMm: plinth },
      { filament: "blanc-neve", toMm: total },
    ];
    const three = addMontagneBand(two);
    valid(three);
    expect(three[0]).toEqual(two[0]);
    expect(three[1].filament).toBe("blanc-neve");
    expect(three[2].filament).not.toBe("blanc-neve");
  });
});
