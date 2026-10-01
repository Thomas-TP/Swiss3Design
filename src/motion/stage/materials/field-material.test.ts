import { describe, expect, it } from "vitest";
import { fieldHeight } from "./field-material";

// Le relief du champ de courbes : une tuile qui se répète sans couture (deux
// vues voisines se raccordent), des valeurs jamais exactement 0 ni 1 (un
// plateau à une valeur de niveau entière serait peint comme une courbe).
describe("champ de courbes · relief", () => {
  it("se répète sans couture en u et en v", () => {
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      expect(fieldHeight(0, t)).toBeCloseTo(fieldHeight(1, t), 9);
      expect(fieldHeight(t, 0)).toBeCloseTo(fieldHeight(t, 1), 9);
    }
  });

  it("reste strictement entre 0 et 1, sans plateau", () => {
    let min = 1;
    let max = 0;
    for (let y = 0; y < 64; y++)
      for (let x = 0; x < 64; x++) {
        const h = fieldHeight(x / 64, y / 64);
        min = Math.min(min, h);
        max = Math.max(max, h);
      }
    expect(min).toBeGreaterThan(0);
    expect(max).toBeLessThan(1);
    // Du relief : une vraie étendue, pas un aplat.
    expect(max - min).toBeGreaterThan(0.4);
  });

  it("est déterministe", () => {
    expect(fieldHeight(0.31, 0.72)).toBe(fieldHeight(0.31, 0.72));
  });
});
