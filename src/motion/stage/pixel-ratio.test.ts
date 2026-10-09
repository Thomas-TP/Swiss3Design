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

  it("ne touche pas les fenêtres usuelles : portables, 4K à 200 %, téléphone", () => {
    // MacBook 14 pouces (1512 × 982, DPR 2) et 16 pouces (1728 × 1117, DPR 2).
    for (const [w, h] of [
      [1497, 982],
      [1713, 1117],
    ])
      expect(stagePixelRatio(2, canvasOf(w, h, ANCHOR_MARGIN_FINE), 2)).toBe(
        1.5,
      );
    // 4K à 200 % : 1920 × 1080 px CSS, DPR 2.
    expect(
      stagePixelRatio(2, canvasOf(1905, 1080, ANCHOR_MARGIN_FINE), 2),
    ).toBe(1.5);
    // Un téléphone (marge de doigt, tampon d'à peine plus d'un Mpx).
    const phone = canvasOf(390, 844, ANCHOR_MARGIN_COARSE);
    expect(stagePixelRatio(3, phone, 1)).toBe(1.5);
  });

  it("abaisse le rapport d'un grand écran à DPR élevé pour tenir le budget", () => {
    // 4K à 150 % : 2560 × 1440 px CSS, DPR 1,5 (16,5 Mpx sans budget).
    const uhd = canvasOf(2545, 1440, ANCHOR_MARGIN_FINE);
    const ratio = stagePixelRatio(1.5, uhd, 2);
    expect(ratio).toBeLessThan(1.5);
    expect(ratio).toBeGreaterThan(1);
    expect(bufferMpx(uhd, ratio)).toBeCloseTo(STAGE_PIXEL_BUDGET[2] / 1e6, 6);
    // 27 pouces Retina : 2560 × 1300 px CSS, DPR 2, plafonné à 1,5 puis budget.
    const retina27 = canvasOf(2545, 1300, ANCHOR_MARGIN_FINE);
    expect(stagePixelRatio(2, retina27, 2)).toBeLessThan(1.5);
  });

  it("ne descend jamais sous 1 : un tampon qui déborde à DPR 1 reste à 1", () => {
    // Écran ultralarge 5120 × 1440 à DPR 1 : 11,8 Mpx, rien à retirer.
    const wide = canvasOf(5105, 1440, ANCHOR_MARGIN_FINE);
    expect(bufferMpx(wide, 1)).toBeGreaterThan(STAGE_PIXEL_BUDGET[2] / 1e6);
    expect(stagePixelRatio(1, wide, 2)).toBe(1);
    // À DPR 1,25 il retombe au plancher, pas en dessous.
    expect(stagePixelRatio(1.25, wide, 2)).toBe(1);
  });

  it("un DPR inférieur à 1 (page dézoomée) garde son rapport", () => {
    const wide = canvasOf(5105, 1440, ANCHOR_MARGIN_FINE);
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

  it("un appareil tactile garde le budget de C2 en C1 : son C1 est un départ, pas un déclassement", () => {
    // Tablette de 12,9 pouces : 1024 × 1366 px CSS, DPR 2, marge de doigt.
    const tablet = canvasOf(1024, 1366, ANCHOR_MARGIN_COARSE);
    const asC1 = stagePixelRatio(2, tablet, 1, true);
    expect(asC1).toBe(stagePixelRatio(2, tablet, 2, true));
    expect(asC1).toBeGreaterThan(stagePixelRatio(2, tablet, 1, false));
    expect(bufferMpx(tablet, asC1)).toBeLessThanOrEqual(
      STAGE_PIXEL_BUDGET[2] / 1e6 + 1e-9,
    );
  });

  it("sans taille ni palier connus (ou en C0), seul le plafond s'applique", () => {
    expect(stagePixelRatio(2)).toBe(1.5);
    expect(stagePixelRatio(2, canvasOf(9000, 5000, 0.3))).toBe(1.5);
    expect(stagePixelRatio(2, canvasOf(9000, 5000, 0.3), 0)).toBe(1.5);
    expect(stagePixelRatio(2, { width: 0, height: 0 }, 2)).toBe(1.5);
  });
});
