import { describe, expect, it } from "vitest";
import { ANCHOR_MARGIN_COARSE, ANCHOR_MARGIN_FINE } from "./anchor-margin";
import {
  STAGE_MAX_PIXEL_RATIO,
  STAGE_PIXEL_BUDGET,
  stagePixelRatio,
} from "./pixel-ratio";

// Rapport de pixels du Stage : plafond de 1,5 aux deux paliers (retour R16,
// décision du 08.10.2026), puis budget de pixels du tampon par palier (WP-99).

/** Canvas ancré d'une fenêtre : largeur de la fenêtre, hauteur de la fenêtre et de ses marges. */
function canvasOf(width: number, height: number, margin: number) {
  return { width, height: height * (1 + 2 * margin) };
}

/** Pixels du tampon de dessin (millions). */
function bufferMpx(size: { width: number; height: number }, ratio: number) {
  return (size.width * size.height * ratio * ratio) / 1e6;
}

describe("stagePixelRatio · plafond de 1,5", () => {
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
});

describe("stagePixelRatio · budget de pixels", () => {
  it("C1 a un budget plus bas que C2 : une machine déclassée perd des pixels", () => {
    expect(STAGE_PIXEL_BUDGET[1]).toBeLessThan(STAGE_PIXEL_BUDGET[2]);
  });

  it("ne touche pas les fenêtres usuelles : 1440 × 900 à DPR 2, 1920 × 1080 physiques à DPR 1,5", () => {
    const laptop = canvasOf(1425, 900, ANCHOR_MARGIN_FINE);
    expect(stagePixelRatio(2, laptop, 2)).toBe(1.5);
    // 1920 × 1080 physiques à 150 % : 1280 × 720 px CSS.
    const hd = canvasOf(1265, 720, ANCHOR_MARGIN_FINE);
    expect(stagePixelRatio(1.5, hd, 2)).toBe(1.5);
    // Un téléphone (marge de doigt, tampon d'à peine plus d'un Mpx).
    const phone = canvasOf(390, 844, ANCHOR_MARGIN_COARSE);
    expect(stagePixelRatio(3, phone, 1)).toBe(1.5);
  });

  it("abaisse le rapport d'un grand écran à DPR élevé pour tenir le budget", () => {
    // 4K à 200 % : 1905 × 1080 px CSS, DPR 2 → plafond 1,5, hors budget en C2.
    const uhd = canvasOf(1905, 1080, ANCHOR_MARGIN_FINE);
    const ratio = stagePixelRatio(2, uhd, 2);
    expect(ratio).toBeLessThan(1.5);
    expect(ratio).toBeGreaterThan(1);
    expect(bufferMpx(uhd, ratio)).toBeCloseTo(STAGE_PIXEL_BUDGET[2] / 1e6, 6);
  });

  it("ne descend jamais sous 1 : un tampon qui déborde à DPR 1 reste à 1", () => {
    const wide = canvasOf(3425, 1440, ANCHOR_MARGIN_FINE);
    expect(bufferMpx(wide, 1)).toBeGreaterThan(STAGE_PIXEL_BUDGET[2] / 1e6);
    expect(stagePixelRatio(1, wide, 2)).toBe(1);
    // 4K à 150 % : plafonné à 1,5, le budget le ramène à 1 ou à peine plus.
    const uhd150 = canvasOf(2545, 1440, ANCHOR_MARGIN_FINE);
    const ratio = stagePixelRatio(1.5, uhd150, 2);
    expect(ratio).toBeGreaterThanOrEqual(1);
    expect(ratio).toBeLessThan(1.1);
  });

  it("un DPR inférieur à 1 (page dézoomée) garde son rapport", () => {
    const wide = canvasOf(3425, 1440, ANCHOR_MARGIN_FINE);
    expect(stagePixelRatio(0.8, wide, 2)).toBe(0.8);
    expect(stagePixelRatio(0.8, wide, 1)).toBe(0.8);
  });

  it("C2 → C1 retire des pixels là où le rapport peut baisser", () => {
    const laptop = canvasOf(1425, 900, ANCHOR_MARGIN_FINE);
    const asC2 = stagePixelRatio(2, laptop, 2);
    const asC1 = stagePixelRatio(2, laptop, 1);
    expect(asC1).toBeLessThan(asC2);
    expect(bufferMpx(laptop, asC1)).toBeLessThan(bufferMpx(laptop, asC2));
    expect(bufferMpx(laptop, asC1)).toBeLessThanOrEqual(
      STAGE_PIXEL_BUDGET[1] / 1e6 + 1e-9,
    );
    // À DPR 1 le rapport est déjà au plancher : rien à retirer.
    expect(stagePixelRatio(1, laptop, 1)).toBe(1);
  });

  it("sans taille ni palier connus (ou en C0), seul le plafond s'applique", () => {
    expect(stagePixelRatio(2)).toBe(1.5);
    expect(stagePixelRatio(2, canvasOf(9000, 5000, 0.3))).toBe(1.5);
    expect(stagePixelRatio(2, canvasOf(9000, 5000, 0.3), 0)).toBe(1.5);
    expect(stagePixelRatio(2, { width: 0, height: 0 }, 2)).toBe(1.5);
  });
});
