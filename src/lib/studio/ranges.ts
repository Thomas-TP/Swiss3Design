// Plages, valeurs par défaut et bornage des configurations (brief « Strates »,
// §6.2, §6.6, §6.8), SANS zod. Ce module est la partie « pure » de l'ancien
// `schemas.ts` : les générateurs (Worker de géométrie), les statistiques et les
// garde-fous ne dépendent que de lui, si bien que zod (une vingtaine de Kio
// gzip) n'entre dans un paquet que là où une valeur inconnue est validée
// (`schemas.ts` : `parseConfig`). `schemas.ts` le ré-exporte en entier : les
// importeurs existants n'ont rien à changer.
//
// Les plages sont LA source des curseurs du Studio (min, max, pas, défaut), du
// bornage « belles valeurs » et des schémas de validation : une seule table,
// donc aucune dérive entre l'interface, le lien partagé et l'outil WebMCP
// (« clamped to valid ranges »). Le couplage des paramètres (gd ≤ 0,5 gs,
// wl ≥ 4 wa…) et l'imprimabilité sont des garde-fous (guards.ts), qui signalent
// au lieu de refuser. Aucun texte personnel n'a de champ ici : les textes ne
// sont pas des configurations.
import { FILAMENT_IDS } from "./filaments";
import type {
  Band,
  BorneConfig,
  CartoucheConfig,
  FilamentId,
  LavauxConfig,
  LavauxPattern,
  MontagneConfig,
  StudioConfig,
} from "./types";

export interface Range {
  min: number;
  max: number;
  step: number;
  default: number;
}

const r = (min: number, max: number, step: number, def: number): Range => ({
  min,
  max,
  step,
  default: def,
});

export const LAVAUX_PROFILES = [
  "cylindre",
  "galet",
  "amphore",
  "cone",
  "tulipe",
] as const;
export const LAVAUX_PATTERN_KINDS = [
  "lisse",
  "gradins",
  "vagues",
  "voronoi",
  "nervures",
] as const;
export const LAVAUX_WALLS = [1.2, 1.6, 2, 2.4] as const;

export const LAVAUX_RANGES = {
  h: r(80, 240, 1, 150),
  d: r(50, 140, 1, 96),
  belly: r(0, 1, 0.01, 0.5),
  neck: r(0.5, 1, 0.01, 0.72),
  lip: r(0, 0.3, 0.01, 0.08),
  gradins: { step: r(2, 12, 0.2, 5), depth: r(0.4, 3, 0.1, 1.4) },
  vagues: {
    wavelength: r(6, 40, 0.5, 14),
    amplitude: r(0.4, 3, 0.1, 1.2),
    lobes: r(0, 12, 1, 5),
  },
  voronoi: {
    cells: r(12, 120, 1, 48),
    relief: r(0.4, 2.5, 0.1, 1.2),
    seed: r(0, 9999, 1, 4812),
  },
  nervures: {
    count: r(8, 48, 1, 16),
    depth: r(0.4, 3, 0.1, 1.2),
    twistDeg: r(-180, 180, 5, 0),
  },
} as const;

export const CARTOUCHE_RANGES = {
  thickness: r(1.2, 2.4, 0.2, 1.6),
  corner: r(0, 6, 0.5, 3),
  depth: r(0.4, 1.2, 0.2, 0.6),
} as const;

export const MONTAGNE_SHAPES = ["rond", "carre", "hexagone"] as const;
export const MONTAGNE_FORMS = ["pic", "massif", "arete"] as const;
export const MONTAGNE_STYLES = ["lisse", "strates"] as const;
export const MONTAGNE_ALT_MODES = ["fictive", "saisie"] as const;

/**
 * Plages de la Montagne : base 60–120 mm, socle 4–8 mm, hauteur de la montagne
 * 30–120 mm (au-dessus du socle), raideur, graine, strates 8–40, altitude saisie
 * 0–8 848 m (le mont Everest : au-delà, aucune altitude n'est plausible).
 */
