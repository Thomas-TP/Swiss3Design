import { describe, expect, it } from "vitest";
import {
  filamentGramsFromSummary,
  filamentGramsOf,
  needIfAssigned,
  scaleGrams,
  sumGrams,
} from "./filament-need";
import { bandStatsFor } from "./band-stats";
import { HERO_CONFIG, MONTAGNE_DEFAULT, CARTOUCHE_DEFAULT } from "./presets";
import { PRINT } from "./print-params";
import { computeStats } from "./stats";

describe("filamentGramsOf : grammes par couleur d'une pièce", () => {
  it("la somme par couleur couvre la masse de la pièce (± arrondis au gramme supérieur)", () => {
    for (const config of [HERO_CONFIG, MONTAGNE_DEFAULT, CARTOUCHE_DEFAULT]) {
      const texts = { name: "Léa", peak: "Cervin", role: "Atelier" };
      const grams = filamentGramsOf(config, texts);
      const total = Object.values(grams).reduce((s, g) => s + (g ?? 0), 0);
      const stats = computeStats(config, texts);
      expect(total).toBeGreaterThanOrEqual(stats.grams - 0.2);
      expect(total).toBeLessThanOrEqual(
        stats.grams + Object.keys(grams).length + 0.5,
      );
    }
  });

  it("chaque couleur de la configuration est comptée, entière", () => {
    const grams = filamentGramsOf(HERO_CONFIG);
    expect(Object.keys(grams).sort()).toEqual(
      HERO_CONFIG.bands.map((b) => b.filament).sort(),
    );
    for (const g of Object.values(grams))
      expect(Number.isInteger(g)).toBe(true);
  });

  it("la purge d'un changement est imputée au filament entrant", () => {
    const summary = bandStatsFor(HERO_CONFIG, undefined, PRINT);
    const grams = filamentGramsFromSummary(summary);
    // Bande 0 : pas de changement à l'entrée ; bande 1 : une purge.
    expect(grams[summary.bands[0].filament]).toBe(
      Math.ceil(summary.bands[0].grams - 1e-9),
    );
    expect(grams[summary.bands[1].filament]).toBe(
      Math.ceil(summary.bands[1].grams + PRINT.purgeGrams - 1e-9),
    );
  });

  it("une pièce d'une seule couleur : aucune purge", () => {
    const solid = {
      ...HERO_CONFIG,
      bands: [{ filament: "encre" as const, toMm: HERO_CONFIG.h }],
    };
    const grams = filamentGramsOf(solid);
    expect(Object.keys(grams)).toEqual(["encre"]);
    expect(grams.encre).toBe(Math.ceil(computeStats(solid).grams - 1e-9));
  });
});

describe("needIfAssigned : une couleur candidate sur une bande", () => {
  const summary = bandStatsFor(HERO_CONFIG, undefined, PRINT);

  it("la couleur déjà en place retrouve son besoin", () => {
    const grams = filamentGramsFromSummary(summary);
    const band = summary.bands[1];
    expect(needIfAssigned(summary, 1, band.filament)).toBe(
      grams[band.filament],
    );
  });

  it("une couleur absente de la pièce ne consomme que la bande (+ sa purge)", () => {
    const need = needIfAssigned(summary, 1, "rose-alpes");
    expect(need).toBe(
      Math.ceil(summary.bands[1].grams + PRINT.purgeGrams - 1e-9),
    );
  });

  it("multiplie par la quantité", () => {
    expect(needIfAssigned(summary, 1, "rose-alpes", 3)).toBe(
      needIfAssigned(summary, 1, "rose-alpes") * 3,
    );
  });

  it("la même couleur sur deux bandes : une seule purge de moins, grammes cumulés", () => {
    // Bandes 0 et 1 en « encre » : aucun changement entre elles.
    const need = needIfAssigned(summary, 1, summary.bands[0].filament);
    expect(need).toBeGreaterThan(summary.bands[0].grams);
  });
});

describe("scaleGrams et sumGrams", () => {
  it("multiplie et additionne par couleur", () => {
    const a = scaleGrams({ encre: 10, "blanc-neve": 5 }, 3);
    expect(a).toEqual({ encre: 30, "blanc-neve": 15 });
    expect(sumGrams([a, { encre: 2 }])).toEqual({
      encre: 32,
      "blanc-neve": 15,
    });
  });
});
