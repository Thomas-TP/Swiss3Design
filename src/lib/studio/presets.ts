// Configurations prédéfinies du Studio (brief « Strates », §5.2 : HERO_CONFIG,
// HERO_PATTERNS, HERO_PALETTES ; §6.2 : défauts des quatre objets ; §6.6 :
// « Surprenez-moi »). Les textes d'exemple (« Léa Dubois », …) ne vivent PAS
// ici : ils sont des StudioTexts, jamais dans une configuration ni dans l'URL.
//
// WP-02 complète ce fichier pour Cartouche, Montagne et Borne : préréglages de
// chaque objet (`CARTOUCHE_PRESETS`, `MONTAGNE_PRESETS`, `BORNE_PRESETS`) et
// `MONTAGNE_DEFAULT` (le pic de 75 mm sur un socle rond de 90 mm).
import { between, intBetween, mulberry32, pick, type Rng } from "./kernel/rng";
import { checkLavaux, checkPrintability, nearVaseSpirale } from "./guards";
import { analyzeMontagne, layoutMontagne } from "./objects/montagne-model";
import {
  clampBorne,
  clampCartouche,
  clampMontagne,
  gradinsDepthMax,
  montagneHeightMax,
  quantizeMm,
} from "./ranges";
import { DEFAULT_TEXTS } from "./text/fields";
import type {
  Band,
  BorneConfig,
  CartoucheConfig,
  FilamentId,
  LavauxConfig,
  LavauxPattern,
  MontagneConfig,
  StudioConfig,
  StudioObjectId,
} from "./types";

// ── Héros (§5.2) ─────────────────────────────────────────────────────────────

/** Le vase du héros : 750 couches, deux changements de filament (couches 211 et 541). */
export const HERO_CONFIG: LavauxConfig = {
  object: "lavaux",
  h: 150,
  d: 96, // mm (d = diamètre de l'enveloppe, motif compris)
  profile: "galet",
  belly: 0.5,
  neck: 0.72,
  lip: 0.08,
  pattern: { kind: "gradins", step: 5, depth: 1.4 },
  wall: 1.6,
  bands: [
    { filament: "bleu-leman", toMm: 42 }, // couches 1–210
    { filament: "vert-lavaux", toMm: 108 }, // couches 211–540
    { filament: "blanc-neve", toMm: 150 }, // couches 541–750
  ],
};

export const HERO_PATTERNS = {
  gradins: { kind: "gradins", step: 5, depth: 1.4 },
  vagues: { kind: "vagues", wavelength: 14, amplitude: 1.2, lobes: 5 },
  voronoi: { kind: "voronoi", cells: 48, relief: 1.2, seed: 4812 },
} as const; // jamais « nervures » dans le héros

export const HERO_PALETTES = {
  leman: ["bleu-leman", "vert-lavaux", "blanc-neve"],
  molasse: ["encre", "gris-molasse", "blanc-neve"],
  signal: ["encre", "blanc-neve", "rouge-signal"],
  uni: ["blanc-neve"], // 1 bande, 0 changement
} as const;

export type HeroPaletteKey = keyof typeof HERO_PALETTES;
export type HeroPatternKey = keyof typeof HERO_PATTERNS;
export const HERO_PALETTE_KEYS = Object.keys(HERO_PALETTES) as HeroPaletteKey[];
export const HERO_PATTERN_KEYS = Object.keys(HERO_PATTERNS) as HeroPatternKey[];

/** Frontières des trois bandes du héros en fraction de hauteur (42 / 108 / 150 mm sur 150). */
const BAND_FRACTIONS = [0.28, 0.72, 1] as const;

/** Arrondit à la couche (0,2 mm) sans traîne de virgule flottante. */
export function toLayer(mm: number): number {
  return quantizeMm(mm);
}

/**
 * Bandes d'une palette sur une hauteur donnée : une seule bande pour une
 * teinte, sinon les frontières du héros (28 % et 72 %) ramenées à la couche.
 */
export function bandsForPalette(
  filaments: readonly FilamentId[],
  h: number,
): Band[] {
  if (filaments.length <= 1)
    return [{ filament: filaments[0] ?? "blanc-neve", toMm: h }];
  const fractions =
    filaments.length === 2
      ? [0.6, 1]
      : filaments.length === 3
        ? BAND_FRACTIONS
        : [0.22, 0.5, 0.78, 1];
  return filaments.map((filament, k) => ({
    filament,
    toMm: k === filaments.length - 1 ? h : toLayer(h * fractions[k]),
  }));
}