export const MONTAGNE_RANGES = {
  size: r(60, 120, 1, 90),
  plinth: r(4, 8, 0.2, 5),
  height: r(30, 120, 1, 75),
  steep: r(0, 1, 0.01, 0.55),
  seed: r(0, 9999, 1, 2204),
  levels: r(8, 40, 1, 24),
  altitude: r(0, 8848, 1, 4000),
} as const;

/** Rapport maximal hauteur de la montagne / taille de la base : au-delà, une aiguille fragile. */
export const MONTAGNE_MAX_ASPECT = 1.6;
/** Bord plat minimal tout autour de la montagne (mm). */
export const MONTAGNE_MARGIN_MM = 3;

/** Hauteur maximale de la montagne pour une base donnée (mm, entier) : 1,6 × la base, 120 mm au plus. */
export function montagneHeightMax(size: number): number {
  return Math.min(
    MONTAGNE_RANGES.height.max,
    Math.floor(MONTAGNE_MAX_ASPECT * size + 1e-9),
  );
}

export const BORNE_RANGES = {
  cap: r(5, 10, 0.5, 7),
  thickness: r(3, 5, 0.2, 4),
  ringD: r(4, 6, 0.5, 5),
} as const;

/** Épaisseur minimale d'une bande (mm) : 10 couches (§6.4). */
export const MIN_BAND_MM = 2;
export const MAX_BANDS = 4;

// ── Bornage ──────────────────────────────────────────────────────────────────

/** Borne dans la plage et ramène au pas (sans traîne de virgule flottante). */
export function clampRange(value: number, range: Range): number {
  if (!Number.isFinite(value)) return range.default;
  const clamped = Math.min(Math.max(value, range.min), range.max);
  const snapped =
    range.min + Math.round((clamped - range.min) / range.step) * range.step;
  const decimals = Math.max(0, Math.ceil(-Math.log10(range.step) - 1e-9));
  return Math.min(
    Math.max(Number(snapped.toFixed(decimals + 1)), range.min),
    range.max,
  );
}

/**
 * Ramène une hauteur à la couche (0,2 mm) la plus proche, sans traîne de
 * virgule flottante ; un demi-pas exact (0,3) monte (0,4) au lieu de dépendre
 * de l'arrondi binaire (0,3 / 0,2 = 1,4999999999999998).
 */
export function quantizeMm(mm: number): number {
  return Math.round(Math.round(mm / 0.2 + 1e-9) * 0.2 * 10) / 10;
}

const toLayer = quantizeMm;

// ── Objets à texte (WP-02) : couplages de la Cartouche et de la Montagne ────

/**
 * Profondeur maximale (mm) d'une Cartouche : 1,2 mm en relief ; en gravure le
 * fond garde au moins 0,4 mm (deux couches) sous les lettres, donc
 * `profondeur ≤ épaisseur − 0,4` (à 1,2 mm de plaque : 0,8 mm de gravure).
 */
export function cartoucheDepthMax(
  thickness: number,
  mode: "relief" | "gravure",
): number {
  const max = CARTOUCHE_RANGES.depth.max;
  if (mode !== "gravure") return max;
  const limit = Math.floor((thickness - 0.4) / 0.2 + 1e-9) * 0.2;
  return Math.min(
    max,
    Math.max(CARTOUCHE_RANGES.depth.min, Number(limit.toFixed(1))),
  );
}

/** Hauteur totale de la Montagne (mm, à la couche) : le socle plus la montagne. */
export function montagneTotal(plinth: number, height: number): number {
  return quantizeMm(plinth + height);
}

/**
 * Sommets de strates (mm) du style « En strates » : `socle + k × hauteur /
 * strates`, ramenés à la couche (0,2 mm), k = 0 (le dessus du socle) à `levels`
 * (le sommet : exactement la hauteur choisie). Chaque strate fait au moins une
 * couche ; deux voisines diffèrent d'une couche au plus.
 */
