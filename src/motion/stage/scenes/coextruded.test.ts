import { describe, expect, it } from "vitest";
import { coextrudedBlend } from "./coextruded";

/** Part de chaque couleur sur une paroi verticale orientée à `deg` degrés. */
const weights = (deg: number, count: number) => {
  const r = (deg * Math.PI) / 180;
  const blend = coextrudedBlend(Math.cos(r), 0, Math.sin(r), count);
  const out = Array.from({ length: count }, () => 0);
  out[blend.a] += 1 - blend.t;
  out[blend.b] += blend.t;
  return out;
};

/** Arrondi au millionième (et -0 ramené à 0) : comparaisons exactes. */
const rounded = (ws: number[]) => ws.map((w) => Math.round(w * 1e6) / 1e6 + 0);

describe("coextrudedBlend : secteurs d'une bobine co-extrudée", () => {
  it("une seule couleur : toujours la première, sans fondu", () => {
    expect(weights(123, 1)).toEqual([1]);
  });

  it("bicolore : une moitié par couleur, franche au centre des secteurs", () => {
    expect(rounded(weights(90, 2))).toEqual([1, 0]);
    expect(rounded(weights(270, 2))).toEqual([0, 1]);
  });

  it("tricolore : trois secteurs de 120°", () => {
    expect(rounded(weights(60, 3))).toEqual([1, 0, 0]);
    expect(rounded(weights(180, 3))).toEqual([0, 1, 0]);
    expect(rounded(weights(300, 3))).toEqual([0, 0, 1]);
  });

  it("fondu à mi-chemin entre deux secteurs, y compris en repassant par 0°", () => {
    expect(rounded(weights(120, 3))).toEqual([0.5, 0.5, 0]);
    expect(rounded(weights(0, 3))).toEqual([0.5, 0, 0.5]);
    expect(rounded(weights(0, 2))).toEqual([0.5, 0.5]);
  });

  it("le fondu est continu : aucun saut de couleur autour de la pièce", () => {
    for (let deg = 0; deg < 360; deg += 1) {
      const [x, y] = [weights(deg, 3), weights(deg + 1, 3)];
      for (let k = 0; k < 3; k++)
        expect(Math.abs(x[k] - y[k])).toBeLessThan(0.08);
    }
  });

  it("dessus et dessous : le mélange ; paroi verticale : aucun mélange", () => {
    expect(coextrudedBlend(0, 1, 0, 3).flat).toBe(1);
    expect(coextrudedBlend(0, -1, 0, 2).flat).toBe(1);
    expect(coextrudedBlend(1, 0, 0, 2).flat).toBe(0);
  });
});
