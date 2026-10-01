import { describe, expect, it } from "vitest";
import { LAYER_MM, layerAt, layerTop, spreadVertically } from "./layers";

describe("couches", () => {
  it("numéro de couche depuis 1 ; haut de la couche borné à la pièce", () => {
    expect(LAYER_MM).toBe(0.2);
    expect(layerAt(0)).toBe(0);
    expect(layerAt(0.2)).toBe(1);
    expect(layerAt(150)).toBe(750);
    expect(layerTop(750, 150)).toBeCloseTo(150, 9);
    expect(layerTop(9999, 150)).toBe(150);
    expect(layerTop(412, 150)).toBeCloseTo(82.4, 9);
  });
});

describe("étiquettes de l'éclaté : écartées sans se chevaucher", () => {
  it("garde les hauteurs qui ne se gênent pas", () => {
    expect(spreadVertically([100, 300, 500], 50, 0, Infinity)).toEqual([
      100, 300, 500,
    ]);
  });

  it("descend les étiquettes trop proches, dans l'ordre des hauteurs, et rend l'ordre d'origine", () => {
    // Entrées dans le désordre : la 2e est la plus haute.
    expect(spreadVertically([120, 100, 110], 50, 0, Infinity)).toEqual([
      200, 100, 150,
    ]);
  });

  it("respecte le haut (min) et fait remonter le paquet quand le bas déborde (max)", () => {
    expect(spreadVertically([5, 6], 40, 20, Infinity)).toEqual([20, 60]);
    // Trois étiquettes collées en bas de la vue : le paquet remonte, jamais sous 20.
    const placed = spreadVertically([480, 485, 490], 40, 20, 500);
    expect(placed[2]).toBeLessThanOrEqual(500);
    expect(placed[1] - placed[0]).toBeGreaterThanOrEqual(40);
    expect(placed[2] - placed[1]).toBeGreaterThanOrEqual(40);
    expect(Math.min(...placed)).toBeGreaterThanOrEqual(20);
  });

  it("aucune étiquette : rien", () => {
    expect(spreadVertically([], 40, 0, 100)).toEqual([]);
  });
});
