// Aides de test partagées (jamais importées par le code de production, donc
// absentes du Worker et du client par tree-shaking) : tirages de configurations
// valides dans TOUTES les plages du §6.2, extrêmes compris, avec les couplages
// du §6.6 appliqués par `clampLavaux`. Utilisées par manifold.test.ts,
// stats.test.ts, guards.test.ts et url-state.test.ts ; WP-02 y ajoute les
// tirages de Cartouche, Relief et Borne, leurs textes, et le chargement des
// glyphes depuis `public/` (les tests tournent dans Node : pas de `fetch`).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { FILAMENT_IDS } from "./filaments";
import { between, intBetween, pick, type Rng } from "./kernel/rng";
import {
  BORNE_RANGES,
  CARTOUCHE_RANGES,
  clampBorne,
  clampCartouche,
  clampLavaux,
  clampRelief,
  LAVAUX_RANGES,
  LAVAUX_WALLS,
  RELIEF_RANGES,
} from "./schemas";
import { parseGlyphFont, setGlyphFont, type GlyphFont } from "./text/glyphs";
import type {
  Band,
  BorneConfig,
  CartoucheConfig,
  LavauxConfig,
  LavauxPattern,
  ReliefConfig,
  StudioObjectId,
  StudioTexts,
} from "./types";

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

// ── Objets plats (WP-02) ─────────────────────────────────────────────────────

/** Carte valide tirée dans toutes les plages (couplages appliqués). */
export function randomCartouche(rng: Rng): CartoucheConfig {
  const R = CARTOUCHE_RANGES;
  return clampCartouche({
    object: "cartouche",
    thickness: between(rng, R.thickness.min, R.thickness.max),
    corner: between(rng, R.corner.min, R.corner.max),
    mode: pick(rng, ["relief", "gravure"] as const),
    depth: between(rng, R.depth.min, R.depth.max),
    layout: pick(rng, [
      "classique",
      "centree",
      "cartouche",
      "monogramme",
    ] as const),
    plate: pick(rng, FILAMENT_IDS),
    ink: pick(rng, FILAMENT_IDS),
  });
}

/** Sous-verre valide tiré dans toutes les plages : graine, lac, strates, 2 à 4 bandes. */
export function randomRelief(rng: Rng): ReliefConfig {
  const R = RELIEF_RANGES;
  const bands: Band[] = [];
  const count = intBetween(rng, 2, 4);
  for (let k = 0; k < count; k++) {
    bands.push({
      filament: pick(rng, FILAMENT_IDS),
      toMm: between(rng, 1, 10),
    });
  }
  bands.sort((a, b) => a.toMm - b.toMm);
  return clampRelief({
    object: "relief",
    shape: pick(rng, ["rond", "carre"] as const),
    size: intBetween(rng, R.size.min, R.size.max),
    base: between(rng, R.base.min, R.base.max),
    relief: between(rng, R.relief.min, R.relief.max),
    levels: intBetween(rng, R.levels.min, R.levels.max),
    seed: intBetween(rng, R.seed.min, R.seed.max),
    lake: intBetween(rng, R.lake.min, R.lake.max),
    bands,
    label: rng() < 0.75,
  });
}

/** Porte-nom valide tiré dans toutes les plages. */
export function randomBorne(rng: Rng): BorneConfig {
  const R = BORNE_RANGES;
  return clampBorne({
    object: "borne",
    shape: pick(rng, ["pilule", "etiquette", "goutte", "pic"] as const),
    cap: between(rng, R.cap.min, R.cap.max),
    thickness: between(rng, R.thickness.min, R.thickness.max),
    ring: pick(rng, ["gauche", "droite", "aucun"] as const),
    ringD: between(rng, R.ringD.min, R.ringD.max),
    mode: pick(rng, ["relief", "gravure"] as const),
    base: pick(rng, FILAMENT_IDS),
    ink: pick(rng, FILAMENT_IDS),
  });
}

const WORDS = [
  "Léa",
  "Dubois",
  "Émilie",
  "Ödön",
  "Œuvre",
  "Łukasz",
  "Ça",
  "Zoé",
  "Jean-Luc",
  "Müller",
  "Strasse",
  "Weiß",
  "Bernasconi",
  "Ole",
  "Søren",
  "Ana",
  "Yves",
  "Xavier",
  "Olga",
  "Quentin",
  "Anaïs",
  "Noël",
  "Élodie",
  "Åsa",
  "Mia",
  "Jo",
  "Ugo",
  "Éric",
];

/** Un texte plausible de au plus `max` caractères (mots du jeu, accents, ß, Œ, Ł compris). */
export function randomText(rng: Rng, max: number): string {
  let out = pick(rng, WORDS);
  const words = intBetween(rng, 0, 3);
  for (let k = 0; k < words; k++) {
    const next = `${out} ${pick(rng, WORDS)}`;
    if (next.length > max) break;
    out = next;
  }
  return out.slice(0, max).trim();
}

/** Textes aléatoires d'un objet, dans les longueurs du §6.2. */
export function randomTexts(rng: Rng, object: StudioObjectId): StudioTexts {
  switch (object) {
    case "cartouche":
      return {
        name: randomText(rng, 16),
        role: rng() < 0.8 ? randomText(rng, 20) : undefined,
        line1: rng() < 0.8 ? randomText(rng, 24) : undefined,
        line2: rng() < 0.6 ? randomText(rng, 24) : undefined,
      };
    case "relief":
      return { peak: randomText(rng, 9) };
    case "borne":
      return { text: randomText(rng, 11) };
    default:
      return {};
  }
}

/** Police des glyphes lue dans `public/` (Node) et enregistrée pour le maillage. */
export function loadTestFont(): GlyphFont {
  const path = fileURLToPath(
    new URL(
      "../../../public/studio/glyphs/s3d-relief-v1.json",
      import.meta.url,
    ),
  );
  const font = parseGlyphFont(JSON.parse(readFileSync(path, "utf8")));
  setGlyphFont(font);
  return font;
}