/** Une des douze variantes du héros (palette × motif). */
export function heroVariant(
  palette: HeroPaletteKey,
  pattern: HeroPatternKey,
): LavauxConfig {
  return {
    ...HERO_CONFIG,
    pattern: { ...HERO_PATTERNS[pattern] },
    bands: bandsForPalette(HERO_PALETTES[palette], HERO_CONFIG.h),
  };
}

// ── Défauts des quatre objets (§6.2) ─────────────────────────────────────────

export const LAVAUX_DEFAULT: LavauxConfig = HERO_CONFIG;

export const CARTOUCHE_DEFAULT: CartoucheConfig = {
  object: "cartouche",
  thickness: 1.6,
  corner: 3,
  mode: "relief",
  depth: 0.6,
  layout: "classique",
  plate: "blanc-neve",
  ink: "encre",
};

/**
 * Bandes d'une Montagne à partir de ses filaments, du bas (le socle) vers le
 * haut : la première finit au dessus du socle, les autres se répartissent sur la
 * hauteur de la montagne (40 % et 75 % à quatre teintes : prairie, roche,
 * neige ; 55 % à trois), la dernière au sommet.
 */
export function montagneBands(
  filaments: readonly FilamentId[],
  plinth: number,
  height: number,
): Band[] {
  const total = quantizeMm(plinth + height);
  const fractions =
    filaments.length <= 2 ? [] : filaments.length === 3 ? [0.55] : [0.4, 0.75];
  return filaments.slice(0, 4).map((filament, k, list) => ({
    filament,
    toMm:
      k === 0
        ? plinth
        : k === list.length - 1
          ? total
          : quantizeMm(plinth + height * fractions[k - 1]),
  }));
}

/**
 * Montagne : un pic de 75 mm sur un socle rond de 90 mm (5 mm), lissé, avec son
 * étiquette à altitude fictive. Quatre couleurs par altitude : socle encre,
 * prairie vert Lavaux jusqu'à 40 % de la montagne, roche gris molasse jusqu'à
 * 75 %, neige blanc névé.
 */
export const MONTAGNE_DEFAULT: MontagneConfig = {
  object: "montagne",
  shape: "rond",
  size: 90,
  plinth: 5,
  height: 75,
  form: "pic",
  steep: 0.55,
  seed: 2204,
  style: "lisse",
  levels: 24,
  bands: montagneBands(
    ["encre", "vert-lavaux", "gris-molasse", "blanc-neve"],
    5,
    75,
  ),
  label: true,
  altMode: "fictive",
  altitude: 4000,
};

export const BORNE_DEFAULT: BorneConfig = {
  object: "borne",
  shape: "pilule",
  cap: 7,
  thickness: 4,
  ring: "gauche",
  ringD: 5,
  mode: "relief",
  base: "encre",
  ink: "blanc-neve",
};

export const DEFAULT_CONFIGS: { [K in StudioObjectId]: StudioConfig } = {
  lavaux: LAVAUX_DEFAULT,
  cartouche: CARTOUCHE_DEFAULT,
  montagne: MONTAGNE_DEFAULT,
  borne: BORNE_DEFAULT,
};

/** Copie profonde de la configuration par défaut d'un objet. */
export function defaultConfig<K extends StudioObjectId>(
  object: K,
): Extract<StudioConfig, { object: K }> {
  return structuredClone(DEFAULT_CONFIGS[object]) as Extract<
    StudioConfig,
    { object: K }
  >;
}

// ── Préréglages du vase (§9.3 : « tous les préréglages ») ────────────────────

export interface LavauxPreset {
  /** Clé de traduction : studioCore.presets.<id>. */
  id: string;
  config: LavauxConfig;
}

