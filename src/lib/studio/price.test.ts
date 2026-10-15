import { describe, expect, it } from "vitest";
import { mulberry32 } from "./kernel/rng";
import {
  CHANGE_CENTS,
  PRICE_LOCALE,
  STUDIO_QTY_MAX,
  STUDIO_RATES,
  clampQuantity,
  studioLineCents,
  studioUnitCents,
} from "./price";
import { studioPrice } from "./price-figures";
import {
  BORNE_DEFAULT,
  CARTOUCHE_DEFAULT,
  DEFAULT_CONFIGS,
  LAVAUX_DEFAULT,
  MONTAGNE_DEFAULT,
} from "./presets";
import { computeStats } from "./stats";
import { DEFAULT_TEXTS } from "./text/fields";
import type { StudioObjectId } from "./types";

// Barème de l'achat direct (décision du 14.10.2026). Les valeurs attendues
// viennent du propriétaire et se vérifient avec les VRAIES statistiques.

/** La formule en flottants, telle qu'écrite par le propriétaire (référence). */
function referenceUnit(
  object: StudioObjectId,
  grams: number,
  changes: number,
  q: number,
): number {
  const { F, U, r } = STUDIO_RATES[object];
  const raw = (F + changes * CHANGE_CENTS) / q + U + grams * r;
  return q === 1
    ? Math.round((raw - 90) / 100) * 100 + 90
    : Math.round(raw / 10) * 10;
}

describe("valeurs attendues avec les vraies statistiques", () => {
  const price = (object: StudioObjectId, q: number) =>
    studioPrice(DEFAULT_CONFIGS[object], DEFAULT_TEXTS[object], q);

  it("Montagne par défaut, une pièce : CHF 49.90", () => {
    expect(price("montagne", 1).unitCents).toBe(4990);
  });
  it("Vase par défaut : CHF 44.90", () => {
    expect(price("lavaux", 1).unitCents).toBe(4490);
  });
  it("Borne par défaut : CHF 24.90", () => {
    expect(price("borne", 1).unitCents).toBe(2490);
  });
  it("Cartouche par défaut : 17.90 à q=1, 4.90 × 10, 4.20 × 20", () => {
    expect(price("cartouche", 1).unitCents).toBe(1790);
    expect(price("cartouche", 10).unitCents).toBe(490);
    expect(price("cartouche", 10).totalCents).toBe(4900);
    expect(price("cartouche", 20).unitCents).toBe(420);
    expect(price("cartouche", 20).totalCents).toBe(8400);
  });

  it("les chiffres de départ sont ceux mesurés (grammes et changements)", () => {
    const s = (config: Parameters<typeof computeStats>[0], o: StudioObjectId) =>
      computeStats(config, DEFAULT_TEXTS[o], undefined, PRICE_LOCALE);
    expect([
      s(LAVAUX_DEFAULT, "lavaux").grams,
      s(LAVAUX_DEFAULT, "lavaux").changes,
    ]).toEqual([92.1, 2]);
    expect([
      s(MONTAGNE_DEFAULT, "montagne").grams,
      s(MONTAGNE_DEFAULT, "montagne").changes,
    ]).toEqual([37.6, 3]);
    expect([
      s(BORNE_DEFAULT, "borne").grams,
      s(BORNE_DEFAULT, "borne").changes,
    ]).toEqual([2.5, 1]);
    expect([
      s(CARTOUCHE_DEFAULT, "cartouche").grams,
      s(CARTOUCHE_DEFAULT, "cartouche").changes,
    ]).toEqual([10.4, 1]);
  });
});

