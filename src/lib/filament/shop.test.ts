import { describe, expect, it } from "vitest";
import { covers } from "./availability";
import {
  LEGACY_COLOR_REFS,
  SHOP_MATERIAL,
  SHOP_WASTE_FACTOR,
  allowedColors,
  colorNameKey,
  combineNeedsByRef,
  findColorOption,
  findShortfalls,
  legacyColorRef,
  requestedColorRef,
  shopLineTracksFilament,
  shopNeedGrams,
  shopNeedsByRef,
  shopReservationGrams,
  shortRefIds,
  sortShopColors,
  studioIdsOfRefs,
  type ClientStock,
} from "./shop";
import { CUSTOM_MATERIAL } from "./constants";

describe("shopNeedGrams : besoin d'une ligne = ceil(poids × quantité × 1,10)", () => {
  it("applique la perte d'impression de 10 %", () => {
    expect(SHOP_WASTE_FACTOR).toBeCloseTo(1.1);
    expect(shopNeedGrams(45, 1)).toBe(50); // 49,5 → 50
    expect(shopNeedGrams(200, 2)).toBe(440);
  });
  it("reste exact là où un flottant dérive (100 g × 3 × 1,10 = 330, pas 331)", () => {
    expect(shopNeedGrams(100, 3)).toBe(330);
    expect(shopNeedGrams(10, 7)).toBe(77);
    expect(shopNeedGrams(250, 4)).toBe(1100);
  });
  it("arrondit toujours au gramme supérieur", () => {
    expect(shopNeedGrams(1, 1)).toBe(2); // 1,1 → 2
    expect(shopNeedGrams(95, 1)).toBe(105); // 104,5 → 105
  });
  it("sans poids connu, la couleur n'est pas suivie (null)", () => {
    expect(shopNeedGrams(null, 3)).toBeNull();
    expect(shopNeedGrams(undefined, 3)).toBeNull();
    expect(shopNeedGrams(0, 3)).toBeNull();
    expect(shopNeedGrams(-5, 3)).toBeNull();
  });
  it("une quantité aberrante vaut une pièce", () => {
    expect(shopNeedGrams(100, 0)).toBe(110);
    expect(shopNeedGrams(100, Number.NaN)).toBe(110);
  });
});

describe("shopLineTracksFilament : seuls les articles à la demande réservent", () => {
  it("à la demande avec un poids : suivi", () => {
    expect(shopLineTracksFilament("on_demand", 120)).toBe(true);
  });
  it("à la demande sans poids : non suivi", () => {
    expect(shopLineTracksFilament("on_demand", null)).toBe(false);
    expect(shopLineTracksFilament("on_demand", 0)).toBe(false);
  });
  it("pièce déjà imprimée (stock) : jamais de contrôle ni de réservation", () => {
    expect(shopLineTracksFilament("stock", 120)).toBe(false);
  });
});

describe("matière : le stock est 100 % PLA", () => {
  it("la matière de la boutique est celle du sur mesure", () => {
    expect(SHOP_MATERIAL).toBe("PLA");
    expect(SHOP_MATERIAL).toBe(CUSTOM_MATERIAL);
  });
});

