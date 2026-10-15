import { describe, expect, it } from "vitest";
import { buildSellableSkus, skuIndex, type CatalogRows } from "./catalog";
import { CheckoutError, resolveLine } from "./checkout-core";

// Les couleurs de la boutique sont des références du stock (15.10.2026) : le flux
// et les achats d'agents les retrouvent par nom, par référence, par nom officiel ou
// par l'un des anciens noms de la palette (« Blanc », « Noir », « Bleu »).
const rows: CatalogRows = {
  products: [
    {
      id: "p-lampe",
      slug: "lampe-voronoi",
      priceCents: 4990,
      saleType: "on_demand",
      productionDays: 5,
      material: "PLA",
      dimensionsMm: null,
      weightGrams: 320,
      model3dUrl: null,
      stock: null,
    },
  ],
  translations: [
    {
      productId: "p-lampe",
      locale: "fr",
      name: "Lampe",
      description: "Lampe.",
    },
  ],
  images: [],
  variants: [],
  colors: [
    {
      productId: "p-lampe",
      name: "Blanc névé",
      hex: "#FFFFFF",
      refId: "ref-bambu-matte-ivory-white",
      officialName: "Ivory White",
    },
    {
      productId: "p-lampe",
      name: "Encre",
      hex: "#000000",
      refId: "ref-bambu-matte-charcoal",
      officialName: "Charcoal",
    },
    {
      productId: "p-lampe",
      name: "Bleu Léman",
      hex: "#0078BF",
      refId: "ref-bambu-matte-marine-blue",
      officialName: "Marine Blue",
    },
  ],
  categories: [],
  ratings: [],
};
const skus = buildSellableSkus(rows);
const index = skuIndex(skus);

describe("catalogue : une ligne par couleur du stock", () => {
  it("porte la référence et le nom officiel de chaque couleur", () => {
    const white = skus.find((s) => s.colorName === "Blanc névé")!;
    expect(white.sku).toBe("lampe-voronoi--blanc-neve");
    expect(white.colorRef).toBe("ref-bambu-matte-ivory-white");
    expect(white.colorOfficialName).toBe("Ivory White");
    expect(skus).toHaveLength(3);
  });
  it("un produit sans couleur du stock n'a ni suffixe ni référence", () => {
    const [sku] = buildSellableSkus({ ...rows, colors: [] });
    expect(sku.sku).toBe("lampe-voronoi");
    expect(sku.colorRef).toBeNull();
  });
});

describe("resolveLine : la couleur demandée par un agent", () => {
  const pick = (color: string) =>
    resolveLine({ slug: "lampe-voronoi", color }, skus, index).colorRef;

  it("par nom du flux, sans tenir compte de la casse ni des accents", () => {
    expect(pick("blanc neve")).toBe("ref-bambu-matte-ivory-white");
    expect(pick("ENCRE")).toBe("ref-bambu-matte-charcoal");
  });
  it("par référence du stock", () => {
    expect(pick("ref-bambu-matte-marine-blue")).toBe(
      "ref-bambu-matte-marine-blue",
    );
  });
  it("par nom officiel", () => {
    expect(pick("Ivory White")).toBe("ref-bambu-matte-ivory-white");
    expect(pick("marine blue")).toBe("ref-bambu-matte-marine-blue");
  });
  it("par ancien nom de la palette (Blanc, Noir, Bleu)", () => {
    expect(pick("Blanc")).toBe("ref-bambu-matte-ivory-white");
    expect(pick("Noir")).toBe("ref-bambu-matte-charcoal");
    expect(pick("Bleu")).toBe("ref-bambu-matte-marine-blue");
  });
  it("une couleur inconnue ou absente est refusée", () => {
    expect(() => pick("Rouge")).toThrow(CheckoutError);
    expect(() => resolveLine({ slug: "lampe-voronoi" }, skus, index)).toThrow(
      /colour/,
    );
  });
});
