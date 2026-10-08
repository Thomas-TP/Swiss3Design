import { describe, expect, it } from "vitest";
import { STAGE_MAX_PIXEL_RATIO, stagePixelRatio } from "./pixel-ratio";

// Plafond du rapport de pixels du Stage (retour R16, décision du 08.10.2026) :
// 1,5 aux deux paliers, parce que le canvas ancré fait deux fenêtres de haut.

describe("stagePixelRatio", () => {
  it("plafonne à 1,5 les écrans à DPR élevé (C1 comme C2)", () => {
    expect(STAGE_MAX_PIXEL_RATIO).toBe(1.5);
    for (const dpr of [1.5, 1.75, 2, 2.625, 3])
      expect(stagePixelRatio(dpr)).toBe(1.5);
  });

  it("garde les écrans plus fins tels quels : aucun plancher", () => {
    expect(stagePixelRatio(1)).toBe(1);
    expect(stagePixelRatio(1.25)).toBe(1.25);
  });

  it("repasse à 1 un rapport absurde", () => {
    for (const dpr of [0, -2, Number.NaN]) expect(stagePixelRatio(dpr)).toBe(1);
  });

  it("une surface de canvas ancré à 1,5 reste du même ordre que l'ancien canvas fixe à 2", () => {
    // 1440 × 900 : deux fenêtres de haut à 1,5 contre une fenêtre à 2.
    const anchored = 1440 * 1.5 * (2 * 900 * 1.5);
    const fixedBefore = 1440 * 2 * (900 * 2);
    expect(anchored / fixedBefore).toBeLessThan(1.15);
  });
});