describe("anciens noms de couleur : correspondance en dur", () => {
  it("rattache Blanc, Noir et Bleu aux références Bambu", () => {
    expect(legacyColorRef("Blanc")).toBe("ref-bambu-matte-ivory-white");
    expect(legacyColorRef("Noir")).toBe("ref-bambu-matte-charcoal");
    expect(legacyColorRef("Bleu")).toBe("ref-bambu-matte-marine-blue");
    expect(Object.keys(LEGACY_COLOR_REFS)).toHaveLength(3);
  });
  it("ignore la casse, les accents et les espaces", () => {
    expect(legacyColorRef("  BLANC ")).toBe("ref-bambu-matte-ivory-white");
    expect(legacyColorRef("noir")).toBe("ref-bambu-matte-charcoal");
    expect(colorNameKey(" Été ")).toBe("ete");
  });
  it("tout autre nom : pas de couleur (le client en rechoisit une)", () => {
    expect(legacyColorRef("Rouge")).toBeNull();
    expect(legacyColorRef("Blanc névé")).toBeNull();
    expect(legacyColorRef("")).toBeNull();
    expect(legacyColorRef(null)).toBeNull();
    expect(legacyColorRef(undefined)).toBeNull();
  });
  it("requestedColorRef : colorRef d'abord, sinon l'ancien nom converti", () => {
    expect(requestedColorRef({ colorRef: "ref-x", color: "Noir" })).toBe(
      "ref-x",
    );
    expect(requestedColorRef({ color: "Noir" })).toBe(
      "ref-bambu-matte-charcoal",
    );
    expect(requestedColorRef({ color: "Rouge" })).toBeNull();
    expect(requestedColorRef({})).toBeNull();
    expect(requestedColorRef({ colorRef: null, color: null })).toBeNull();
  });
});

const options = [
  {
    id: "ref-bambu-matte-ivory-white",
    name: "Blanc névé",
    officialName: "Ivory White",
  },
  { id: "ref-bambu-matte-charcoal", name: "Encre", officialName: "Charcoal" },
  {
    id: "ref-polymaker-cotton-white",
    name: "Cotton White",
    officialName: "Cotton White",
  },
];

describe("findColorOption : la couleur demandée par un agent ou un lien", () => {
  it("par id, nom affiché, nom officiel, ou ancien nom", () => {
    expect(findColorOption(options, "ref-bambu-matte-charcoal")?.name).toBe(
      "Encre",
    );
    expect(findColorOption(options, "blanc névé")?.id).toBe(
      "ref-bambu-matte-ivory-white",
    );
    expect(findColorOption(options, "Ivory White")?.id).toBe(
      "ref-bambu-matte-ivory-white",
    );
    expect(findColorOption(options, "Noir")?.id).toBe(
      "ref-bambu-matte-charcoal",
    );
  });
  it("inconnue : rien", () => {
    expect(findColorOption(options, "Rouge")).toBeUndefined();
    expect(findColorOption(options, "")).toBeUndefined();
    expect(findColorOption(options, null)).toBeUndefined();
  });
  it("un ancien nom dont la référence est exclue de l'article ne retombe sur rien", () => {
    expect(findColorOption([options[2]], "Blanc")).toBeUndefined();
  });
});

describe("allowedColors : toutes les couleurs, moins les exclusions de l'article", () => {
  const refs = [{ id: "a" }, { id: "b" }, { id: "c" }];
  it("sans exclusion, toutes", () => {
    expect(allowedColors(refs, undefined)).toEqual(refs);
    expect(allowedColors(refs, new Set())).toEqual(refs);
  });
  it("retire les références décochées, dans l'ordre", () => {
    expect(allowedColors(refs, new Set(["b"]))).toEqual([
      { id: "a" },
      { id: "c" },
    ]);
  });
  it("une exclusion d'une référence qui n'est plus proposée est sans effet", () => {
    expect(allowedColors(refs, new Set(["zzz"]))).toEqual(refs);
  });
  it("tout exclure laisse un article sans couleur", () => {
    expect(allowedColors(refs, new Set(["a", "b", "c"]))).toEqual([]);
  });
});

describe("sortShopColors : la palette du Studio d'abord", () => {
  const order = ["blanc-neve", "gris-molasse", "encre"];
  it("les couleurs du Studio dans l'ordre de la palette, puis les autres par marque et nom", () => {
    const sorted = sortShopColors(
      [
        { studioId: null, brand: "Polymaker", officialName: "Cotton White" },
        { studioId: "encre", brand: "Bambu Lab", officialName: "Charcoal" },
        { studioId: null, brand: "Bambu Lab", officialName: "Midnight Blaze" },
        { studioId: "blanc-neve", brand: "Bambu Lab", officialName: "Ivory" },
      ],
      order,
    );
    expect(sorted.map((c) => c.officialName)).toEqual([
      "Ivory",
      "Charcoal",
      "Midnight Blaze",
      "Cotton White",
    ]);
  });
});

