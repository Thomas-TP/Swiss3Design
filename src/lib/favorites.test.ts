import { describe, expect, it } from "vitest";
import { parseFavorites } from "./favorites";

const valid = {
  productId: "p1",
  variantId: null,
  variantName: null,
  colorName: "Rouge",
  colorHex: "#e5231c",
  slug: "vase-spirale",
  name: "Vase spirale",
  priceCents: 4900,
  imageUrl: "https://example.test/vase.webp",
  saleType: "stock",
};

describe("parseFavorites", () => {
  it("relit une liste valide telle quelle", () => {
    expect(parseFavorites(JSON.stringify([valid]))).toEqual([valid]);
  });

  it("renvoie une liste vide pour un stockage absent, vide ou illisible", () => {
    expect(parseFavorites(null)).toEqual([]);
    expect(parseFavorites("")).toEqual([]);
    expect(parseFavorites("{pas du json")).toEqual([]);
    expect(parseFavorites('{"productId":"p1"}')).toEqual([]);
    expect(parseFavorites('"texte"')).toEqual([]);
  });

  it("écarte les entrées qui n'ont pas la forme d'un favori", () => {
    const raw = JSON.stringify([
      valid,
      null,
      "x",
      { ...valid, productId: "" },
      { ...valid, productId: "p2", priceCents: 12.5 },
      { ...valid, productId: "p3", priceCents: -1 },
      { ...valid, productId: "p4", saleType: "autre" },
      { ...valid, productId: "p5", colorName: 42 },
      { ...valid, productId: "p6", name: undefined },
    ]);
    expect(parseFavorites(raw).map((i) => i.productId)).toEqual(["p1"]);
  });

  it("dédoublonne par produit et complète les champs optionnels absents", () => {
    const minimal = {
      productId: "p7",
      slug: "s",
      name: "N",
      priceCents: 100,
      imageUrl: null,
      saleType: "on_demand",
    };
    const [item] = parseFavorites(JSON.stringify([minimal, minimal]));
    expect(parseFavorites(JSON.stringify([minimal, minimal]))).toHaveLength(1);
    expect(item.variantId).toBeNull();
    expect(item.colorName).toBeNull();
  });

  it("ne garde aucune propriété inattendue (quantité, champs ajoutés)", () => {
    const [item] = parseFavorites(
      JSON.stringify([{ ...valid, quantity: 3, extra: "x" }]),
    );
    expect(item).not.toHaveProperty("quantity");
    expect(item).not.toHaveProperty("extra");
  });

  it("borne la taille de la liste", () => {
    const many = Array.from({ length: 500 }, (_, n) => ({
      ...valid,
      productId: `p${n}`,
    }));
    expect(parseFavorites(JSON.stringify(many))).toHaveLength(200);
  });
});
