import { describe, expect, it } from "vitest";
import { heightMmOf, registryRef } from "./specs";

describe("heightMmOf", () => {
  it("lit la troisième valeur d'un texte « L × l × H »", () => {
    expect(heightMmOf("79×79×209 mm")).toBe(209);
    expect(heightMmOf("120 × 120 × 220 mm")).toBe(220);
    expect(heightMmOf("90 x 90 x 210")).toBe(210);
    expect(heightMmOf("60*60*12,5 mm")).toBe(12.5);
  });

  it("met à l'échelle les centimètres", () => {
    expect(heightMmOf("8 x 8 x 21 cm")).toBe(210);
  });

  it("ne devine pas une hauteur sans trois valeurs", () => {
    expect(heightMmOf(null)).toBeNull();
    expect(heightMmOf("")).toBeNull();
    expect(heightMmOf("90 × 55 mm")).toBeNull();
    expect(heightMmOf("Ø 80 mm")).toBeNull();
    expect(heightMmOf("1 × 2 × 3 × 4")).toBeNull();
    expect(heightMmOf("0 × 10 × 0")).toBeNull();
  });

  it("écarte une faute de saisie manifeste", () => {
    expect(heightMmOf("10 × 10 × 99999")).toBeNull();
  });
});

describe("registryRef", () => {
  it("numérote à partir de 001 sur trois chiffres", () => {
    expect(registryRef(0)).toBe("001");
    expect(registryRef(11)).toBe("012");
    expect(registryRef(999)).toBe("1000");
  });
});