export function montagneStrataTops(
  plinth: number,
  height: number,
  levels: number,
): number[] {
  return Array.from({ length: levels + 1 }, (_, k) =>
    quantizeMm(plinth + (k * height) / levels),
  );
}

/**
 * Bandes valides d'une Montagne : 2 à 4, la première finit EXACTEMENT au dessus
 * du socle (le socle est sa propre couleur ; avec l'étiquette en relief de
 * 0,8 mm posée sur ce dessus, elle sort dans la teinte de la bande 2 : c'est
 * ce qui la fait ressortir sur le socle), la dernière au sommet, les autres
 * à la couche, 2 mm d'épaisseur au moins. Une liste trop courte est complétée
 * (socle encre, montagne blanc névé).
 */
export function normalizeMontagneBands(
  bands: readonly Band[],
  plinth: number,
  height: number,
): Band[] {
  const total = montagneTotal(plinth, height);
  const list = bands.slice(0, MAX_BANDS);
  while (list.length < 2) {
    list.push({
      filament: list.length === 0 ? "encre" : "blanc-neve",
      toMm: total,
    });
  }
  const out: Band[] = [];
  let prev = plinth;
  list.forEach((band, k) => {
    if (k === 0) {
      out.push({ filament: band.filament, toMm: plinth });
      return;
    }
    if (k === list.length - 1) {
      out.push({ filament: band.filament, toMm: total });
      return;
    }
    const remaining = list.length - 1 - k;
    const toMm = quantizeMm(
      Math.min(
        Math.max(band.toMm, prev + MIN_BAND_MM),
        total - remaining * MIN_BAND_MM,
      ),
    );
    out.push({ filament: band.filament, toMm });
    prev = toMm;
  });
  return out;
}

/**
 * Bandes d'une Montagne dont le socle ou la hauteur change : chaque frontière de
 * la montagne garde sa position RELATIVE (40 % de la hauteur reste 40 % quand
 * on grandit la montagne), puis `normalizeMontagneBands` rétablit les règles.
 */
export function rescaleMontagneBands(
  bands: readonly Band[],
  from: { plinth: number; height: number },
  to: { plinth: number; height: number },
): Band[] {
  const last = bands.length - 1;
  const scaled = bands.map((band, k) =>
    k === 0 || k === last
      ? { ...band }
      : {
          filament: band.filament,
          toMm: quantizeMm(
            to.plinth + ((band.toMm - from.plinth) / from.height) * to.height,
          ),
        },
  );
  return normalizeMontagneBands(scaled, to.plinth, to.height);
}

/**
 * Bandes valides pour une hauteur : frontières à la couche, épaisseur ≥ 2 mm,
 * 1 à 4 bandes, la dernière finit à `h`. Une bande de trop (hauteur trop
 * faible) est retirée depuis le haut.
 */
export function normalizeBands(
  bands: readonly Band[],
  h: number,
  fallback: FilamentId = "blanc-neve",
  minThickness: number = MIN_BAND_MM,
): Band[] {
  let list = bands.slice(0, MAX_BANDS);
  if (list.length === 0) list = [{ filament: fallback, toMm: h }];
  while (list.length > 1 && h < list.length * minThickness)
    list = list.slice(0, -1);
  const out: Band[] = [];
  let prev = 0;
  list.forEach((band, k) => {
    const remaining = list.length - 1 - k;
    const last = k === list.length - 1;
    const hi = h - remaining * minThickness;
    const toMm = last
      ? h
      : toLayer(Math.min(Math.max(band.toMm, prev + minThickness), hi));
    out.push({ filament: band.filament, toMm });
    prev = toMm;
  });
  return out;
}

/** Recouvrement radial minimal (mm) de deux étages de gradins : voir `gradinsDepthMax`. */
export const GRADINS_MIN_OVERLAP_MM = 0.2;

