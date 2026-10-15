import { describe, expect, it } from "vitest";
import {
  clampPolar,
  decorDistance,
  decorFov,
  unitScaleFor,
  upAxisFor,
} from "./product-viewer";

const deg = (rad: number) => (rad * 180) / Math.PI;
const horizontalFov = (verticalDeg: number, aspect: number) =>
  deg(2 * Math.atan(Math.tan((verticalDeg * Math.PI) / 360) * aspect));

describe("décor : cadrage de la caméra", () => {
  it("vue haute ou carrée : 50° verticaux", () => {
    expect(decorFov(1)).toBeCloseTo(50, 5);
    expect(decorFov(0.6)).toBeCloseTo(50, 5);
  });

  it("vue large (bureau) : jamais plus de 55° en largeur, pas de fish-eye", () => {
    for (const aspect of [1.6, 2.2, 3]) {
      const vertical = decorFov(aspect);
      expect(vertical).toBeLessThan(50);
      expect(horizontalFov(vertical, aspect)).toBeCloseTo(55, 5);
    }
  });

  it("la pièce occupe la même part de la hauteur quel que soit l'écran", () => {
    const vase = { height: 0.209, radius: 0.0394 };
    for (const aspect of [0.8, 1.2, 2.2]) {
      const fovDeg = decorFov(aspect);
      const distance = decorDistance({ ...vase, aspect, fovDeg });
      const visible = 2 * distance * Math.tan((fovDeg * Math.PI) / 360);
      expect(vase.height / visible).toBeCloseTo(0.6, 5);
    }
  });

  it("la caméra reste au-dessus du plateau (table de 1,61 m de large)", () => {
    const fovDeg = decorFov(2.2);
    const distance = decorDistance({
      height: 0.209,
      radius: 0.0394,
      aspect: 2.2,
      fovDeg,
    });
    // Polaire la plus basse (84°) : distance horizontale < demi-largeur.
    expect(distance * Math.sin((84 * Math.PI) / 180)).toBeLessThan(0.8);
  });

  it("polaire bornée à 40–84° en décor, 6–174° sur le fond neutre", () => {
    expect(deg(clampPolar(0, true))).toBeCloseTo(40);
    expect(deg(clampPolar(Math.PI, true))).toBeCloseTo(84);
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