export const LAVAUX_PRESETS: readonly LavauxPreset[] = [
  { id: "lavaux", config: HERO_CONFIG },
  {
    id: "terrasses",
    config: {
      object: "lavaux",
      h: 180,
      d: 90,
      profile: "amphore",
      belly: 0.5,
      neck: 0.7,
      lip: 0.06,
      pattern: { kind: "gradins", step: 6, depth: 1.8 },
      wall: 2,
      bands: bandsForPalette(HERO_PALETTES.molasse, 180),
    },
  },
  {
    id: "houle",
    config: {
      object: "lavaux",
      h: 160,
      d: 100,
      profile: "tulipe",
      belly: 0.5,
      neck: 0.8,
      lip: 0,
      pattern: { kind: "vagues", wavelength: 18, amplitude: 1.5, lobes: 6 },
      wall: 1.6,
      bands: bandsForPalette(HERO_PALETTES.signal, 160),
    },
  },
  {
    id: "pave",
    config: {
      object: "lavaux",
      h: 140,
      d: 100,
      profile: "cone",
      belly: 0.5,
      neck: 0.85,
      lip: 0.05,
      pattern: { kind: "voronoi", cells: 60, relief: 1, seed: 2026 },
      wall: 1.6,
      bands: bandsForPalette(HERO_PALETTES.leman, 140),
    },
  },
  {
    id: "colonne",
    config: {
      object: "lavaux",
      h: 200,
      d: 80,
      profile: "cylindre",
      belly: 0.5,
      neck: 0.9,
      lip: 0.04,
      pattern: { kind: "nervures", count: 24, depth: 1.4, twistDeg: 0 },
      wall: 2,
      bands: bandsForPalette(HERO_PALETTES.uni, 200),
    },
  },
  {
    id: "galet",
    config: {
      object: "lavaux",
      h: 120,
      d: 110,
      profile: "galet",
      belly: 0.6,
      neck: 0.6,
      lip: 0,
      pattern: { kind: "lisse" },
      wall: 1.6,
      bands: bandsForPalette(HERO_PALETTES.signal, 120),
    },
  },
];

// ── Préréglages des objets plats (WP-02) ─────────────────────────────────────
//
// Un préréglage est une configuration complète, sans texte (les textes ne sont
// jamais dans une configuration) ; son nom est `studioCore.presets.<id>`. Les
// identifiants sont uniques sur les quatre objets (test). Les bandes de la
// Montagne respectent ses règles (la première finit au dessus du socle) :
// `clampMontagne` ne les modifie pas (test de point fixe).

export interface ObjectPreset<C extends StudioConfig> {
  /** Clé de traduction : studioCore.presets.<id>. */
  id: string;
  config: C;
}

export const CARTOUCHE_PRESETS: readonly ObjectPreset<CartoucheConfig>[] = [
  { id: "classique", config: CARTOUCHE_DEFAULT },
  {
    id: "centree",
    config: {
      object: "cartouche",
      thickness: 1.6,
      corner: 4,
      mode: "relief",
      depth: 0.6,
      layout: "centree",
      plate: "gris-molasse",
      ink: "blanc-neve",
    },
  },
  {
    id: "cadre",
    config: {
      object: "cartouche",
      thickness: 2,
      corner: 2,
      mode: "relief",
      depth: 0.8,
      layout: "cartouche",
      plate: "bleu-leman",
      ink: "blanc-neve",
    },
  },
  {
    id: "monogramme",
    config: {
      object: "cartouche",
      thickness: 1.6,
      corner: 3,
      mode: "relief",
      depth: 0.6,
      layout: "monogramme",
      plate: "encre",
      ink: "blanc-neve",
    },
  },
  {
    id: "incrustee",
    config: {
      object: "cartouche",
      thickness: 2,
      corner: 3,
      mode: "gravure",
      depth: 0.8,
      layout: "classique",
      plate: "blanc-neve",
      ink: "rouge-signal",
    },
  },
];

/**
 * Préréglages de la Montagne : les trois formes (un pic, un massif, une arête) et
 * une maquette en strates, chacune avec ses teintes et sa base. Les identifiants
 * sont ceux de `studioCore.presets` : « cime » (la forme « Pic »), « massif »,
 * « arete », « maquette ».
 */