describe("arrondis", () => {
  it("q = 1 : au « ,90 » le plus proche, demi vers le haut", () => {
    // Cartouche : (1250 + 0) + 250 + g × 10 ; g = 0 → brut 1500 → 14.9 → 1490.
    expect(studioUnitCents("cartouche", { grams: 0, changes: 0 }, 1)).toBe(
      1490,
    );
    // brut 1539 → (1539 − 90)/100 = 14.49 → 14 → 1490 ; brut 1540 → 14.5 → 15 → 1590.
    expect(studioUnitCents("cartouche", { grams: 3.9, changes: 0 }, 1)).toBe(
      1490,
    );
    expect(studioUnitCents("cartouche", { grams: 4, changes: 0 }, 1)).toBe(
      1590,
    );
    expect(
      studioUnitCents("cartouche", { grams: 3.9, changes: 0 }, 1) % 100,
    ).toBe(90);
  });

  it("q ≥ 2 : au multiple de 10 centimes le plus proche, demi vers le haut", () => {
    // Borne q=2 : (950)/2 + 1310 + g × 30 = 1785 + 30 g ; g = 0.5 → 1800 pile.
    expect(studioUnitCents("borne", { grams: 0.5, changes: 0 }, 2)).toBe(1800);
    // Borne q=2, g = 0.1 : 1788 → 1790 ; g = 0.2 : 1791 → 1790 ; g = 0.4 : 1797 → 1800.
    expect(studioUnitCents("borne", { grams: 0.1, changes: 0 }, 2)).toBe(1790);
    expect(studioUnitCents("borne", { grams: 0.2, changes: 0 }, 2)).toBe(1790);
    expect(studioUnitCents("borne", { grams: 0.4, changes: 0 }, 2)).toBe(1800);
    // Un demi exact monte : Borne q=2, brut 1795 (g = 1/3 impossible) → cas de la Cartouche
    // q=2, changes 1 : 1400/2 + 250 + g × 10 = 950 + 10 g ; g = 0.5 → 955 → 960.
    expect(studioUnitCents("cartouche", { grams: 0.5, changes: 1 }, 2)).toBe(
      960,
    );
  });

  it("le total d'une ligne est le prix unitaire × quantité", () => {
    for (const q of [1, 2, 3, 7, 20])
      expect(studioLineCents("lavaux", { grams: 92.1, changes: 2 }, q)).toBe(
        studioUnitCents("lavaux", { grams: 92.1, changes: 2 }, q) * q,
      );
  });

  it("quantité ramenée à 1..20", () => {
    expect(clampQuantity(0)).toBe(1);
    expect(clampQuantity(-4)).toBe(1);
    expect(clampQuantity(Number.NaN)).toBe(1);
    expect(clampQuantity(2.9)).toBe(2);
    expect(clampQuantity(999)).toBe(STUDIO_QTY_MAX);
  });
});

describe("arithmétique entière = formule en flottants du propriétaire", () => {
  it("10 000 tirages (objet, grammes à 0,1 g, changements, quantité)", () => {
    const rng = mulberry32(14102026);
    const objects: StudioObjectId[] = [
      "lavaux",
      "montagne",
      "cartouche",
      "borne",
    ];
    for (let i = 0; i < 10_000; i++) {
      const object = objects[Math.floor(rng() * 4)];
      const grams = Math.round(rng() * 4000) / 10;
      const changes = Math.floor(rng() * 4);
      const q = 1 + Math.floor(rng() * STUDIO_QTY_MAX);
      const got = studioUnitCents(object, { grams, changes }, q);
      expect(Number.isInteger(got)).toBe(true);
      // Hors des demi exacts, où les flottants peuvent hésiter, les deux concordent.
      const { F, U, r } = STUDIO_RATES[object];
      const raw = (F + changes * CHANGE_CENTS) / q + U + grams * r;
      const x = q === 1 ? (raw - 90) / 100 : raw / 10;
      if (Math.abs(x - Math.floor(x) - 0.5) < 1e-6) continue;
      expect(got).toBe(referenceUnit(object, grams, changes, q));
    }
  });

  it("le total d'une quantité plus grande ne baisse jamais (q = 1..20)", () => {
    const rng = mulberry32(7);
    const objects: StudioObjectId[] = [
      "lavaux",
      "montagne",
      "cartouche",
      "borne",
    ];
    for (let i = 0; i < 400; i++) {
      const object = objects[i % 4];
      const figures = {
        grams: Math.round(rng() * 3000) / 10,
        changes: Math.floor(rng() * 4),
      };
      let previous = 0;
      for (let q = 1; q <= STUDIO_QTY_MAX; q++) {
        const total = studioLineCents(object, figures, q);
        expect(total).toBeGreaterThan(previous);
        previous = total;
      }
    }
  });

  it("le prix unitaire ne monte jamais avec la quantité (q ≥ 2)", () => {
    const figures = { grams: 40, changes: 3 };
    let previous = Infinity;
    for (let q = 2; q <= STUDIO_QTY_MAX; q++) {
      const unit = studioUnitCents("montagne", figures, q);
      expect(unit).toBeLessThanOrEqual(previous);
      previous = unit;
    }
  });
});

describe("le prix ne dépend pas de la langue", () => {
  it("Montagne : même prix quelle que soit la langue de la page (calcul en français)", () => {
    const configs = [
      MONTAGNE_DEFAULT,
      { ...MONTAGNE_DEFAULT, altMode: "saisie" as const, altitude: 2566 },
      { ...MONTAGNE_DEFAULT, altMode: "saisie" as const, altitude: 4478 },
    ];
    for (const config of configs)
      for (const peak of ["Cervin", "Mont-Blanc de Cheilon", "Piz Bernina"]) {
        const prices = (["fr", "de", "it", "en"] as const).map((locale) => {
          // L'écran calcule les statistiques dans la langue de la page…
          const shown = computeStats(config, { peak }, undefined, locale);
          // …et le prix repart toujours des chiffres en langue canonique.
          return studioPrice(config, { peak }, 1, { locale, stats: shown })
            .unitCents;
        });
        expect(new Set(prices).size).toBe(1);
      }
  });
});