describe("combineNeedsByRef : Studio + boutique sur la même bobine", () => {
  const refs = [
    { id: "r-white", studioId: "blanc-neve" },
    { id: "r-black", studioId: "encre" },
    { id: "r-silk", studioId: null },
  ];
  it("additionne le Studio (par id de palette) et la boutique (par id de référence)", () => {
    const needs = combineNeedsByRef(refs, {
      studio: { "blanc-neve": 120 },
      shop: { "r-white": 330, "r-silk": 50 },
    });
    expect(needs).toEqual([
      { refId: "r-white", studioId: "blanc-neve", needGrams: 450 },
      { refId: "r-silk", studioId: null, needGrams: 50 },
    ]);
  });
  it("ignore ce qui ne demande rien", () => {
    expect(combineNeedsByRef(refs, { studio: { encre: 0 }, shop: {} })).toEqual(
      [],
    );
  });
  it("une référence hors Studio ne reçoit jamais de besoin Studio", () => {
    expect(
      combineNeedsByRef([{ id: "r-silk", studioId: null }], {
        studio: { "r-silk": 99 },
        shop: {},
      }),
    ).toEqual([]);
  });
});

describe("findShortfalls : un seul contrôle par référence", () => {
  const avail = new Map([
    ["r-white", 500],
    ["r-black", 100],
  ]);
  it("le besoin COMBINÉ dépasse le disponible alors que chaque part seule passerait", () => {
    // 300 g (Studio) + 250 g (boutique) = 550 g > 500 − 20 g de marge.
    const need = combineNeedsByRef(
      [{ id: "r-white", studioId: "blanc-neve" }],
      { studio: { "blanc-neve": 300 }, shop: { "r-white": 250 } },
    );
    expect(findShortfalls(need, avail, covers)).toEqual([
      {
        refId: "r-white",
        studioId: "blanc-neve",
        needGrams: 550,
        availableGrams: 500,
      },
    ]);
    // Chaque part seule passe.
    expect(
      findShortfalls([{ ...need[0], needGrams: 300 }], avail, covers),
    ).toEqual([]);
    expect(
      findShortfalls([{ ...need[0], needGrams: 250 }], avail, covers),
    ).toEqual([]);
  });
  it("respecte la marge de fin de bobine de 20 g", () => {
    const at = (needGrams: number) =>
      findShortfalls(
        [{ refId: "r-black", studioId: "encre", needGrams }],
        avail,
        covers,
      );
    expect(at(80)).toEqual([]);
    expect(at(81)).toHaveLength(1);
  });
  it("une référence sans disponible connu compte pour 0 g", () => {
    expect(
      findShortfalls(
        [{ refId: "r-unknown", studioId: null, needGrams: 5 }],
        avail,
        covers,
      ),
    ).toHaveLength(1);
  });
});

describe("shopReservationGrams : grammes d'UNE pièce écrits à la commande", () => {
  it("le poids arrondi au gramme supérieur, seulement pour un article à la demande", () => {
    expect(shopReservationGrams("on_demand", 320)).toBe(320);
    expect(shopReservationGrams("on_demand", 99.2)).toBe(100);
  });
  it("rien à écrire pour un article en stock ou sans poids", () => {
    expect(shopReservationGrams("stock", 320)).toBeNull();
    expect(shopReservationGrams("on_demand", null)).toBeNull();
    expect(shopReservationGrams("on_demand", 0)).toBeNull();
  });
  it("× quantité + 10 % redonne le besoin du paiement (même calcul que la requête de réservation)", () => {
    // La requête SQL fait CEIL(grammes d'une pièce × quantité × 110 / 100).
    for (const [weight, quantity] of [
      [320, 1],
      [280, 3],
      [8, 7],
      [45, 2],
    ]) {
      const perPiece = shopReservationGrams("on_demand", weight)!;
      expect(shopNeedGrams(perPiece, quantity)).toBe(
        shopNeedGrams(weight, quantity),
      );
    }
  });
});

