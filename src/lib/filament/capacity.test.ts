import { describe, expect, it } from "vitest";
import { shortColors } from "./capacity";

describe("shortColors", () => {
  it("additionne les lignes du panier avant de comparer à la capacité", () => {
    const capacity = { encre: 100, glacier: 50 };
    // Chaque ligne passe seule, leur somme dépasse pour « encre ».
    expect([
      ...shortColors(capacity, [
        { encre: 60, glacier: 20 },
        { encre: 50, glacier: 20 },
      ]),
    ]).toEqual(["encre"]);
  });

  it("ne bloque rien sans capacité connue, ni pour une couleur non suivie ou plafonnée", () => {
    expect(shortColors(null, [{ encre: 9999 }]).size).toBe(0);
    expect(shortColors({}, [{ encre: 9999 }]).size).toBe(0);
    expect(shortColors({ encre: 1500 }, [{ encre: 9999 }]).size).toBe(0);
  });

  it("signale une couleur épuisée (capacité 0)", () => {
    expect([...shortColors({ gres: 0 }, [{ gres: 1 }])]).toEqual(["gres"]);
  });
});
