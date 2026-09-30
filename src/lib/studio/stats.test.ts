// Statistiques, bandes et estimation (brief « Strates », §6.4, §6.5, annexe B).
import { describe, expect, it } from "vitest";
import { bandStats } from "./band-stats";
import { estimate } from "./estimate";
import { buildLavaux } from "./objects/lavaux";
import { meshVolume } from "./kernel/mesh";
import { mulberry32 } from "./kernel/rng";
import { createLavauxModel, innerRadius } from "./objects/lavaux-model";
import { PRICING, type PricingParams } from "./pricing-params";
import { HERO_CONFIG, heroVariant, LAVAUX_PRESETS } from "./presets";
import { boundaryLayer, computeStats, countChanges, layerCount } from "./stats";
import { randomLavaux } from "./testing";
import type { LavauxConfig } from "./types";

/** Intégration fine indépendante du plan d'anneaux : quadrature du point milieu sur une grille serrée. */
function fineVolumeMm3(config: LavauxConfig, nz = 3000, nt = 360): number {
  const model = createLavauxModel(config);
  const tmp = new Float64Array(3);
  const floor = 1.6;
  const dz = config.h / nz;
  const dt = (2 * Math.PI) / nt;
  let v = 0;
  for (let k = 0; k < nz; k++) {
    const z = (k + 0.5) * dz;
    let ring = 0;
    for (let i = 0; i < nt; i++) {
      model.outer((i + 0.5) * dt, z, 0, tmp);
      const r = tmp[0];
      if (z < floor) ring += r * r;
      else {
        const ri = innerRadius(config.wall, r, tmp[1], tmp[2]);
        ring += r * r - ri * ri;
      }
    }
    v += 0.5 * ring * dt * dz;
  }
  return v;
}

describe("computeStats : héros", () => {
  const stats = computeStats(HERO_CONFIG);

  it("chiffres exacts du brief : 750 couches, 2 changements, purge 1,6 g", () => {
    expect(stats.heightMm).toBe(150);
    expect(stats.widthMm).toBe(96);
    expect(stats.depthMm).toBe(96);
    expect(stats.layers).toBe(750);
    expect(stats.changes).toBe(2);
    expect(stats.purgeGrams).toBeCloseTo(1.6, 9);
    expect(stats.printable).toEqual({ status: "ok" });
  });

  it("volume à ±2 % d'une intégration fine (et d'un maillage d'affichage)", () => {
    const fine = fineVolumeMm3(HERO_CONFIG);
    expect(Math.abs(stats.volumeCm3 * 1000 - fine) / fine).toBeLessThan(0.02);
    const mesh = meshVolume(buildLavaux(HERO_CONFIG, { lod: "display" }));
    expect(Math.abs(stats.volumeCm3 * 1000 - mesh) / mesh).toBeLessThan(0.02);
  });

  it("masse et durée suivent les formules de l'annexe B", () => {
    const v = stats.volumeCm3 * 1000;
    const grams = (v / 1000) * 1.24 + 2 * 0.8;
    expect(Math.abs(stats.grams - grams)).toBeLessThan(0.2);
    const minutes = (v / 8 + 750 * 1.5 + 2 * 110) / 60 + 6;
    expect(Math.abs(stats.minutes - minutes)).toBeLessThan(1.5);
    // Ordre de grandeur du brief (≈ 80 g, ≈ 2 h 45) : même décade, pas la même valeur.
    expect(stats.grams).toBeGreaterThan(60);
    expect(stats.grams).toBeLessThan(110);
    expect(stats.minutes).toBeGreaterThan(120);
    expect(stats.minutes).toBeLessThan(240);
  });

  it("aucun prix tant que les coefficients ne sont pas validés", () => {
    expect(PRICING.validated).toBe(false);
    expect(stats.estimate).toBeNull();
  });
});

describe("computeStats : cohérence avec le maillage", () => {
  it("volume analytique à ±2 % du volume signé du maillage, sur 40 vases aléatoires", () => {
    const rng = mulberry32(4242);
    for (let i = 0; i < 40; i++) {
      const config = randomLavaux(rng);
      const analytic = computeStats(config).volumeCm3 * 1000;
      const mesh = meshVolume(buildLavaux(config, { lod: "export" }));
      expect(
        Math.abs(analytic - mesh) / mesh,
        `#${i} ${JSON.stringify(config.pattern)} h=${config.h} d=${config.d} ${config.profile}`,
      ).toBeLessThan(0.02);
    }
  });

  it("le volume des bandes somme au volume total", () => {
    for (const p of LAVAUX_PRESETS) {
      const total = computeStats(p.config).volumeCm3;
      const summary = bandStats(p.config);
      const sum = summary.bands.reduce((s, b) => s + b.volumeCm3, 0);
      expect(Math.abs(sum - total)).toBeLessThan(0.05);
    }
  });
});

