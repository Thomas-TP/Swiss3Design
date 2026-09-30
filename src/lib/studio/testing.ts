// Aides de test partagées (jamais importées par le code de production, donc
// absentes du Worker et du client par tree-shaking) : tirages de configurations
// valides dans TOUTES les plages du §6.2, extrêmes compris, avec les couplages
// du §6.6 appliqués par `clampLavaux`. Utilisées par manifold.test.ts,
// stats.test.ts, guards.test.ts et url-state.test.ts (WP-02 y ajoute les
// tirages de Cartouche, Relief et Borne).
import { FILAMENT_IDS } from "./filaments";
import { between, intBetween, pick, type Rng } from "./kernel/rng";
import { clampLavaux, LAVAUX_RANGES, LAVAUX_WALLS } from "./schemas";
import type { Band, LavauxConfig, LavauxPattern } from "./types";

const R = LAVAUX_RANGES;

export function randomPattern(rng: Rng): LavauxPattern {
  switch (intBetween(rng, 0, 4)) {
    case 0:
      return { kind: "lisse" };
    case 1:
      return {
        kind: "gradins",
        step: between(rng, R.gradins.step.min, R.gradins.step.max),
        depth: between(rng, R.gradins.depth.min, R.gradins.depth.max),
      };
    case 2:
      return {
        kind: "vagues",
        wavelength: between(
          rng,
          R.vagues.wavelength.min,
          R.vagues.wavelength.max,
        ),
        amplitude: between(rng, R.vagues.amplitude.min, R.vagues.amplitude.max),
        lobes: intBetween(rng, R.vagues.lobes.min, R.vagues.lobes.max),
      };
    case 3:
      return {
        kind: "voronoi",
        cells: intBetween(rng, R.voronoi.cells.min, R.voronoi.cells.max),
        relief: between(rng, R.voronoi.relief.min, R.voronoi.relief.max),
        seed: intBetween(rng, 0, 9999),
      };
    default:
      return {
        kind: "nervures",
        count: intBetween(rng, R.nervures.count.min, R.nervures.count.max),
        depth: between(rng, R.nervures.depth.min, R.nervures.depth.max),
        twistDeg: intBetween(rng, -36, 36) * 5,
      };
  }
}

/** Vase valide tiré dans toutes les plages (couplages appliqués). */
export function randomLavaux(rng: Rng): LavauxConfig {
  const h = intBetween(rng, R.h.min, R.h.max);
  const count = intBetween(rng, 1, 4);
  const bands: Band[] = [];
  for (let k = 0; k < count; k++) {
    bands.push({ filament: pick(rng, FILAMENT_IDS), toMm: between(rng, 0, h) });
  }
  bands.sort((a, b) => a.toMm - b.toMm);
  return clampLavaux({
    object: "lavaux",
    h,
    d: intBetween(rng, R.d.min, R.d.max),
    profile: pick(rng, [
      "cylindre",
      "galet",
      "amphore",
      "cone",
      "tulipe",
    ] as const),
    belly: rng(),
    neck: between(rng, R.neck.min, 1),
    lip: between(rng, 0, R.lip.max),
    pattern: randomPattern(rng),
    wall: pick(rng, LAVAUX_WALLS),
    bands,
  });
}
