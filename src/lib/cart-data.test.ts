import { describe, it, expect } from "vitest";
import { sameLine, parseCart } from "./cart-data";
import { hasExpectedSignature } from "./file-signature";
const item = {
  productId: "p",
  slug: "vase",
  name: "Vase",
  priceCents: 1000,
  imageUrl: null,
  saleType: "stock",
  quantity: 1,
};
describe("Panier et fichiers entrants", () => {
  it("isole les couleurs et variantes d'un même produit", () => {
    expect(
      sameLine({ ...item, colorName: "Blanc" }, { ...item, colorName: "Noir" }),
    ).toBe(false);
    expect(
      sameLine(
        { ...item, variantId: "small" },
        { ...item, variantId: "large" },
      ),
    ).toBe(false);
    expect(sameLine(item, { ...item, variantId: null, colorName: null })).toBe(
      true,
    );
  });
  it("écarte les données invalides et borne le volume du panier", () => {
    expect(parseCart("{")).toEqual([]);
    expect(
      parseCart(
        JSON.stringify([
          item,
          { ...item, priceCents: -1 },
          { ...item, quantity: 0 },
          { ...item, quantity: 1.5 },
          null,
        ]),
      ),
    ).toEqual([item]);
    expect(
      parseCart(
        JSON.stringify(
          Array.from({ length: 80 }, () => ({ ...item, quantity: 1000 })),
        ),
      ),
    ).toHaveLength(50);
    expect(
      parseCart(JSON.stringify([{ ...item, quantity: 1000 }]))[0].quantity,
    ).toBe(99);
  });
  it("rejette du HTML renommé en modèle ou image", async () => {
    for (const ext of [
      "stl",
      "glb",
      "obj",
      "3mf",
      "step",
      "png",
      "jpg",
      "webp",
      "avif",
    ])
      expect(
        await hasExpectedSignature(
          new Blob(["<html><script>alert(1)</script></html>"]),
          ext,
        ),
      ).toBe(false);
  });
  it("valide la taille annoncée par un STL binaire", async () => {
    const bytes = new Uint8Array(134);
    new DataView(bytes.buffer).setUint32(80, 1, true);
    expect(await hasExpectedSignature(new Blob([bytes]), "stl")).toBe(true);
    expect(
      await hasExpectedSignature(new Blob([bytes.slice(0, 100)]), "stl"),
    ).toBe(false);
  });
});