/**
 * Profondeur maximale d'un gradin (mm), au dixième. Deux couplages :
 *  - gd ≤ 0,5 × pas (brief §6.6) : corniche imprimable ;
 *  - gd ≤ paroi − 0,2 mm (écart assumé au brief) : la paroi intérieure suit la
 *    paroi extérieure (r_i = r_o − w / cos α), donc au retrait net de chaque
 *    palier l'étage du dessus ne recouvre celui du dessous que de `w − gd`. À
 *    `gd = w` les deux tubes se touchent en un cercle (arête à quatre
 *    triangles, pièce non variété) ; au-delà, ils se séparent (anneau
 *    flottant, faces superposées). Le héros (1,4 pour 1,6) garde 0,2 mm.
 */
export function gradinsDepthMax(step: number, wall: number): number {
  const limit = Math.min(0.5 * step, wall - GRADINS_MIN_OVERLAP_MM);
  return Math.max(
    Math.floor(limit / 0.1 + 1e-9) * 0.1,
    LAVAUX_RANGES.gradins.depth.min,
  );
}

/** Longueur d'onde minimale des vagues (mm), au demi-millimètre : wl ≥ 4 × amplitude (brief §6.6). */
export function vaguesWavelengthMin(amplitude: number): number {
  return Math.ceil((4 * amplitude) / 0.5 - 1e-9) * 0.5;
}

function clampPattern(p: LavauxPattern, wall: number): LavauxPattern {
  const R = LAVAUX_RANGES;
  switch (p.kind) {
    case "lisse":
      return { kind: "lisse" };
    case "gradins": {
      const step = clampRange(p.step, R.gradins.step);
      const depth = Math.min(
        clampRange(p.depth, R.gradins.depth),
        gradinsDepthMax(step, wall),
      );
      return { kind: "gradins", step, depth: Number(depth.toFixed(1)) };
    }
    case "vagues": {
      const amplitude = clampRange(p.amplitude, R.vagues.amplitude);
      // Couplage : longueur d'onde ≥ 4 × amplitude.
      const wavelength = Math.max(
        clampRange(p.wavelength, R.vagues.wavelength),
        vaguesWavelengthMin(amplitude),
      );
      return {
        kind: "vagues",
        wavelength,
        amplitude,
        lobes: clampRange(p.lobes, R.vagues.lobes),
      };
    }
    case "voronoi":
      return {
        kind: "voronoi",
        cells: clampRange(p.cells, R.voronoi.cells),
        relief: clampRange(p.relief, R.voronoi.relief),
        seed: clampRange(p.seed, R.voronoi.seed),
      };
    case "nervures":
      return {
        kind: "nervures",
        count: clampRange(p.count, R.nervures.count),
        depth: clampRange(p.depth, R.nervures.depth),
        twistDeg: clampRange(p.twistDeg, R.nervures.twistDeg),
      };
  }
}

export function clampLavaux(config: LavauxConfig): LavauxConfig {
  const R = LAVAUX_RANGES;
  const h = clampRange(config.h, R.h);
  const wall = (LAVAUX_WALLS as readonly number[]).includes(config.wall)
    ? config.wall
    : 1.6;
  return {
    object: "lavaux",
    h,
    d: clampRange(config.d, R.d),
    profile: (LAVAUX_PROFILES as readonly string[]).includes(config.profile)
      ? config.profile
      : "galet",
    belly: clampRange(config.belly, R.belly),
    neck: clampRange(config.neck, R.neck),
    lip: clampRange(config.lip, R.lip),
    pattern: clampPattern(config.pattern, wall),
    wall,
    bands: normalizeBands(config.bands, h),
  };
}

const oneOf = <T extends string>(v: T, list: readonly T[], fallback: T): T =>
  list.includes(v) ? v : fallback;

const filamentOr = (v: FilamentId, fallback: FilamentId): FilamentId =>
  FILAMENT_IDS.includes(v) ? v : fallback;

