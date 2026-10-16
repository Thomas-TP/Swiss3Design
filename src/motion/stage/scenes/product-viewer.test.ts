import { describe, expect, it } from "vitest";
import {
  clampPolar,
  clearedDistance,
  decorDistance,
  decorFov,
  unitScaleFor,
  upAxisFor,
} from "./product-viewer";
import { DINING_ROOM_DECOR } from "@/components/catalog/viewer-props";

const deg = (rad: number) => (rad * 180) / Math.PI;
const horizontalFov = (verticalDeg: number, aspect: number) =>
  deg(2 * Math.atan(Math.tan((verticalDeg * Math.PI) / 360) * aspect));

describe("décor : cadrage de la caméra", () => {
  it("35° verticaux sur une vue haute ou carrée", () => {
    expect(decorFov(1)).toBeCloseTo(35, 5);
    expect(decorFov(0.6)).toBeCloseTo(35, 5);
  });

  it("vue large (bureau) : jamais plus de 55° en largeur, pas de fish-eye", () => {
    for (const aspect of [1.2, 1.6, 2.2, 3])
      expect(horizontalFov(decorFov(aspect), aspect)).toBeLessThanOrEqual(
        55.0001,
      );
    for (const aspect of [2.2, 3]) {
      expect(decorFov(aspect)).toBeLessThan(35);
      expect(horizontalFov(decorFov(aspect), aspect)).toBeCloseTo(55, 5);
    }
  });

  it("la pièce occupe la même part de la hauteur quel que soit l'écran", () => {
    const vase = { height: 0.209, radius: 0.0394 };
    for (const aspect of [0.8, 1.2, 2.2]) {
      const fovDeg = decorFov(aspect);
      const distance = decorDistance({ ...vase, aspect, fovDeg });
      const visible = 2 * distance * Math.tan((fovDeg * Math.PI) / 360);
      expect(vase.height / visible).toBeCloseTo(0.62, 5);
    }
  });

  it("salle à manger : même cadrage en descendant sur un écran courant", () => {
    // Vase posé sur le plateau (0,78 m), visé à mi-hauteur, de 5° à 88°.
    const { clearance } = DINING_ROOM_DECOR;
    if (!clearance) throw new Error("garde-fou attendu");
    const targetY = 0.78 + 0.209 / 2;
    for (const aspect of [0.8, 1.2, 2.2, 3]) {
      const framed = decorDistance({
        height: 0.209,
        radius: 0.0394,
        aspect,
        fovDeg: decorFov(aspect),
      });
      for (let degrees = 5; degrees <= 88; degrees += 1) {
        const polar = (degrees * Math.PI) / 180;
        const distance = clearedDistance({
          distance: framed,
          polar,
          targetY,
          clearance,
        });
        // Jusqu'à 2,2:1 (bureau), aucun rapprochement : pas de zoom.
        if (aspect <= 2.2) expect(distance).toBeCloseTo(framed, 6);
        // Écran très large : au-delà de 0,80 m de la pièce, la caméra est
        // au-dessus des dossiers (1,04 m).
        const height = targetY + distance * Math.cos(polar);
        expect(distance * Math.sin(polar) < 0.801 || height > 1.039).toBe(true);
        // Toujours au-dessus du plateau.
        expect(targetY + distance * Math.cos(polar)).toBeGreaterThan(0.79);
      }
    }
  });

  it("en descendant, la caméra se rapproche sans à-coup", () => {
    const at = (degrees: number) =>
      clearedDistance({
        distance: 0.73,
        polar: (degrees * Math.PI) / 180,
        targetY: 0.885,
        clearance: { reach: 0.52, above: 1.04 },
      });
    expect(at(40)).toBeCloseTo(0.73, 5);
    expect(at(88)).toBeLessThan(0.53);
    for (let degrees = 40; degrees < 88; degrees += 0.5)
      expect(Math.abs(at(degrees + 0.5) - at(degrees))).toBeLessThan(0.025);
  });

  it("polaire bornée à 5–88° en décor, 6–174° sur le fond neutre", () => {
    expect(deg(clampPolar(0, true))).toBeCloseTo(5);
    expect(deg(clampPolar(Math.PI, true))).toBeCloseTo(88);
    expect(deg(clampPolar(0))).toBeCloseTo(6);
    expect(deg(clampPolar(Math.PI))).toBeCloseTo(174);
  });
});

describe("unités et orientation du fichier", () => {
  it("un STL de trancheur est en millimètres, un glTF en mètres", () => {
    expect(unitScaleFor(209)).toBe(0.001);
    expect(unitScaleFor(0.209)).toBe(1);
  });

  it("le vase spirale (79 × 79 × 209 mm, Z en haut) se redresse", () => {
    expect(upAxisFor({ x: 79, y: 79, z: 209 })).toBe("z");
    expect(upAxisFor({ x: 79, y: 209, z: 79 })).toBe("y");
  });
});
