import { describe, it, expect } from "vitest";
import { lineColorKey, parseCart, sameLine } from "./cart-data";
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
  it("identifie la couleur par sa référence du stock, avant les noms", () => {
    const white = "ref-bambu-matte-ivory-white";
    const black = "ref-bambu-matte-charcoal";
    expect(
      sameLine({ ...item, colorRef: white }, { ...item, colorRef: black }),
    ).toBe(false);
    // Même référence : le libellé affiché (langue, ancien nom) ne change pas la ligne.
    expect(
      sameLine(
        { ...item, colorRef: white, colorName: "Blanc neige" },
        { ...item, colorRef: white, colorName: "Weiss" },
      ),
    ).toBe(true);
    expect(lineColorKey({ colorRef: black, colorName: "Noir" })).toBe(black);
    expect(lineColorKey({})).toBeNull();
  });
  it("une ancienne ligne (nom seul) retrouve sa référence", () => {
    // Une ligne d'avant les couleurs du stock et la même ligne d'après : une seule ligne.
    expect(
      sameLine(
        { ...item, colorName: "Blanc" },
        { ...item, colorRef: "ref-bambu-matte-ivory-white" },
      ),
    ).toBe(true);
    expect(lineColorKey({ colorName: "Bleu" })).toBe(
      "ref-bambu-matte-marine-blue",
    );
    // Un nom inconnu reste un nom : deux « Rouge » se confondent, « Rouge » ≠ « Blanc ».
    expect(lineColorKey({ colorName: "Rouge" })).toBe("Rouge");
    expect(
      sameLine(
        { ...item, colorName: "Rouge" },
        { ...item, colorName: "Blanc" },
      ),
    ).toBe(false);
  });
  it("parseCart rattache l'ancien nom à sa référence et valide le poids", () => {
    const [legacy] = parseCart(
      JSON.stringify([{ ...item, colorName: "Noir", colorHex: "#111111" }]),
    );
    expect(legacy.colorRef).toBe("ref-bambu-matte-charcoal");
    // Le libellé affiché de l'ancienne ligne reste celui du client.
    expect(legacy.colorName).toBe("Noir");
    const [unknown] = parseCart(
      JSON.stringify([{ ...item, colorName: "Rouge" }]),
    );
    expect(unknown.colorRef).toBeUndefined();
    expect(
      parseCart(
        JSON.stringify([
          { ...item, colorRef: "ref-x", weightGrams: 120 },
          { ...item, weightGrams: -3 },
          { ...item, weightGrams: "lourd" },
          { ...item, colorRef: 42 },
        ]),
      ).map((i) => i.weightGrams),
    ).toEqual([120]);
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
