import { describe, expect, it } from "vitest";
import { printedRefs } from "./slots";

describe("couleurs imprimées", () => {
  it("une couleur et plusieurs couleurs sont indépendantes", () => {
    const setup = {
      single: "red",
      refs: ["white", "blue", "white"],
      several: true,
    };
    expect(printedRefs(setup)).toEqual(["white", "blue"]);
    // Changer la couleur unique ne touche pas aux couleurs du fichier.
    const one = { ...setup, several: false, single: "green" };
    expect(printedRefs(one)).toEqual(["green"]);
    expect(printedRefs({ ...one, several: true })).toEqual(["white", "blue"]);
  });

  it("sans fichier en couleurs, plusieurs couleurs n'existe pas", () => {
    expect(printedRefs({ single: "red", refs: [], several: true })).toEqual([
      "red",
    ]);
    expect(printedRefs({ single: null, refs: [], several: false })).toEqual([]);
  });
});
