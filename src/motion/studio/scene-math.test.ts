import { describe, expect, it } from "vitest";
import {
  AZIMUTH_START,
  POLAR_MAX,
  POLAR_MIN,
  ZOOM_MAX,
  ZOOM_MIN,
  angleGap,
  clampPolar,
  clampZoom,
  explodeOffset,
  explodedHeight,
  fitDistance,
  fitDistancePlan,
  isRapidChange,
  layerAt,
  layerTop,
  onlyColorsChanged,
  orbitPosition,
  reprintFront,
  rippleFront,
  simulationState,
} from "./scene-math";

describe("calculs de la scène studio-object", () => {
  it("couches : numérotées depuis 1, hauteur du haut de la couche bornée à la pièce", () => {
    expect(layerAt(0)).toBe(0);
    expect(layerAt(0.2)).toBe(1);
    expect(layerAt(0.21)).toBe(2);
    expect(layerAt(150)).toBe(750);
    expect(layerTop(750, 150)).toBeCloseTo(150, 9);
    expect(layerTop(9999, 150)).toBe(150);
    expect(layerTop(-3, 150)).toBe(0);
    expect(layerTop(412, 150)).toBeCloseTo(82.4, 9);
  });

  it("simulation : la durée réelle estimée, divisée par la vitesse", () => {
    // 165 min réelles ; à ×100 : 99 s, donc la moitié à ≈ 49,5 s.
    const half = simulationState({
      elapsedMs: 49_500,
      speed: 100,
      printMinutes: 165,
      heightMm: 150,
    });
    expect(half.fraction).toBeCloseTo(0.5, 6);
    expect(half.layer).toBe(375);
    expect(half.z).toBeCloseTo(75, 6);
    expect(half.done).toBe(false);
    const done = simulationState({
      elapsedMs: 99_000,
      speed: 100,
      printMinutes: 165,
      heightMm: 150,
    });
    expect(done.done).toBe(true);
    expect(done.z).toBe(150);
    expect(done.layer).toBe(750);
    // Avant le départ : rien d'imprimé.
    expect(
      simulationState({
        elapsedMs: -5,
        speed: 1,
        printMinutes: 60,
        heightMm: 40,
      }).layer,
    ).toBe(0);
  });

  it("la simulation avance par couches entières, jamais en arrière", () => {
    let previous = -1;
    for (let ms = 0; ms <= 100_000; ms += 137) {
      const state = simulationState({
        elapsedMs: ms,
        speed: 100,
        printMinutes: 165,
        heightMm: 150,
      });
      expect(state.layer).toBeGreaterThanOrEqual(previous);
      expect(Number.isInteger(state.layer)).toBe(true);
      previous = state.layer;
    }
  });

  it("cadrage : la pièce tient dans la vue, plus large qu'elle n'est haute aussi", () => {
    const tall = fitDistance({ height: 150, radius: 48, aspect: 1 });
    const squat = fitDistance({ height: 4, radius: 50, aspect: 1 });
    expect(tall).toBeGreaterThan(0);
    // Une vue étroite exige plus de recul que la même pièce dans une vue large.
    expect(
      fitDistance({ height: 150, radius: 100, aspect: 0.5 }),
    ).toBeGreaterThan(fitDistance({ height: 150, radius: 100, aspect: 2 }));
    expect(squat).toBeGreaterThan(0);
    expect(
      fitDistancePlan({ width: 85, depth: 55, aspect: 1 }),
    ).toBeGreaterThan(fitDistancePlan({ width: 42, depth: 27, aspect: 1 }));
  });

  it("éclaté : coques écartées de 12 mm, hauteur totale à l'avenant", () => {
    expect(explodeOffset(0, 12)).toBe(0);
    expect(explodeOffset(2, 12)).toBe(24);
    expect(explodedHeight(150, 3, 12)).toBe(174);
    expect(explodedHeight(150, 1, 12)).toBe(150);
    expect(explodedHeight(150, 0, 12)).toBe(150);
  });

  it("caméra : angles et zoom bornés, l'azimut prend le chemin le plus court", () => {
    expect(clampPolar(-1)).toBe(POLAR_MIN);
    expect(clampPolar(9)).toBe(POLAR_MAX);
    expect(clampZoom(0.01)).toBe(ZOOM_MIN);
    expect(clampZoom(99)).toBe(ZOOM_MAX);
    expect(angleGap(0, Math.PI * 1.5)).toBeCloseTo(-Math.PI / 2, 9);
    expect(angleGap(Math.PI * 1.9, 0.1)).toBeCloseTo(0.1 * Math.PI + 0.1, 9);
    const [x, y, z] = orbitPosition([0, 75, 0], 500, 0, Math.PI / 2);
    expect(x).toBeCloseTo(0, 9);
    expect(y).toBeCloseTo(75, 9);
    expect(z).toBeCloseTo(500, 9);
    expect(AZIMUTH_START).toBeLessThan(0);
  });

  it("réimpression et vague : fronts de 0 à la hauteur (marge comprise), monotones", () => {
    for (const front of [reprintFront, rippleFront]) {
      expect(front(0, 100)).toBe(0);
      expect(front(1, 100)).toBe(102);
      expect(front(2, 100)).toBe(102);
      let previous = -1;
      for (let p = 0; p <= 1; p += 0.05) {
        const value = front(p, 100);
        expect(value).toBeGreaterThanOrEqual(previous);
        previous = value;
      }
    }
  });

  it("seul un changement de teinte rejoue la vague (pas un déplacement de frontière)", () => {
    const a = [
      { filament: "bleu-leman", toMm: 42 },
      { filament: "blanc-neve", toMm: 150 },
    ];
    expect(
      onlyColorsChanged(a, [
        { filament: "ambre", toMm: 42 },
        { filament: "blanc-neve", toMm: 150 },
      ]),
    ).toBe(true);
    expect(onlyColorsChanged(a, a)).toBe(false);
    expect(
      onlyColorsChanged(a, [
        { filament: "ambre", toMm: 50 },
        { filament: "blanc-neve", toMm: 150 },
      ]),
    ).toBe(false);
    expect(onlyColorsChanged(a, [{ filament: "ambre", toMm: 150 }])).toBe(
      false,
    );
    expect(onlyColorsChanged([], [])).toBe(false);
  });

  it("basse définition pendant un glissé, définition d'affichage pour un geste isolé", () => {
    expect(isRapidChange({ sinceLastChangeMs: 16, busy: false })).toBe(true);
    expect(isRapidChange({ sinceLastChangeMs: 5000, busy: true })).toBe(true);
    expect(isRapidChange({ sinceLastChangeMs: 5000, busy: false })).toBe(false);
  });
});