export const MONTAGNE_PRESETS: readonly ObjectPreset<MontagneConfig>[] = [
  { id: "cime", config: MONTAGNE_DEFAULT },
  {
    id: "massif",
    config: {
      ...MONTAGNE_DEFAULT,
      size: 100,
      height: 66,
      form: "massif",
      steep: 0.5,
      seed: 3187,
      bands: montagneBands(
        ["encre", "vert-lavaux", "gris-molasse", "blanc-neve"],
        5,
        66,
      ),
    },
  },
  {
    id: "arete",
    config: {
      ...MONTAGNE_DEFAULT,
      shape: "carre",
      size: 110,
      height: 56,
      form: "arete",
      steep: 0.6,
      seed: 905,
      bands: montagneBands(["encre", "gris-molasse", "blanc-neve"], 5, 56),
    },
  },
  {
    id: "maquette",
    config: {
      ...MONTAGNE_DEFAULT,
      shape: "hexagone",
      size: 100,
      plinth: 6,
      height: 60,
      form: "massif",
      steep: 0.45,
      seed: 1771,
      style: "strates",
      levels: 20,
      bands: montagneBands(["gris-molasse", "glacier", "blanc-neve"], 6, 60),
    },
  },
];

export const BORNE_PRESETS: readonly ObjectPreset<BorneConfig>[] = [
  { id: "pilule", config: BORNE_DEFAULT },
  {
    id: "etiquette",
    config: {
      object: "borne",
      shape: "etiquette",
      cap: 7,
      thickness: 4,
      ring: "droite",
      ringD: 5,
      mode: "relief",
      base: "bleu-leman",
      ink: "blanc-neve",
    },
  },
  {
    id: "goutte",
    config: {
      object: "borne",
      shape: "goutte",
      cap: 8,
      thickness: 4,
      ring: "gauche",
      ringD: 5,
      mode: "relief",
      base: "rouge-signal",
      ink: "blanc-neve",
    },
  },
  {
    id: "pic",
    config: {
      object: "borne",
      shape: "pic",
      cap: 6,
      thickness: 4.4,
      ring: "gauche",
      ringD: 4.5,
      mode: "relief",
      base: "gris-molasse",
      ink: "encre",
    },
  },
  {
    id: "grave",
    config: {
      object: "borne",
      shape: "pilule",
      cap: 8,
      thickness: 4,
      ring: "aucun",
      ringD: 5,
      mode: "gravure",
      base: "blanc-neve",
      ink: "encre",
    },
  },
];

/** Préréglages de chaque objet, dans l'ordre d'affichage. */
export const PRESETS: {
  [K in StudioObjectId]: readonly ObjectPreset<
    Extract<StudioConfig, { object: K }>
  >[];
} = {
  lavaux: LAVAUX_PRESETS.map((p) => ({ id: p.id, config: p.config })),
  cartouche: CARTOUCHE_PRESETS,
  montagne: MONTAGNE_PRESETS,
  borne: BORNE_PRESETS,
};

// ── « Surprenez-moi » (§6.7) ─────────────────────────────────────────────────

const SURPRISE_PROFILES: LavauxConfig["profile"][] = [
  "cylindre",
  "galet",
  "amphore",
  "cone",
  "tulipe",
];

// Teintes voisines contrastées : on ne pose jamais deux bandes contiguës de
// luminosité trop proche, sinon le changement ne se verrait pas. Luma (Rec. 709,
// valeurs sRGB codées) des hex Polymaker Panchroma Matte de `filaments.ts`.
const LUMA: Record<FilamentId, number> = {
  "blanc-neve": 0.94,
  encre: 0.18,
  "rouge-signal": 0.34,
  "bleu-leman": 0.33,
  "vert-lavaux": 0.37,
  "gris-molasse": 0.55,
  ambre: 0.6,
  glacier: 0.78,
};
const SURPRISE_FILAMENTS = Object.keys(LUMA) as FilamentId[];

function surprisePattern(rng: Rng, wall: number): LavauxPattern {
  const kinds = ["gradins", "vagues", "voronoi", "nervures", "lisse"] as const;
  const kind = pick(rng, [...kinds, "gradins", "vagues", "voronoi"] as const);
  switch (kind) {
    case "gradins": {
      const step = Math.round(between(rng, 3, 9) * 5) / 5;
      const depth =
        Math.round(
          between(rng, 0.6, Math.min(2, gradinsDepthMax(step, wall))) * 10,
        ) / 10;
      return { kind, step, depth };
    }
    case "vagues": {
      const amplitude = Math.round(between(rng, 0.8, 2.2) * 10) / 10;
      const wavelength = Math.max(
        Math.round(between(rng, 10, 30) * 2) / 2,
        4 * amplitude,
      );
      return { kind, wavelength, amplitude, lobes: intBetween(rng, 0, 8) };
    }
    case "voronoi":
      return {
        kind,
        cells: intBetween(rng, 24, 80),
        relief: Math.round(between(rng, 0.8, 1.8) * 10) / 10,
        seed: intBetween(rng, 0, 9999),
      };
    case "nervures":
      return {
        kind,
        count: intBetween(rng, 12, 30),
        depth: Math.round(between(rng, 0.8, 2) * 10) / 10,
        twistDeg: intBetween(rng, -18, 18) * 5,
      };
    default:
      return { kind: "lisse" };
  }
}

