import { describe, expect, it } from "vitest";
import {
  ANCHOR_LEAD_SECONDS,
  ANCHOR_MARGIN_COARSE,
  ANCHOR_MARGIN_FINE,
  ANCHOR_TRAIL_KEEP,
  anchorCanvasViewports,
  anchorLead,
  anchorMargin,
  createAnchorLead,
} from "./anchor-margin";
import { anchorPlacement } from "./ticker";

// Marge du canvas ancré et anticipation (WP-99, suite du problème ouvert 1 de
// measures-r16.md) : la partie arithmétique. Le rendu réel (compositeur,
// défilement natif) se vérifie dans le navigateur, measures-wp99-canvas.md.

describe("anchorMargin", () => {
  it("garde une marge plus grande dès qu'un doigt est présent", () => {
    expect(anchorMargin(false)).toBe(ANCHOR_MARGIN_FINE);
    expect(anchorMargin(true)).toBe(ANCHOR_MARGIN_COARSE);
    expect(ANCHOR_MARGIN_COARSE).toBeGreaterThan(ANCHOR_MARGIN_FINE);
  });

  it("coûte moins de pixels à la souris que l'ancien canvas de deux fenêtres", () => {
    expect(anchorCanvasViewports(ANCHOR_MARGIN_FINE)).toBeLessThan(2);
    // Au doigt, rien ne change : la fenêtre et une demi-fenêtre de chaque côté.
    expect(anchorCanvasViewports(ANCHOR_MARGIN_COARSE)).toBe(2);
    expect(anchorCanvasViewports(0.25)).toBe(1.5);
  });
});

describe("anchorLead", () => {
  const margin = 270;

  it("avance dans le sens du défilement, proportionnellement à sa vitesse", () => {
    expect(anchorLead(0, margin)).toBeCloseTo(0, 9);
    expect(anchorLead(1000, margin)).toBeCloseTo(1000 * ANCHOR_LEAD_SECONDS, 9);
    expect(anchorLead(-1000, margin)).toBeCloseTo(
      -1000 * ANCHOR_LEAD_SECONDS,
      9,
    );
  });

  it("garde une part de la marge côté arrière, même à vitesse folle", () => {
    const room = margin * (1 - ANCHOR_TRAIL_KEEP);
    expect(anchorLead(1e6, margin)).toBe(room);
    expect(anchorLead(-1e6, margin)).toBe(-room);
    // Côté arrière : il reste toujours ANCHOR_TRAIL_KEEP de la marge.
    expect(margin - anchorLead(1e6, margin)).toBeCloseTo(
      margin * ANCHOR_TRAIL_KEEP,
      9,
    );
  });

  it("porte la marge côté avant au-delà de l'ancienne marge symétrique", () => {
    // Marge de base 0,3 fenêtre : à vitesse soutenue, 1,8 fois la marge devant.
    const ahead = margin + anchorLead(20_000, margin);
    expect(ahead).toBeCloseTo(margin * (2 - ANCHOR_TRAIL_KEEP), 9);
    expect(ahead).toBeGreaterThan(0.5 * 900);
  });

  it("repasse à 0 une vitesse absurde", () => {
    for (const v of [Number.NaN, Infinity, -Infinity])
      expect(anchorLead(v, margin)).toBe(0);
  });
});

describe("createAnchorLead", () => {
  const margin = 270;

  it("commence symétrique : pas d'historique, pas d'anticipation", () => {
    const lead = createAnchorLead();
    expect(lead.update(500, margin, 1000)).toBe(0);
  });

  it("mesure la vitesse d'un défilement au suivant", () => {
    const lead = createAnchorLead();
    lead.update(500, margin, 1000);
    // 60 px en 16 ms = 3 750 px/s, vers le bas.
    expect(lead.update(560, margin, 1016)).toBeCloseTo(
      anchorLead(3750, margin),
      6,
    );
    // Vers le haut : le signe suit.
    expect(lead.update(500, margin, 1032)).toBeCloseTo(
      anchorLead(-3750, margin),
      6,
    );
  });

  it("garde le décalage tant que le défilement ne change pas (jamais de saut sans redessin)", () => {
    const lead = createAnchorLead();
    lead.update(500, margin, 1000);
    const moving = lead.update(560, margin, 1016);
    expect(moving).not.toBe(0);
    // Frames suivantes sans défilement (animation d'une scène) : même valeur.
    expect(lead.update(560, margin, 1032)).toBe(moving);
    expect(lead.update(560, margin, 5000)).toBe(moving);
  });

  it("un défilement qui reprend après une pause longue repart presque symétrique", () => {
    const lead = createAnchorLead();
    lead.update(500, margin, 1000);
    // 20 px, 5 s plus tard : 4 px/s, aucune anticipation à retenir.
    expect(Math.abs(lead.update(520, margin, 6000))).toBeLessThan(0.5);
  });

  it("deux mesures dans la même milliseconde ne gonflent pas la vitesse", () => {
    const lead = createAnchorLead();
    lead.update(500, margin, 1000);
    // dt = 0 : borné à 4 ms, donc 10 px / 4 ms = 2 500 px/s au plus.
    expect(lead.update(510, margin, 1000)).toBeCloseTo(
      anchorLead(2500, margin),
      6,
    );
  });

  it("reset() rend la symétrie", () => {
    const lead = createAnchorLead();
    lead.update(500, margin, 1000);
    expect(lead.update(560, margin, 1016)).not.toBe(0);
    lead.reset();
    expect(lead.update(560, margin, 1032)).toBe(0);
  });
});

describe("anticipation et placement du canvas", () => {
  it("décale le canvas dans le sens du défilement et rend la marge manquante côté avant", () => {
    const margin = 270;
    const vh = 900;
    const canvasHeight = vh * anchorCanvasViewports(ANCHOR_MARGIN_FINE);
    const scrollY = 3000;
    // Marges réelles, côté haut et côté bas, de la fenêtre au bord du canvas.
    const placed = (velocity: number) => {
      const lead = anchorLead(velocity, margin);
      const { top, offset } = anchorPlacement(scrollY, margin, 1, lead);
      const above = scrollY - top;
      const below = top + canvasHeight - (scrollY + vh);
      expect(above).toBe(offset);
      expect(above + below).toBeCloseTo(2 * margin, 6);
      // Côté arrière : jamais sous la part gardée.
      expect(Math.min(above, below)).toBeGreaterThanOrEqual(
        margin * ANCHOR_TRAIL_KEEP - 1e-6,
      );
      return { above, below };
    };
    for (const velocity of [0, 2000, 20_000, -20_000]) placed(velocity);
    // Vers le bas, le canvas descend : plus de marge en bas qu'en haut.
    const down = placed(20_000);
    expect(down.below).toBeGreaterThan(down.above);
    // Vers le haut, l'inverse.
    const up = placed(-20_000);
    expect(up.above).toBeGreaterThan(up.below);
    // À l'arrêt, symétrique.
    const still = placed(0);
    expect(still.above).toBeCloseTo(still.below, 6);
  });
});
