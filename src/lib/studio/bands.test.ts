// Opérations sur les bandes (brief « Strates », §6.4) : quelle que soit la
// séquence de gestes, le résultat reste une configuration valide.
import { describe, expect, it } from "vitest";
import {
  BAND_STEP_MM,
  addBand,
  bandThicknesses,
  boundaryRange,
  canAddBand,
  canRemoveBand,
  moveBoundary,
  quantizeMm,
  removeBand,
  setBandFilament,
} from "./bands";
import { FILAMENT_IDS } from "./filaments";
import { intBetween, mulberry32, pick } from "./kernel/rng";
import { HERO_CONFIG } from "./presets";
import { MAX_BANDS, MIN_BAND_MM, lavauxSchema } from "./schemas";
import type { Band, LavauxConfig } from "./types";

const H = 150;
const hero = HERO_CONFIG.bands;

/** Valide aussi au regard du schéma : croissantes, finissent à h, 1 à 4 bandes. */
function expectValid(bands: readonly Band[], h = H) {
  const parsed = lavauxSchema.safeParse({ ...HERO_CONFIG, h, bands });
  expect(parsed.success, `${JSON.stringify(bands)}`).toBe(true);
  bands.forEach((b, k) => {
    const from = k === 0 ? 0 : bands[k - 1].toMm;
    expect(
      b.toMm - from,
      `bande ${k} ${JSON.stringify(bands)}`,
    ).toBeGreaterThanOrEqual(MIN_BAND_MM - 1e-9);
  });
  // Frontières intérieures à la couche : multiples de 0,2 mm à 1e-6 près.
  for (const b of bands.slice(0, -1)) {
    expect(
      Math.abs(b.toMm / BAND_STEP_MM - Math.round(b.toMm / BAND_STEP_MM)),
    ).toBeLessThan(1e-6);
  }
  expect(bands[bands.length - 1].toMm).toBe(h);
  expect(bands.length).toBeGreaterThanOrEqual(1);
  expect(bands.length).toBeLessThanOrEqual(MAX_BANDS);
}

describe("quantification", () => {
  it("ramène à la couche, sans traîne de virgule flottante", () => {
    expect(quantizeMm(42.07)).toBe(42);
    expect(quantizeMm(42.13)).toBe(42.2);
    expect(quantizeMm(0.3)).toBe(0.4);
    expect(quantizeMm(108)).toBe(108);
    expect(quantizeMm(0.1 + 0.2)).toBe(0.4);
  });
});

describe("déplacer une frontière", () => {
  it("plage : 2 mm au-dessus de la précédente, 2 mm sous la suivante", () => {
    expect(boundaryRange(hero, 0)).toEqual([2, 106]);
    expect(boundaryRange(hero, 1)).toEqual([44, 148]);
    expect(() => boundaryRange(hero, 2)).toThrow(/intérieures/);
  });

  it("quantifie et borne aux voisines", () => {
    expect(moveBoundary(hero, 0, 50.07)[0].toMm).toBe(50);
    expect(moveBoundary(hero, 0, 0)[0].toMm).toBe(2);
    expect(moveBoundary(hero, 0, 500)[0].toMm).toBe(106);
    expect(moveBoundary(hero, 1, 10)[1].toMm).toBe(44);
    expect(moveBoundary(hero, 1, 149.9)[1].toMm).toBe(148);
  });

  it("ne touche ni aux autres bandes ni à la hauteur, et ne mute pas l'entrée", () => {
    const before = JSON.stringify(hero);
    const moved = moveBoundary(hero, 0, 60);
    expect(JSON.stringify(hero)).toBe(before);
    expect(moved[1]).toEqual(hero[1]);
    expect(moved[2]).toEqual(hero[2]);
    expectValid(moved);
  });
});