function surpriseBands(rng: Rng, h: number): Band[] {
  const count = pick(rng, [1, 2, 2, 3, 3, 3, 4] as const);
  const chosen: FilamentId[] = [];
  for (let k = 0; k < count; k++) {
    for (let attempt = 0; attempt < 12; attempt++) {
      const candidate = pick(rng, SURPRISE_FILAMENTS);
      const prev = chosen[k - 1];
      if (!prev || Math.abs(LUMA[candidate] - LUMA[prev]) >= 0.22) {
        chosen.push(candidate);
        break;
      }
    }
    if (chosen.length <= k) chosen.push(k % 2 === 0 ? "blanc-neve" : "encre");
  }
  // Frontières : épaisseurs tirées, au moins 12 % de la hauteur chacune (≥ 2 mm
  // pour h ≥ 80 mm), ramenées à la couche.
  const cuts: number[] = [];
  let from = 0;
  for (let k = 0; k < count - 1; k++) {
    const remaining = count - 1 - k;
    const lo = from + Math.max(0.12 * h, 2);
    const hi = h - remaining * Math.max(0.12 * h, 2);
    const cut = toLayer(between(rng, lo, Math.max(hi, lo)));
    cuts.push(cut);
    from = cut;
  }
  return chosen.map((filament, k) => ({
    filament,
    toMm: k === count - 1 ? h : cuts[k],
  }));
}

/**
 * Tirage « Surprenez-moi » : bornes « belles », teintes voisines contrastées,
 * garde-fous vérifiés (10 essais au plus). Jamais de silhouette proche du Vase
 * spirale ; si aucun essai n'est imprimable, un préréglage sûr.
 */
export function surpriseLavaux(seed: number): LavauxConfig {
  const rng = mulberry32(seed);
  for (let attempt = 0; attempt < 10; attempt++) {
    const h = intBetween(rng, 100, 220);
    const wall = pick(rng, [1.6, 1.6, 2] as const);
    const config: LavauxConfig = {
      object: "lavaux",
      h,
      d: intBetween(rng, 70, 120),
      profile: pick(rng, SURPRISE_PROFILES),
      belly: Math.round(between(rng, 0.3, 0.8) * 100) / 100,
      neck: Math.round(between(rng, 0.5, 0.9) * 100) / 100,
      lip: Math.round(between(rng, 0, 0.15) * 100) / 100,
      pattern: surprisePattern(rng, wall),
      wall,
      bands: surpriseBands(rng, h),
    };
    if (nearVaseSpirale(config)) continue;
    if (checkLavaux(config).status === "ok") return config;
  }
  return structuredClone(pick(rng, LAVAUX_PRESETS).config);
}

// ── « Surprenez-moi » des objets plats (WP-02) ───────────────────────────────
//
// Même contrat que `surpriseLavaux` : bornes « belles », teintes contrastées,
// garde-fous vérifiés (10 essais), un préréglage sûr à défaut. Les textes
// d'exemple servent à la vérification (un texte saisi par le visiteur ne change
// jamais la configuration tirée).

/** Écart de luminosité minimal entre la plaque et l'encre (lisibilité du texte). */
const INK_CONTRAST = 0.45;

function contrastedPair(rng: Rng): [FilamentId, FilamentId] {
  for (let attempt = 0; attempt < 24; attempt++) {
    const a = pick(rng, SURPRISE_FILAMENTS);
    const b = pick(rng, SURPRISE_FILAMENTS);
    if (Math.abs(LUMA[a] - LUMA[b]) >= INK_CONTRAST) return [a, b];
  }
  return ["blanc-neve", "encre"];
}

