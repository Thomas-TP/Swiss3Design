import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl/server", () => ({
  // Traducteur factice : le nom d'une couleur du Studio devient « FR:<id> ».
  getTranslations: async () => (key: string) => `FR:${key}`,
}));

import { loadExclusions, loadProductColors, loadShopRefs } from "./shop-db";

type Row = Record<string, unknown>;
const ref = (id: string, extra: Row = {}) => ({
  id,
  brand: "Bambu Lab",
  rangeName: "PLA Matte",
  officialName: id,
  hex: "#FFFFFF",
  hex2: null,
  hex3: null,
  hexConfirmed: true,
  studioId: null,
  active: true,
  customOk: true,
  ...extra,
});

/** Faux `select().from(table).where(...)[.orderBy(...)]` : renvoie les lignes de la table demandée. */
function fakeDb(tables: { refs?: Row[]; exclusions?: Row[] }, failOn?: string) {
  const run = (rows: Row[] | undefined, name: string) => async () => {
    if (failOn === name)
      throw Object.assign(new Error("Failed query"), {
        cause: { code: "42P01" },
      });
    return rows ?? [];
  };
  return {
    select: () => ({
      from: (table: { [k: symbol]: unknown }) => {
        const label = Object.getOwnPropertySymbols(table)
          .map((s) => String(table[s]))
          .join(" ");
        // Les exclusions se lisent au `where` ; les références sont ensuite triées.
        return label.includes("product_filament_exclusions")
          ? { where: run(tables.exclusions, "exclusions") }
          : { where: () => ({ orderBy: run(tables.refs, "refs") }) };
      },
    }),
  } as unknown as Parameters<typeof loadShopRefs>[0];
}

describe("couleurs de la boutique : tolérance aux migrations absentes", () => {
  it("table des références absente : aucune couleur, la boutique reste affichable", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await loadShopRefs(fakeDb({}, "refs"))).toEqual([]);
    warn.mockRestore();
  });

  it("migration 0011 absente : aucune exclusion", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const exclusions = await loadExclusions(fakeDb({}, "exclusions"), ["p1"]);
    expect(exclusions.size).toBe(0);
    warn.mockRestore();
  });

  it("une autre erreur remonte (rien n'est masqué)", async () => {
    const db = {
      select: () => ({
        from: () => ({
          where: () => ({
            orderBy: async () => {
              throw new Error("connexion perdue");
            },
          }),
        }),
      }),
    } as unknown as Parameters<typeof loadShopRefs>[0];
    await expect(loadShopRefs(db)).rejects.toThrow("connexion perdue");
  });
});

describe("loadProductColors : toutes les couleurs du stock, moins les exclusions de l'article", () => {
  it("chaque article reçoit les références, sauf ses cases décochées ; noms de la palette du Studio traduits", async () => {
    const db = fakeDb({
      refs: [
        ref("r-white", { studioId: "blanc-neve" }),
        ref("r-black", { studioId: "encre" }),
        ref("r-silk", { officialName: "Midnight Blaze", hex2: "#7D1B49" }),
      ],
      exclusions: [{ productId: "p2", refId: "r-black" }],
    });
    const byProduct = await loadProductColors(db, ["p1", "p2"], "fr");
    expect(byProduct.get("p1")?.map((c) => c.id)).toEqual([
      "r-white",
      "r-black",
      "r-silk",
    ]);
    expect(byProduct.get("p2")?.map((c) => c.id)).toEqual([
      "r-white",
      "r-silk",
    ]);
    const white = byProduct.get("p1")![0];
    expect(white.name).toBe("FR:filaments.blanc-neve");
    const silk = byProduct.get("p1")![2];
    expect(silk.name).toBe("Midnight Blaze");
    expect(silk.hexes).toEqual(["#FFFFFF", "#7D1B49"]);
  });

  it("sans article, aucune lecture", async () => {
    expect((await loadProductColors(fakeDb({}), [], "fr")).size).toBe(0);
  });
});
