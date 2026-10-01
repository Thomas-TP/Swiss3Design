import { describe, expect, it } from "vitest";
import { heroCamera } from "@/lib/studio/camera";
import {
  bandOfCut,
  cameraAt,
  easeBuse,
  expandBands,
  pas,
  towerHeight,
} from "./print-hero";

// La logique pure de la scène du héros (la partie WebGL se vérifie dans le
// navigateur) : paliers de la vague, frontières de bande, bascule en plan,
// tour de purge.
describe("print-hero · logique pure", () => {
  it("la vague avance par paliers de 1/30, monotone, de 0 à 1", () => {
    let previous = -1;
    for (let i = 0; i <= 300; i++) {
      const value = pas(i / 300);
      expect(value).toBeGreaterThanOrEqual(previous - 1e-12);
      previous = value;
    }
    expect(pas(0)).toBe(0);
    expect(pas(1)).toBeCloseTo(1, 12);
  });

  it("la réimpression s'adoucit aux deux bouts", () => {
    expect(easeBuse(0)).toBe(0);
    expect(easeBuse(1)).toBe(1);
    expect(easeBuse(0.5)).toBe(0.5);
    expect(easeBuse(0.1)).toBeLessThan(0.1);
    expect(easeBuse(0.9)).toBeGreaterThan(0.9);
  });

  it("« Uni » répète sa teinte sur les trois frontières", () => {
    const bands = expandBands(["blanc-neve"], [42, 108, 150]);
    expect(bands.map((b) => b.topMm)).toEqual([42, 108, 150]);
    expect(new Set(bands.map((b) => b.color)).size).toBe(1);
    const leman = expandBands(
      ["bleu-leman", "vert-lavaux", "blanc-neve"],
      [42, 108, 150],
    );
    expect(new Set(leman.map((b) => b.color)).size).toBe(3);
  });

  it("une frontière appartient à la bande du dessous, la couche suivante à celle du dessus", () => {
    const bounds = [42, 108, 150];
    expect(bandOfCut(0, bounds)).toBe(0);
    expect(bandOfCut(42, bounds)).toBe(0); // couche 210 : dernière de la bande 1
    expect(bandOfCut(42.2, bounds)).toBe(1); // couche 211 : changement de filament
    expect(bandOfCut(108, bounds)).toBe(1);
    expect(bandOfCut(108.2, bounds)).toBe(2);
    expect(bandOfCut(150, bounds)).toBe(2);
  });

  it("la tour de purge suit la coupe jusqu'à 1 mm après le dernier changement", () => {
    const bounds = [42, 108, 150];
    const leman = ["bleu-leman", "vert-lavaux", "blanc-neve"] as const;
    expect(towerHeight(30, leman, bounds)).toBe(30);
    expect(towerHeight(150, leman, bounds)).toBe(109);
    // Sans changement de filament, pas de tour.
    expect(towerHeight(150, ["blanc-neve"], bounds)).toBe(0);
    // Deux bandes de même filament : le dernier vrai changement compte.
    expect(
      towerHeight(150, ["encre", "blanc-neve", "blanc-neve"], bounds),
    ).toBe(43);
  });

  it("la bascule va de la caméra du héros à la vue de plan, fov 20° → 12°", () => {
    const base = heroCamera();
    const start = cameraAt(0, base, 96);
    expect(start.fovDeg).toBe(20);
    expect(start.elevationDeg).toBe(22);
    expect(start.azimuthDeg).toBe(-28);
    expect(start.distance).toBeCloseTo(base.distance, 9);
    const end = cameraAt(1, base, 96);
    expect(end.fovDeg).toBe(12);
    expect(end.elevationDeg).toBeGreaterThan(89);
    expect(end.elevationDeg).toBeLessThan(90);
    // À mi-chemin, entre les deux (le mouvement est continu).
    const mid = cameraAt(0.5, base, 96);
    expect(mid.fovDeg).toBeCloseTo(16, 9);
    expect(mid.elevationDeg).toBeGreaterThan(start.elevationDeg);
    expect(mid.elevationDeg).toBeLessThan(end.elevationDeg);
  });
});
