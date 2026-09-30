// Budgets de performance du Studio, mesurés dans Node (brief « Strates », §6.11
// et fiche WP-01) : `drag` ≤ 8 ms, `display` C2 ≤ 40 ms, `export` ≤ 400 ms, et
// computeStats ≤ 2 ms. On prend la MÉDIANE de plusieurs passes chaudes (le
// premier appel paie la compilation JIT) sur le héros et ses variantes les plus
// lourdes ; les valeurs mesurées sont affichées pour le compte rendu.
import { describe, expect, it } from "vitest";
import { buildLavaux, type LavauxLod } from "./objects/lavaux";
import {
  HERO_CONFIG,
  HERO_PALETTES,
  LAVAUX_PRESETS,
  bandsForPalette,
  heroVariant,
} from "./presets";
import { computeStats } from "./stats";
import type { LavauxConfig } from "./types";

function median(values: number[]): number {
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function measure(run: () => unknown, passes = 9): number {
  run(); // échauffement
  run();
  const times: number[] = [];
  for (let i = 0; i < passes; i++) {
    const t0 = performance.now();
    run();
    times.push(performance.now() - t0);
  }
  return median(times);
}

const HEAVY: [string, LavauxConfig][] = [
  ["héros", HERO_CONFIG],
  ["vagues", heroVariant("leman", "vagues")],
  ["voronoï", heroVariant("leman", "voronoi")],
  ...LAVAUX_PRESETS.filter((p) => p.id === "colonne" || p.id === "pave").map(
    (p) => [p.id, p.config] as [string, LavauxConfig],
  ),
];

const BUDGET_MS: Record<LavauxLod, number> = {
  drag: 8,
  display: 40,
  export: 400,
};

describe("budgets de génération (Node)", () => {
  for (const lod of ["drag", "display", "export"] as const) {
    it(`${lod} ≤ ${BUDGET_MS[lod]} ms (médiane, C2 pour display)`, () => {
      const report: string[] = [];
      for (const [name, config] of HEAVY) {
        const ms = measure(() => buildLavaux(config, { lod, tier: 2 }));
        report.push(`${name} ${ms.toFixed(1)} ms`);
        expect(ms, `${lod} ${name}`).toBeLessThanOrEqual(BUDGET_MS[lod]);
      }
      console.log(`[perf] ${lod} : ${report.join(" · ")}`);
    });
  }

  it("computeStats ≤ 2 ms (médiane)", () => {
    let k = 0;
    const ms = measure(() => {
      const h = 100 + (k++ % 90); // hauteur changeante : pas de résultat mémoïsé
      return computeStats({
        ...HERO_CONFIG,
        h,
        bands: bandsForPalette(HERO_PALETTES.leman, h),
      });
    });
    console.log(`[perf] computeStats : ${ms.toFixed(2)} ms`);
    expect(ms).toBeLessThanOrEqual(2);
  });
});
