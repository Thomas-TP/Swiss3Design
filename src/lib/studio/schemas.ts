// Plages, schémas zod et bornage des configurations (brief « Strates », §6.2,
// §6.8). Les plages sont LA source des curseurs du Studio (min, max, pas,
// défaut), du bornage « belles valeurs » et du schéma de validation : une
// seule table, donc aucune dérive entre l'interface, le lien partagé et
// l'outil WebMCP (« clamped to valid ranges »).
//
// Les schémas valident la FORME (types, plages, énumérations) : le couplage
// des paramètres (gd ≤ 0,5 gs, wl ≥ 4 wa…) et l'imprimabilité sont des
// garde-fous (guards.ts), qui signalent au lieu de refuser. Aucun texte
// personnel n'a de champ ici : les textes ne sont pas des configurations.
import { z } from "zod";
import { FILAMENT_IDS } from "./filaments";
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

export const RELIEF_RANGES = {
  size: r(90, 110, 1, 100),
  base: r(2.4, 4, 0.2, 3),
  relief: r(1.2, 4, 0.2, 3.2),
  levels: r(4, 12, 1, 8),
  seed: r(0, 9999, 1, 1291),
  lake: r(0, 40, 1, 18),
} as const;

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
  return {
    object: "cartouche",
    thickness: clampRange(config.thickness, R.thickness),
    corner: clampRange(config.corner, R.corner),
    mode: oneOf(config.mode, ["relief", "gravure"], "relief"),
    depth: clampRange(config.depth, R.depth),
    layout: oneOf(
      config.layout,
      ["classique", "centree", "cartouche", "monogramme"],
      "classique",
    ),
    plate: filamentOr(config.plate, "blanc-neve"),
    ink: filamentOr(config.ink, "encre"),
  };
}

export function clampRelief(config: ReliefConfig): ReliefConfig {
  const R = RELIEF_RANGES;
  const base = clampRange(config.base, R.base);
  const relief = clampRange(config.relief, R.relief);
  const total = base + relief;
  return {
    object: "relief",
    shape: oneOf(config.shape, ["rond", "carre"], "rond"),
    size: clampRange(config.size, R.size),
    base,
    relief,
    levels: clampRange(config.levels, R.levels),
    seed: clampRange(config.seed, R.seed),
    lake: clampRange(config.lake, R.lake),
    // Bandes : 2 à 4, calées sur les sommets de strates par WP-02 ; ici on
    // garantit seulement la forme (frontières à la couche, ordre, dernière = sommet).
    bands: normalizeBands(
      config.bands,
      toLayer(total),
      "bleu-leman",
      0.2,
    ).slice(0, MAX_BANDS),
    label: Boolean(config.label),
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
    case "relief":
      return clampRelief(config) as T;
    case "borne":
      return clampBorne(config) as T;
  }
}

// ── Schémas zod (noms longs) ─────────────────────────────────────────────────

const num = (range: Range) => z.number().min(range.min).max(range.max);
const int = (range: Range) => z.number().int().min(range.min).max(range.max);
const filament = z.enum(FILAMENT_IDS as [FilamentId, ...FilamentId[]]);

const bandSchema = z.strictObject({
  filament,
  toMm: z.number().positive().max(300),
});

/** Bandes contiguës depuis z = 0 : frontières croissantes ; la dernière finit à `total`. */
function bandsSchema(min: number, max: number) {
  return z.array(bandSchema).min(min).max(max);
}

const patternSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("lisse") }),
  z.strictObject({
    kind: z.literal("gradins"),
    step: num(LAVAUX_RANGES.gradins.step),
    depth: num(LAVAUX_RANGES.gradins.depth),
  }),
  z.strictObject({
    kind: z.literal("vagues"),
    wavelength: num(LAVAUX_RANGES.vagues.wavelength),
    amplitude: num(LAVAUX_RANGES.vagues.amplitude),
    lobes: int(LAVAUX_RANGES.vagues.lobes),
  }),
  z.strictObject({
    kind: z.literal("voronoi"),
    cells: int(LAVAUX_RANGES.voronoi.cells),
    relief: num(LAVAUX_RANGES.voronoi.relief),
    seed: int(LAVAUX_RANGES.voronoi.seed),
  }),
  z.strictObject({
    kind: z.literal("nervures"),
    count: int(LAVAUX_RANGES.nervures.count),
    depth: num(LAVAUX_RANGES.nervures.depth),
    twistDeg: num(LAVAUX_RANGES.nervures.twistDeg),
  }),
]);