describe("shopNeedsByRef : le besoin des lignes de la boutique, par référence", () => {
  const line = (
    colorRef: string | null,
    quantity: number,
    over: Partial<{
      saleType: "stock" | "on_demand";
      weightGrams: number | null;
    }> = {},
  ) => ({
    colorRef,
    quantity,
    saleType: "on_demand" as const,
    weightGrams: 100,
    ...over,
  });
  it("additionne les lignes d'une même couleur, chacune arrondie avant la somme", () => {
    expect(
      shopNeedsByRef([
        line("r-white", 3),
        line("r-white", 1, { weightGrams: 45 }),
      ]),
    ).toEqual({ "r-white": 330 + 50 });
  });
  it("sépare les couleurs", () => {
    expect(shopNeedsByRef([line("r-white", 1), line("r-black", 2)])).toEqual({
      "r-white": 110,
      "r-black": 220,
    });
  });
  it("ignore les articles en stock, sans poids ou sans couleur", () => {
    expect(
      shopNeedsByRef([
        line("r-white", 1, { saleType: "stock" }),
        line("r-white", 1, { weightGrams: null }),
        line(null, 1),
      ]),
    ).toEqual({});
  });
});

describe("shortRefIds : le panier signale ce que le paiement refuserait", () => {
  const stock = (refs: Record<string, number>): ClientStock => ({
    studio: { "blanc-neve": refs["r-white"] ?? 0 },
    refs,
    studioOfRef: { "r-white": "blanc-neve" },
  });
  it("une couleur dont la capacité ne couvre pas l'article est épuisée", () => {
    expect(
      shortRefIds(stock({ "r-white": 300, "r-black": 900 }), [], {
        "r-white": 330,
        "r-black": 330,
      }),
    ).toEqual(new Set(["r-white"]));
  });
  it("additionne le Studio et la boutique sur la même bobine", () => {
    // 200 g au Studio + 150 g à la boutique = 350 g > 300 g, alors que chaque part passe seule.
    const s = stock({ "r-white": 300 });
    expect(shortRefIds(s, [{ "blanc-neve": 200 }], { "r-white": 150 })).toEqual(
      new Set(["r-white"]),
    );
    expect(shortRefIds(s, [{ "blanc-neve": 200 }], {})).toEqual(new Set());
    expect(shortRefIds(s, [], { "r-white": 150 })).toEqual(new Set());
  });
  it("additionne les lignes du Studio entre elles", () => {
    expect(
      shortRefIds(
        stock({ "r-white": 300 }),
        [{ "blanc-neve": 160 }, { "blanc-neve": 160 }],
        {},
      ),
    ).toEqual(new Set(["r-white"]));
  });
  it("capacité inconnue, plafonnée ou absente : jamais épuisée", () => {
    expect(
      shortRefIds(null, [{ "blanc-neve": 9999 }], { "r-white": 9999 }),
    ).toEqual(new Set());
    expect(
      shortRefIds(stock({ "r-white": 1500 }), [], { "r-white": 9999 }),
    ).toEqual(new Set());
    expect(shortRefIds(stock({}), [], { "r-unknown": 50 })).toEqual(new Set());
  });
  it("studioIdsOfRefs repère la ligne du Studio d'une référence épuisée", () => {
    const s = stock({ "r-white": 0 });
    expect(studioIdsOfRefs(s, new Set(["r-white", "r-silk"]))).toEqual(
      new Set(["blanc-neve"]),
    );
    expect(studioIdsOfRefs(null, new Set(["r-white"]))).toEqual(new Set());
  });
});