describe("ajouter et retirer", () => {
  it("ajouter : coupe la bande la plus épaisse en deux, filament voisin évité", () => {
    const two: Band[] = [
      { filament: "encre", toMm: 30 },
      { filament: "blanc-neve", toMm: 150 },
    ];
    const three = addBand(two);
    expect(three).toHaveLength(3);
    expect(three[0]).toEqual({ filament: "encre", toMm: 30 });
    expect(three[1].filament).toBe("blanc-neve");
    expect(three[1].toMm).toBe(90);
    expect(three[2].toMm).toBe(150);
    // La nouvelle bande n'a pas le filament de ses voisines.
    expect(three[2].filament).not.toBe(three[1].filament);
    expectValid(three);
    expect(addBand(two, "ambre")[2].filament).toBe("ambre");
  });

  it("jamais plus de 4 bandes, jamais de bande de moins de 2 mm", () => {
    let bands: Band[] = [{ filament: "blanc-neve", toMm: 150 }];
    for (let i = 0; i < 10; i++) bands = addBand(bands);
    expect(bands).toHaveLength(4);
    expectValid(bands);
    expect(canAddBand(bands)).toBe(false);
    const thin: Band[] = [
      { filament: "encre", toMm: 2 },
      { filament: "blanc-neve", toMm: 4 },
    ];
    expect(canAddBand(thin, MIN_BAND_MM)).toBe(false);
    expect(addBand(thin)).toEqual(thin);
  });

  it("retirer : la bande du dessous absorbe, la dernière finit toujours à h", () => {
    expect(removeBand(hero, 1)).toEqual([
      { filament: "bleu-leman", toMm: 108 },
      { filament: "blanc-neve", toMm: 150 },
    ]);
    expect(removeBand(hero, 2)).toEqual([
      { filament: "bleu-leman", toMm: 42 },
      { filament: "vert-lavaux", toMm: 150 },
    ]);
    expect(removeBand(hero, 0)).toEqual([
      { filament: "vert-lavaux", toMm: 108 },
      { filament: "blanc-neve", toMm: 150 },
    ]);
    expectValid(removeBand(hero, 0));
    expectValid(removeBand(hero, 1));
    expectValid(removeBand(hero, 2));
  });

  it("au moins une bande reste", () => {
    const one: Band[] = [{ filament: "encre", toMm: H }];
    expect(canRemoveBand(one)).toBe(false);
    expect(removeBand(one, 0)).toEqual(one);
    expect(removeBand(hero, 9)).toEqual(hero);
  });

  it("changer de filament ne touche pas aux hauteurs", () => {
    const next = setBandFilament(hero, 1, "ambre");
    expect(next.map((b) => b.toMm)).toEqual(hero.map((b) => b.toMm));
    expect(next[1].filament).toBe("ambre");
    expect(bandThicknesses(hero)).toEqual([42, 66, 42]);
  });
});

describe("séquences aléatoires de gestes", () => {
  it("500 gestes : les bandes restent valides, à la couche, et avec 2 mm au moins", () => {
    const rng = mulberry32(2026);
    let bands: Band[] = structuredClone(hero) as Band[];
    for (let i = 0; i < 500; i++) {
      const gesture = intBetween(rng, 0, 3);
      if (gesture === 0)
        bands = addBand(
          bands,
          rng() < 0.5 ? pick(rng, FILAMENT_IDS) : undefined,
        );
      else if (gesture === 1)
        bands = removeBand(bands, intBetween(rng, 0, bands.length - 1));
      else if (gesture === 2 && bands.length > 1) {
        bands = moveBoundary(
          bands,
          intBetween(rng, 0, bands.length - 2),
          rng() * 200 - 20,
        );
      } else
        bands = setBandFilament(
          bands,
          intBetween(rng, 0, bands.length - 1),
          pick(rng, FILAMENT_IDS),
        );
      expectValid(bands);
    }
    expect(bands.length).toBeGreaterThan(0);
  });

  it("la séquence touche toutes les formes (1 à 4 bandes) sans jamais invalider", () => {
    const rng = mulberry32(99);
    const seen = new Set<number>();
    let bands: Band[] = [{ filament: "blanc-neve", toMm: H }];
    for (let i = 0; i < 200; i++) {
      bands =
        rng() < 0.5
          ? addBand(bands)
          : removeBand(bands, intBetween(rng, 0, bands.length - 1));
      expectValid(bands);
      seen.add(bands.length);
    }
    expect([...seen].sort()).toEqual([1, 2, 3, 4]);
  });

  it("les bandes produites passent le schéma d'un vase complet", () => {
    const bands = addBand(removeBand(hero, 1));
    const config: LavauxConfig = { ...HERO_CONFIG, bands };
    expect(lavauxSchema.safeParse(config).success).toBe(true);
  });
});