function increasingTo(bands: readonly Band[], total: number, tolerance = 0.05) {
  let prev = 0;
  for (const b of bands) {
    if (!(b.toMm > prev)) return false;
    prev = b.toMm;
  }
  return Math.abs(prev - total) <= tolerance;
}

export const lavauxSchema = z
  .strictObject({
    object: z.literal("lavaux"),
    h: num(LAVAUX_RANGES.h),
    d: num(LAVAUX_RANGES.d),
    profile: z.enum(LAVAUX_PROFILES),
    belly: num(LAVAUX_RANGES.belly),
    neck: num(LAVAUX_RANGES.neck),
    lip: num(LAVAUX_RANGES.lip),
    pattern: patternSchema,
    wall: z.union([
      z.literal(1.2),
      z.literal(1.6),
      z.literal(2),
      z.literal(2.4),
    ]),
    bands: bandsSchema(1, MAX_BANDS),
  })
  .refine((c) => increasingTo(c.bands, c.h), {
    message:
      "les bandes doivent être croissantes et finir à la hauteur du vase",
    path: ["bands"],
  });

export const cartoucheSchema = z.strictObject({
  object: z.literal("cartouche"),
  thickness: num(CARTOUCHE_RANGES.thickness),
  corner: num(CARTOUCHE_RANGES.corner),
  mode: z.enum(["relief", "gravure"]),
  depth: num(CARTOUCHE_RANGES.depth),
  layout: z.enum(["classique", "centree", "cartouche", "monogramme"]),
  plate: filament,
  ink: filament,
});

export const reliefSchema = z
  .strictObject({
    object: z.literal("relief"),
    shape: z.enum(["rond", "carre"]),
    size: num(RELIEF_RANGES.size),
    base: num(RELIEF_RANGES.base),
    relief: num(RELIEF_RANGES.relief),
    levels: int(RELIEF_RANGES.levels),
    seed: int(RELIEF_RANGES.seed),
    lake: num(RELIEF_RANGES.lake),
    bands: bandsSchema(2, MAX_BANDS),
    label: z.boolean(),
  })
  .refine((c) => increasingTo(c.bands, c.base + c.relief, 1), {
    message: "les bandes doivent être croissantes",
    path: ["bands"],
  });

export const borneSchema = z.strictObject({
  object: z.literal("borne"),
  shape: z.enum(["pilule", "etiquette", "goutte", "pic"]),
  cap: num(BORNE_RANGES.cap),
  thickness: num(BORNE_RANGES.thickness),
  ring: z.enum(["gauche", "droite", "aucun"]),
  ringD: num(BORNE_RANGES.ringD),
  mode: z.enum(["relief", "gravure"]),
  base: filament,
  ink: filament,
});

export const SCHEMAS = {
  lavaux: lavauxSchema,
  cartouche: cartoucheSchema,
  relief: reliefSchema,
  borne: borneSchema,
} as const;

export type ParseResult =
  | { ok: true; config: StudioConfig }
  | { ok: false; error: string };

/** Valide une valeur inconnue pour l'objet donné (forme, plages, énumérations). */
export function parseConfig(
  object: StudioObjectId,
  value: unknown,
): ParseResult {
  const result = SCHEMAS[object].safeParse(value);
  if (!result.success) {
    const issue = result.error.issues[0];
    return {
      ok: false,
      error: `${issue.path.join(".") || "(racine)"} : ${issue.message}`,
    };
  }
  return { ok: true, config: result.data as StudioConfig };
}