export function clampCartouche(config: CartoucheConfig): CartoucheConfig {
  const R = CARTOUCHE_RANGES;
  const thickness = clampRange(config.thickness, R.thickness);
  const mode = oneOf(config.mode, ["relief", "gravure"], "relief");
  return {
    object: "cartouche",
    thickness,
    corner: clampRange(config.corner, R.corner),
    mode,
    depth: Math.min(
      clampRange(config.depth, R.depth),
      cartoucheDepthMax(thickness, mode),
    ),
    layout: oneOf(
      config.layout,
      ["classique", "centree", "cartouche", "monogramme"],
      "classique",
    ),
    plate: filamentOr(config.plate, "blanc-neve"),
    ink: filamentOr(config.ink, "encre"),
  };
}

export function clampMontagne(config: MontagneConfig): MontagneConfig {
  const R = MONTAGNE_RANGES;
  const size = clampRange(config.size, R.size);
  const plinth = clampRange(config.plinth, R.plinth);
  // Couplage : la hauteur de la montagne reste sous 1,6 × la base (la garde
  // `too-tall` ne signale que ce que ce bornage ne rattrape pas).
  const height = Math.min(
    clampRange(config.height, R.height),
    montagneHeightMax(size),
  );
  return {
    object: "montagne",
    shape: oneOf(config.shape, MONTAGNE_SHAPES, "rond"),
    size,
    plinth,
    height,
    form: oneOf(config.form, MONTAGNE_FORMS, "pic"),
    steep: clampRange(config.steep, R.steep),
    seed: clampRange(config.seed, R.seed),
    style: oneOf(config.style, MONTAGNE_STYLES, "lisse"),
    levels: clampRange(config.levels, R.levels),
    bands: normalizeMontagneBands(config.bands, plinth, height),
    label: Boolean(config.label),
    altMode: oneOf(config.altMode, MONTAGNE_ALT_MODES, "fictive"),
    altitude: clampRange(config.altitude, R.altitude),
  };
}

/**
 * Applique un changement de base, de socle ou de hauteur à une Montagne : les
 * frontières de couleur de la montagne suivent (positions relatives). Les
 * curseurs de la forme l'appellent ; le bornage seul garderait les frontières
 * à leur altitude absolue.
 */
export function withMontagneGeometry(
  config: MontagneConfig,
  patch: Partial<Pick<MontagneConfig, "size" | "plinth" | "height">>,
): MontagneConfig {
  const next = clampMontagne({ ...config, ...patch });
  return {
    ...next,
    bands: rescaleMontagneBands(
      config.bands,
      { plinth: config.plinth, height: config.height },
      { plinth: next.plinth, height: next.height },
    ),
  };
}

export function clampBorne(config: BorneConfig): BorneConfig {
  const R = BORNE_RANGES;
  return {
    object: "borne",
    shape: oneOf(
      config.shape,
      ["pilule", "etiquette", "goutte", "pic"],
      "pilule",
    ),
    cap: clampRange(config.cap, R.cap),
    thickness: clampRange(config.thickness, R.thickness),
    ring: oneOf(config.ring, ["gauche", "droite", "aucun"], "gauche"),
    ringD: clampRange(config.ringD, R.ringD),
    mode: oneOf(config.mode, ["relief", "gravure"], "relief"),
    base: filamentOr(config.base, "encre"),
    ink: filamentOr(config.ink, "blanc-neve"),
  };
}

/** Bornage d'une configuration quelconque (interface, WebMCP, liens partagés). */
export function clampConfig<T extends StudioConfig>(config: T): T {
  switch (config.object) {
    case "lavaux":
      return clampLavaux(config) as T;
    case "cartouche":
      return clampCartouche(config) as T;
    case "montagne":
      return clampMontagne(config) as T;
    case "borne":
      return clampBorne(config) as T;
  }
}