describe("couches, changements et bandes", () => {
  it("couches = ceil(h / 0,2) sans traîne de virgule flottante", () => {
    expect(layerCount(150)).toBe(750);
    expect(layerCount(150.2)).toBe(751);
    expect(layerCount(80)).toBe(400);
    expect(layerCount(0.6)).toBe(3); // 0,6 / 0,2 = 2,9999999999999996
    expect(layerCount(123)).toBe(615);
  });

  it("une frontière z tombe à la couche round(z / 0,2) + 1", () => {
    expect(boundaryLayer(42)).toBe(211);
    expect(boundaryLayer(108)).toBe(541);
  });

  it("changements : seulement quand le filament change", () => {
    expect(countChanges(HERO_CONFIG.bands)).toBe(2);
    expect(
      countChanges([
        { filament: "encre", toMm: 50 },
        { filament: "encre", toMm: 100 },
        { filament: "blanc-neve", toMm: 150 },
      ]),
    ).toBe(1);
    expect(countChanges(heroVariant("uni", "gradins").bands)).toBe(0);
    expect(computeStats(heroVariant("uni", "gradins")).purgeGrams).toBe(0);
  });

  it("étiquettes de l'éclaté : couches 1–210, 211–540, 541–750", () => {
    const { bands, changes, purgeGrams, extraMinutes } = bandStats(HERO_CONFIG);
    expect(bands.map((b) => [b.fromLayer, b.toLayer])).toEqual([
      [1, 210],
      [211, 540],
      [541, 750],
    ]);
    expect(bands.map((b) => b.layers)).toEqual([210, 330, 210]);
    expect(bands.map((b) => [b.fromMm, b.toMm])).toEqual([
      [0, 42],
      [42, 108],
      [108, 150],
    ]);
    expect(bands.map((b) => b.startsWithChange)).toEqual([false, true, true]);
    expect(changes).toBe(2);
    expect(purgeGrams).toBeCloseTo(1.6, 9);
    expect(extraMinutes).toBe(4);
  });
});

describe("estimate", () => {
  const validated: PricingParams = { ...PRICING, validated: true };
  const base = { grams: 90, minutes: 180, changes: 2 };

  it("null tant que validated vaut false", () => {
    expect(estimate(base)).toBeNull();
    expect(computeStats(HERO_CONFIG, undefined, PRICING).estimate).toBeNull();
  });

  it("centimes entiers, arrondis à 50, fourchette ±15 %", () => {
    const e = estimate(base, validated)!;
    expect(Number.isInteger(e.lowCents)).toBe(true);
    expect(Number.isInteger(e.highCents)).toBe(true);
    expect(e.lowCents % 50).toBe(0);
    expect(e.highCents % 50).toBe(0);
    // 400 + 90 × 8 + 3 h × 300 + 2 × 60 = 2140 centimes.
    expect(e.lowCents).toBe(1800);
    expect(e.highCents).toBe(2450);
    expect(e.highCents).toBeGreaterThan(e.lowCents);
  });

  it("plancher respecté : une pièce minuscule ne descend jamais sous CHF 9", () => {
    const tiny = estimate({ grams: 2, minutes: 10, changes: 0 }, validated)!;
    expect(tiny.lowCents).toBeGreaterThanOrEqual(900);
    expect(tiny.highCents).toBeGreaterThanOrEqual(tiny.lowCents);
    expect(tiny.highCents).toBe(1050);
  });

  it("calibration : une fourchette plus serrée reste dans la première", () => {
    const wide = estimate(base, validated)!;
    const narrow = estimate(base, validated, 8)!;
    expect(narrow.lowCents).toBeGreaterThanOrEqual(wide.lowCents);
    expect(narrow.highCents).toBeLessThanOrEqual(wide.highCents);
  });

  it("calculé dans computeStats quand le barème est validé", () => {
    const s = computeStats(HERO_CONFIG, undefined, validated);
    expect(s.estimate).toBeTruthy();
    expect(s.estimate!.lowCents % 50).toBe(0);
    expect(s.estimate!.highCents).toBeGreaterThanOrEqual(s.estimate!.lowCents);
  });

  it("marge : multiplie le prix avant la fourchette, jamais sous le plancher", () => {
    const m = estimate(base, { ...validated, margin: 1.2 })!;
    const n = estimate(base, validated)!;
    expect(m.lowCents).toBeGreaterThan(n.lowCents);
  });
});