/** Carte au hasard : mise en page, mode, épaisseur, coins, couleurs contrastées. */
export function surpriseCartouche(seed: number): CartoucheConfig {
  const rng = mulberry32(seed);
  for (let attempt = 0; attempt < 10; attempt++) {
    const [plate, ink] = contrastedPair(rng);
    const mode = pick(rng, ["relief", "relief", "gravure"] as const);
    const config = clampCartouche({
      object: "cartouche",
      thickness: pick(rng, [1.6, 1.8, 2, 2.2, 2.4] as const),
      corner: pick(rng, [2, 3, 3, 4, 5] as const),
      mode,
      depth: pick(rng, [0.6, 0.8] as const),
      layout: pick(rng, [
        "classique",
        "centree",
        "cartouche",
        "monogramme",
      ] as const),
      plate,
      ink,
    });
    if (checkPrintability(config, DEFAULT_TEXTS.cartouche).status === "ok") {
      return config;
    }
  }
  return structuredClone(pick(rng, CARTOUCHE_PRESETS).config);
}

/** Palettes de la Montagne : socle, puis prairie ou eau, roche, neige (2 à 4 teintes, du bas vers le haut). */
const MONTAGNE_PALETTES: readonly (readonly FilamentId[])[] = [
  ["encre", "vert-lavaux", "gris-molasse", "blanc-neve"],
  ["encre", "vert-lavaux", "blanc-neve"],
  ["gris-molasse", "glacier", "blanc-neve"],
  ["encre", "gris-molasse", "blanc-neve"],
  ["encre", "ambre", "gris-molasse", "blanc-neve"],
  ["bleu-leman", "vert-lavaux", "gris-molasse", "blanc-neve"],
  ["rouge-signal", "gris-molasse", "blanc-neve"],
];

/**
 * Montagne au hasard : socle, base, forme, raideur, hauteur (sous 1,6 × la base),
 * graine, style, palette ; garde-fous vérifiés avec le texte d'exemple (10
 * essais), un préréglage sûr à défaut.
 */
export function surpriseMontagne(seed: number): MontagneConfig {
  const rng = mulberry32(seed);
  for (let attempt = 0; attempt < 10; attempt++) {
    const palette = pick(rng, MONTAGNE_PALETTES);
    const size = intBetween(rng, 80, 118);
    const plinth = pick(rng, [4.4, 5, 5.6, 6.2] as const);
    const height = intBetween(rng, 45, Math.min(100, montagneHeightMax(size)));
    const config = clampMontagne({
      object: "montagne",
      shape: pick(rng, ["rond", "rond", "carre", "hexagone"] as const),
      size,
      plinth,
      height,
      form: pick(rng, ["pic", "massif", "arete"] as const),
      steep: Math.round(between(rng, 0.3, 0.8) * 100) / 100,
      seed: intBetween(rng, 0, 9999),
      style: pick(rng, ["lisse", "lisse", "lisse", "strates"] as const),
      levels: intBetween(rng, 12, 30),
      bands: montagneBands(palette, plinth, height),
      label: true,
      altMode: "fictive",
      altitude: MONTAGNE_DEFAULT.altitude,
    });
    // Une montagne dont le pied est minuscule n'est pas « belle ».
    const analysis = analyzeMontagne(
      layoutMontagne(config, DEFAULT_TEXTS.montagne),
    );
    if (
      analysis.footMm2 >= 900 &&
      checkPrintability(config, DEFAULT_TEXTS.montagne).status === "ok"
    ) {
      return config;
    }
  }
  return structuredClone(pick(rng, MONTAGNE_PRESETS).config);
}

/** Porte-nom au hasard : forme, taille, anneau, mode, couleurs contrastées. */
export function surpriseBorne(seed: number): BorneConfig {
  const rng = mulberry32(seed);
  for (let attempt = 0; attempt < 10; attempt++) {
    const [base, ink] = contrastedPair(rng);
    const config = clampBorne({
      object: "borne",
      shape: pick(rng, ["pilule", "etiquette", "goutte", "pic"] as const),
      cap: pick(rng, [6, 6.5, 7, 7.5, 8] as const),
      thickness: pick(rng, [3.6, 4, 4.4, 4.8] as const),
      ring: pick(rng, ["gauche", "gauche", "droite", "aucun"] as const),
      ringD: pick(rng, [4.5, 5, 5.5] as const),
      mode: pick(rng, ["relief", "relief", "gravure"] as const),
      base,
      ink,
    });
    if (checkPrintability(config, DEFAULT_TEXTS.borne).status === "ok") {
      return config;
    }
  }
  return structuredClone(pick(rng, BORNE_PRESETS).config);
}
