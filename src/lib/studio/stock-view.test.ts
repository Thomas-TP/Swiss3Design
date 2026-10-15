import { describe, expect, it } from "vitest";
import { bandStatsFor } from "./band-stats";
import { filamentGramsOf } from "./filament-need";
import { BORNE_DEFAULT, HERO_CONFIG } from "./presets";
import { PRINT } from "./print-params";
import { EMPTY_STOCK_VIEW, isShort, makeStockView } from "./stock-view";

const summary = bandStatsFor(HERO_CONFIG, undefined, PRINT);
const needs = filamentGramsOf(HERO_CONFIG);

describe("isShort", () => {
  it("sans capacité connue ou pour une couleur non suivie : jamais épuisée", () => {
    expect(isShort(null, "encre", 9999)).toBe(false);
    expect(isShort({}, "encre", 9999)).toBe(false);
  });
  it("épuisée quand le besoin dépasse la capacité", () => {
    expect(isShort({ encre: 100 }, "encre", 101)).toBe(true);
    expect(isShort({ encre: 100 }, "encre", 100)).toBe(false);
    expect(isShort({ encre: 0 }, "encre", 1)).toBe(true);
  });
  it("une capacité plafonnée à 1500 g ne grise jamais (le serveur tranche)", () => {
    expect(isShort({ encre: 1500 }, "encre", 4000)).toBe(false);
  });
});

describe("makeStockView : la pièce du héros", () => {
  const first = HERO_CONFIG.bands[0].filament;

  it("sans capacité : rien n'est grisé", () => {
    expect(makeStockView(null, summary, HERO_CONFIG, 1)).toBe(EMPTY_STOCK_VIEW);
  });

  it("une couleur de la pièce dont la capacité est trop juste est signalée", () => {
    const view = makeStockView(
      { [first]: (needs[first] ?? 0) - 1 },
      summary,
      HERO_CONFIG,
      1,
    );
    expect([...view.short]).toEqual([first]);
  });

  it("la quantité multiplie le besoin", () => {
    const capacity = { [first]: (needs[first] ?? 0) * 2 };
    expect(makeStockView(capacity, summary, HERO_CONFIG, 2).short.size).toBe(0);
    expect(
      makeStockView(capacity, summary, HERO_CONFIG, 3).short.has(first),
    ).toBe(true);
  });

  it("une couleur épuisée est grisée pour chaque bande, pas les autres", () => {
    const view = makeStockView({ "rose-alpes": 0 }, summary, HERO_CONFIG, 1);
    for (let band = 0; band < summary.bands.length; band++)
      expect([...view.forBand(band)]).toEqual(["rose-alpes"]);
  });

  it("une couleur dont la capacité suffit à une bande mais pas à deux n'est grisée que là où elle déborde", () => {
    const bandGrams = summary.bands[1].grams;
    // Capacité entre le besoin d'une bande et celui de deux bandes.
    const cap = Math.ceil(bandGrams + PRINT.purgeGrams) + 1;
    const view = makeStockView({ "rose-alpes": cap }, summary, HERO_CONFIG, 1);
    expect(view.forBand(1).has("rose-alpes")).toBe(false);
    // Avec 5 pièces, même une seule bande ne passe plus.
    const five = makeStockView({ "rose-alpes": cap }, summary, HERO_CONFIG, 5);
    expect(five.forBand(1).has("rose-alpes")).toBe(true);
  });
});

describe("makeStockView : pièces plates", () => {
  const borne = { ...BORNE_DEFAULT, mode: "relief" as const };
  const flat = bandStatsFor(borne, { text: "Léa" }, PRINT);

  it("plaque et encre se lisent dans l'ordre du mode (relief : plaque puis encre)", () => {
    const view = makeStockView({ "rose-alpes": 0 }, flat, borne, 1);
    expect(view.forRole("plate").has("rose-alpes")).toBe(true);
    expect(view.forRole("ink").has("rose-alpes")).toBe(true);
  });

  it("une pièce sans texte n'a qu'une bande : l'encre ne consomme rien, rien à griser", () => {
    const bare = bandStatsFor(borne, {}, PRINT);
    const view = makeStockView({ "rose-alpes": 0 }, bare, borne, 1);
    expect(bare.bands).toHaveLength(1);
    expect(view.forRole("ink").size).toBe(0);
    expect(view.forRole("plate").has("rose-alpes")).toBe(true);
  });

  it("un vase n'a pas de rôle plaque ou encre", () => {
    const view = makeStockView({ "rose-alpes": 0 }, summary, HERO_CONFIG, 1);
    expect(view.forRole("plate").size).toBe(0);
  });
});
