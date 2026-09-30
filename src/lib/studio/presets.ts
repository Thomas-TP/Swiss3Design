// Configurations prédéfinies du Studio (brief « Strates », §5.2 : HERO_CONFIG,
// HERO_PATTERNS, HERO_PALETTES ; §6.2 : défauts des quatre objets ; §6.6 :
// « Surprenez-moi »). Les textes d'exemple (« Léa Dubois », …) ne vivent PAS
// ici : ils sont des StudioTexts, jamais dans une configuration ni dans l'URL.
//
// WP-02 complète ce fichier pour Cartouche, Relief et Borne (préréglages,
// `RELIEF_DEFAULT` définitif).
import { between, intBetween, mulberry32, pick, type Rng } from "./kernel/rng";
import { checkLavaux, nearVaseSpirale } from "./guards";
import type {
  Band,
  BorneConfig,
  CartoucheConfig,
  FilamentId,
  LavauxConfig,
  LavauxPattern,
  ReliefConfig,
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
  return Math.round(Math.round(mm / 0.2) * 0.2 * 10) / 10;
}

/**
 * Bandes d'une palette sur une hauteur donnée : une seule bande pour une
 * teinte, sinon les frontières du héros (28 % et 72 %) ramenées à la couche.
 */
export function bandsForPalette(
  filaments: readonly FilamentId[],
  h: number,
): Band[] {
  if (filaments.length <= 1) return [{ filament: filaments[0] ?? "blanc-neve", toMm: h }];
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
 * Sous-verre : épaisseur de strate Δ = max(0,4 ; round(relief / strates / 0,2) × 0,2) ;
 * chaque bande monte jusqu'à un sommet de strate, la première (lac) couvre le socle.
 * Valeurs par défaut (8 strates de 0,4 mm sur un socle de 3 mm).
 */
export const RELIEF_DEFAULT: ReliefConfig = {
  object: "relief",
  shape: "rond",
  size: 100,
  base: 3,
  relief: 3.2,
  levels: 8,
  seed: 1291,
  lake: 18,
  bands: [
    { filament: "bleu-leman", toMm: 3 },
    { filament: "vert-lavaux", toMm: 4.2 },
    { filament: "gris-molasse", toMm: 5.4 },
    { filament: "blanc-neve", toMm: 6.2 },
  ],
  label: true,
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
  relief: RELIEF_DEFAULT,
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
      wall: 1.6,
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

// ── « Surprenez-moi » (§6.7) ─────────────────────────────────────────────────

const SURPRISE_PROFILES: LavauxConfig["profile"][] = [
  "cylindre",
  "galet",
  "amphore",
  "cone",
  "tulipe",
];

// Teintes voisines contrastées : on ne pose jamais deux bandes contiguës de
// même famille (luminosité trop proche), sinon le changement ne se verrait pas.
const LUMA: Record<FilamentId, number> = {
  "blanc-neve": 0.96,
  encre: 0.1,
  "rouge-signal": 0.36,
  "bleu-leman": 0.4,
  "vert-lavaux": 0.47,
  "gris-molasse": 0.55,
  ambre: 0.68,
  glacier: 0.76,
};
const SURPRISE_FILAMENTS = Object.keys(LUMA) as FilamentId[];

function surprisePattern(rng: Rng, h: number): LavauxPattern {
  const kinds = ["gradins", "vagues", "voronoi", "nervures", "lisse"] as const;
  const kind = pick(rng, [...kinds, "gradins", "vagues", "voronoi"] as const);
  switch (kind) {
    case "gradins": {
      const step = Math.round(between(rng, 3, 9) * 5) / 5;
      const depth = Math.round(between(rng, 0.6, Math.min(2, 0.5 * step)) * 10) / 10;
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
      void h;
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
    const config: LavauxConfig = {
      object: "lavaux",
      h,
      d: intBetween(rng, 70, 120),
      profile: pick(rng, SURPRISE_PROFILES),
      belly: Math.round(between(rng, 0.3, 0.8) * 100) / 100,
      neck: Math.round(between(rng, 0.5, 0.9) * 100) / 100,
      lip: Math.round(between(rng, 0, 0.15) * 100) / 100,
      pattern: surprisePattern(rng, h),
      wall: pick(rng, [1.6, 1.6, 2] as const),
      bands: surpriseBands(rng, h),
    };
    if (nearVaseSpirale(config)) continue;
    if (checkLavaux(config).status === "ok") return config;
  }
  return structuredClone(pick(rng, LAVAUX_PRESETS).config);
}
