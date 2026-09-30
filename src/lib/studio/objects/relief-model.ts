// Sous-verre « Relief » (brief « Strates », §6.2 et §6.3.4) : un massif en
// strates sur un socle, le nom du visiteur au pied. Une carte d'altitude sur
// le disque (bord plat de 3 mm) : FBM simplex de 5 octaves (persistance 0,5,
// lacunarité 2) + terme de crête 0,35 × (1 − |bruit|)² + chute radiale
// 1 − (ρ / R)^2,2, normalisée ; le lac (`lk`) reste plat. Seuils
// t_k = lk + (1 − lk) × k / strates ; contours par `d3-contour` (polygones avec
// trous), convertis en mm et simplifiés à 0,15 mm ; chaque niveau k est extrudé
// de `socle + (k − 1) × Δ` à `socle + k × Δ`.
//
// Écart assumé au brief : la strate k est la région au-dessus du seuil t_{k−1}
// (k = 1 à `strates`), donc la première strate est la terre émergée (au-dessus
// du lac) et la dernière le sommet. Avec t_k pour k = 1 à `strates`, la strate
// du sommet serait au seuil 1, atteint en un seul point : vide.
//
// L'étiquette « POINTE LÉA · 2 566 M » est en relief de 0,6 mm sur une zone
// plate du massif (par défaut dans la teinte de la bande 2). Elle tient sur une
// ligne quand la capitale reste ≥ 3,6 mm dans la zone, sinon sur deux
// (« POINTE LÉA » puis « 2 566 M »), sinon `text-fit`.
//
// Altitude fictive = 1800 + (fnv1a(nom en minuscules, sans espaces superflus)
// mod 2600) m, affichée comme telle (« altitude fictive »).
//
// Modèle pur : identique en SSR et côté client. Le maillage est dans `relief.ts`.
import { contours } from "d3-contour";
import type { Polygon } from "../kernel/extrude";
import { ringArea } from "../kernel/extrude";
import { fnv1a32 } from "../kernel/hash";
import { createSimplex } from "../kernel/noise";
import { simplifyClosed, type Vec2 } from "../kernel/simplify";
import { checkLine, type TextIssue } from "../text/check";
import { cleanText, overLimit, sanitizeTexts } from "../text/fields";
import {
  polygonsArea,
  polygonsPerimeter,
  type ShapeLod,
} from "../text/geometry";
import {
  codePoints,
  fitCap,
  isSupportedChar,
  lineStartX,
  measureText,
  MIN_CAP_MM,
  type PlacedLine,
} from "../text/layout";
import { strataThickness, strataTops } from "../schemas";
import type { Band, ReliefConfig, StudioTexts } from "../types";

export type Locale = "fr" | "de" | "it" | "en";

/** Bord plat du sous-verre (mm) : aucune strate ne touche le pourtour. */
export const RELIEF_EDGE_MM = 3;
/** Tolérance de simplification des contours (mm). */
export const RELIEF_SIMPLIFY_MM = 0.15;
/** Hauteur de l'étiquette en relief (mm). */
export const LABEL_HEIGHT_MM = 0.6;
/** Capitale de l'étiquette : nominale et minimale (mm). */
export const LABEL_CAP_MM = 4.2;
const LABEL_ZONE_HEIGHT = 11;

/** Résolution de la carte d'altitude selon l'usage : le brief fixe 128² ; le glissé et les statistiques vont plus vite. */
export const RELIEF_GRID: Record<ShapeLod | "stats", number> = {
  drag: 64,
  display: 128,
  export: 128,
  stats: 64,
};

// ── Étiquette du sommet ──────────────────────────────────────────────────────

const PEAK_WORD: Record<Locale, string> = {
  fr: "Pointe",
  de: "Piz",
  it: "Pizzo",
  en: "Mount",
};
/** Séparateur de milliers de l'altitude : espace insécable en français, apostrophe suisse sinon (∈ jeu de glyphes). */
const GROUPING: Record<Locale, string> = {
  fr: " ",
  de: "’",
  it: "’",
  en: "’",
};

/** Nom normalisé du sommet : minuscules, sans espaces superflus (annexe B). */
function normalizedPeak(name: string): string {
  return cleanText(name).toLowerCase();
}

/** Altitude fictive du sommet (m) : 1800 + (fnv1a(nom normalisé) mod 2600). Déterministe, jamais mesurée. */
export function peakAltitude(name: string): number {
  return 1800 + (fnv1a32(normalizedPeak(name)) % 2600);
}

/** Capitale d'un texte, caractère par caractère : un caractère dont la capitale sort du jeu reste tel quel. */
function upperCase(text: string): string {
  let out = "";
  for (const ch of codePoints(text)) {
    const up = ch.toUpperCase();
    out += codePoints(up).length === 1 && isSupportedChar(up) ? up : ch;
  }
  return out;
}

function groupedAltitude(meters: number, locale: Locale): string {
  const whole = Math.round(meters);
  const thousands = Math.floor(whole / 1000);
  const rest = String(whole % 1000).padStart(3, "0");
  return thousands > 0 ? `${thousands}${GROUPING[locale]}${rest}` : rest;
}

export interface PeakLabelParts {
  /** « POINTE LÉA » (capitales). */
  peak: string;
  /** « 2 566 M ». */
  altitude: string;
}

/** Les deux moitiés de l'étiquette (deux lignes quand une seule ne tient pas). */
export function peakLabelParts(
  name: string,
  locale: Locale = "fr",
): PeakLabelParts {
  const clean = cleanText(name);
  return {
    peak: upperCase(`${PEAK_WORD[locale]} ${clean}`),
    altitude: upperCase(`${groupedAltitude(peakAltitude(clean), locale)} m`),
  };
}

/** Étiquette complète sur une ligne : « POINTE LÉA · 2 566 M » (capitales). */
export function peakLabel(name: string, locale: Locale = "fr"): string {
  const { peak, altitude } = peakLabelParts(name, locale);
  return `${peak} · ${altitude}`;
}

// ── Bandes et strates ────────────────────────────────────────────────────────

/** Bande d'une dalle de z0 à z1 (par son milieu) : la frontière appartient à la bande du dessous. */
export function bandOfSlab(
  bands: readonly Band[],
  z0: number,
  z1: number,
): number {
  const mid = (z0 + z1) / 2;
  for (let k = 0; k < bands.length - 1; k++) {
    if (mid <= bands[k].toMm + 1e-9) return k;
  }
  return Math.max(bands.length - 1, 0);
}

// ── Carte d'altitude ─────────────────────────────────────────────────────────

export interface ReliefGrid {
  n: number;
  /** Côté d'une cellule (mm). */
  cell: number;
  /** Valeurs normalisées dans [0, 1] (1 au sommet), ligne par ligne, la ligne 0 au nord (+Y). */
  values: Float32Array;
}

/** Fréquence de la première octave (cycles sur le rayon) : deux ou trois massifs. */
const BASE_FREQUENCY = 1.6;

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

/** Zone plate de l'étiquette : rectangle centré en x = 0, sous le centre (mm). */
export function labelZone(config: ReliefConfig): {
  cx: number;
  cy: number;
  width: number;
  height: number;
} {
  const R = config.size / 2;
  const cy = -0.64 * R;
  const bottom = Math.abs(cy) + LABEL_ZONE_HEIGHT / 2;
  // Corde du disque au bas de la zone, moins une marge de 2 mm de chaque côté.
  const chord =
    config.shape === "rond"
      ? 2 * Math.sqrt(Math.max(R * R - bottom * bottom, 0))
      : config.size;
  return {
    cx: 0,
    cy,
    width: Math.max(Math.min(66, chord - 4), 20),
    height: LABEL_ZONE_HEIGHT,
  };
}

const gridCache = new Map<string, ReliefGrid>();

/**
 * Carte d'altitude n × n du sous-verre. Ne dépend ni du lac ni des strates :
 * seuls la graine, la taille, la forme, l'étiquette et la résolution comptent
 * (mémoïsée : les statistiques, le maillage et les posters la partagent).
 */
export function reliefGrid(config: ReliefConfig, n: number): ReliefGrid {
  const key = `${config.seed}|${config.size}|${config.shape}|${config.label}|${n}`;
  const hit = gridCache.get(key);
  if (hit) {
    gridCache.delete(key);
    gridCache.set(key, hit);
    return hit;
  }
  const R = config.size / 2;
  const cell = config.size / n;
  const simplex = createSimplex(config.seed);
  const zone = config.label ? labelZone(config) : null;
  const values = new Float32Array(n * n);
  let max = 0;
  for (let j = 0; j < n; j++) {
    const y = (n / 2 - (j + 0.5)) * cell;
    for (let i = 0; i < n; i++) {
      const x = (i + 0.5 - n / 2) * cell;
      const rho = Math.hypot(x, y);
      const edge =
        config.shape === "rond"
          ? R - rho
          : R - Math.max(Math.abs(x), Math.abs(y));
      let h = 0;
      if (edge > RELIEF_EDGE_MM) {
        const u = (x / R) * BASE_FREQUENCY;
        const v = (y / R) * BASE_FREQUENCY;
        // FBM de 5 octaves (persistance 0,5, lacunarité 2) ; la première octave
        // sert aussi à la crête.
        const first = simplex.noise2(u, v);
        let sum = first;
        let amp = 0.5;
        let norm = 1;
        let freq = 2;
        for (let o = 1; o < 5; o++) {
          sum += amp * simplex.noise2(u * freq, v * freq);
          norm += amp;
          amp *= 0.5;
          freq *= 2;
        }
        const fbm01 = 0.5 + 0.5 * (sum / norm);
        const ridge = 0.35 * (1 - Math.abs(first)) ** 2;
        const fall = Math.max(0, 1 - Math.min(rho / R, 1.5) ** 2.2);
        h =
          (fbm01 + ridge) *
          fall *
          smoothstep(RELIEF_EDGE_MM, RELIEF_EDGE_MM + 4, edge);
        if (zone) {
          const dx = Math.max(Math.abs(x - zone.cx) - zone.width / 2, 0);
          const dy = Math.max(Math.abs(y - zone.cy) - zone.height / 2, 0);
          h *= smoothstep(0, 5, Math.hypot(dx, dy));
        }
      }
      values[j * n + i] = h;
      if (h > max) max = h;
    }
  }
  if (max > 0) for (let k = 0; k < values.length; k++) values[k] /= max;
  const grid = { n, cell, values };
  gridCache.set(key, grid);
  if (gridCache.size > 4) gridCache.delete(gridCache.keys().next().value!);
  return grid;
}

// ── Contours ─────────────────────────────────────────────────────────────────

/** Seuils des strates : t_k = lk + (1 − lk) × k / strates, k = 0 à strates − 1 (la strate k + 1 est au-dessus de t_k). */
export function strataThresholds(config: ReliefConfig): number[] {
  const lake = config.lake / 100;
  // Un seuil nul engloberait toute la grille, pourtour plat compris : on exige > 0.
  return Array.from({ length: config.levels }, (_, k) =>
    Math.max(lake + ((1 - lake) * k) / config.levels, 1e-3),
  );
}

/** Aire minimale d'un îlot ou d'un lac gardé (mm²) : en dessous, une cellule isolée. */
const MIN_RING_AREA = 0.4;

const levelCache = new Map<string, Polygon[][]>();

/**
 * Polygones de chaque strate (mm, Y vers le haut) : `levels[k]` est la strate
 * k + 1. Contours de `d3-contour` sur la carte n × n, simplifiés à 0,15 mm ; un
 * îlot ou un lac de moins de 0,4 mm² (une cellule) est abandonné.
 */
export function reliefLevels(config: ReliefConfig, n: number): Polygon[][] {
  const key = `${config.seed}|${config.size}|${config.shape}|${config.label}|${config.lake}|${config.levels}|${n}`;
  const hit = levelCache.get(key);
  if (hit) {
    levelCache.delete(key);
    levelCache.set(key, hit);
    return hit;
  }
  const grid = reliefGrid(config, n);
  const { cell } = grid;
  const toMm = (p: number[]): Vec2 => [
    (p[0] - n / 2) * cell,
    (n / 2 - p[1]) * cell,
  ];
  const tidy = (ring: number[][], minArea: number): Vec2[] | null => {
    const pts = ring.slice(0, -1).map(toMm); // d3 répète le premier point à la fin
    const simple = simplifyClosed(pts, RELIEF_SIMPLIFY_MM);
    if (simple.length < 3 || Math.abs(ringArea(simple)) < minArea) return null;
    return simple;
  };
  const bands = contours().size([n, n]).thresholds(strataThresholds(config))(
    grid.values as unknown as number[],
  );
  const levels: Polygon[][] = bands.map((band) => {
    const polygons: Polygon[] = [];
    for (const rings of band.coordinates) {
      const outer = tidy(rings[0], MIN_RING_AREA);
      if (!outer) continue;
      const holes: Vec2[][] = [];
      for (const hole of rings.slice(1)) {
        const h = tidy(hole, MIN_RING_AREA);
        if (h) holes.push(h);
      }
      polygons.push({ outer, holes });
    }
    return polygons;
  });
  levelCache.set(key, levels);
  if (levelCache.size > 3) levelCache.delete(levelCache.keys().next().value!);
  return levels;
}

// ── Modèle complet ───────────────────────────────────────────────────────────

export interface ReliefModel {
  config: ReliefConfig;
  /** Sommets de strates (mm), du socle (k = 0) au sommet (k = strates). */
  tops: number[];
  /** Épaisseur d'une strate (mm) et hauteur totale. */
  delta: number;
  heightMm: number;
  /** Étiquette du sommet : lignes placées (vide sans étiquette ni nom) et sa zone. */
  lines: PlacedLine[];
  issues: TextIssue[];
}

/**
 * Étiquette du sommet : une ligne si la capitale y reste ≥ 3,6 mm, sinon deux
 * (le nom puis l'altitude), sinon `text-fit` ; capitale jamais au-dessus de 4,2 mm.
 */
export function layoutLabel(
  config: ReliefConfig,
  texts: StudioTexts | undefined,
  locale: Locale = "fr",
): { lines: PlacedLine[]; issues: TextIssue[] } {
  const name = sanitizeTexts("relief", texts).peak ?? "";
  if (!config.label || !name) return { lines: [], issues: [] };
  const zone = labelZone(config);
  const issues: TextIssue[] = [];
  const charCheck = checkLine({
    field: "peak",
    text: name,
    capMm: LABEL_CAP_MM,
    minCapMm: MIN_CAP_MM,
    maxWidthMm: Infinity,
  });
  issues.push(...charCheck.issues.filter((i) => i.code === "text-char"));
  if (overLimit("peak", name)) issues.push({ code: "text-fit", field: "peak" });
  const { peak, altitude } = peakLabelParts(name, locale);
  const single = `${peak} · ${altitude}`;
  const one = fitCap(single, LABEL_CAP_MM, MIN_CAP_MM, zone.width);
  const place = (
    key: string,
    text: string,
    cap: number,
    baseline: number,
  ): PlacedLine => ({
    key,
    text,
    capMm: cap,
    x: lineStartX(text, cap, zone.cx, "center"),
    y: baseline,
  });
  if (one.fits) {
    return {
      lines: [place("label", single, one.capMm, zone.cy - one.capMm / 2)],
      issues,
    };
  }
  // Deux lignes : la plus longue fixe la capitale.
  const widest =
    measureText(peak).perCap >= measureText(altitude).perCap ? peak : altitude;
  const two = fitCap(widest, LABEL_CAP_MM, MIN_CAP_MM, zone.width);
  if (!two.fits) {
    issues.push({
      code: "text-fit",
      field: "peak",
      value: Math.round(two.capMm * measureText(widest).perCap * 10) / 10,
    });
  }
  const cap = two.capMm;
  const gap = 0.4 * cap;
  return {
    lines: [
      place("label", peak, cap, zone.cy + gap / 2),
      place("label2", altitude, cap, zone.cy - cap - gap / 2),
    ],
    issues,
  };
}

export function layoutRelief(
  config: ReliefConfig,
  texts: StudioTexts | undefined,
  locale: Locale = "fr",
): ReliefModel {
  const tops = strataTops(config.base, config.relief, config.levels);
  const { lines, issues } = layoutLabel(config, texts, locale);
  return {
    config,
    tops,
    delta: strataThickness(config.levels, config.relief),
    heightMm: tops[config.levels],
    lines,
    issues,
  };
}

// ── Analyse ──────────────────────────────────────────────────────────────────

export interface ReliefAnalysis {
  /** Volume de matière (mm³), total et par bande. */
  volumeMm3: number;
  bandVolumesMm3: number[];
  /** Surface extérieure (mm²) : sert à la coque pleine. */
  surfaceMm2: number;
  /** Aire (mm²) de chaque strate : `levelAreas[k]` est la strate k + 1. */
  levelAreas: number[];
  footprintMm2: number;
}

/** Forme du socle : disque ou carré (aire exacte, pourtour). */
export function reliefFootprint(config: ReliefConfig): {
  area: number;
  perimeter: number;
} {
  const R = config.size / 2;
  return config.shape === "rond"
    ? { area: Math.PI * R * R, perimeter: 2 * Math.PI * R }
    : { area: config.size * config.size, perimeter: 4 * config.size };
}

/** Part d'une dalle [z0, z1] qui tombe dans chaque bande (épaisseurs, mm). */
export function slabShares(
  bands: readonly Band[],
  z0: number,
  z1: number,
): number[] {
  const out = bands.map(() => 0);
  let from = 0;
  bands.forEach((band, k) => {
    const to = k === bands.length - 1 ? Infinity : band.toMm;
    out[k] = Math.max(0, Math.min(z1, to) - Math.max(z0, from));
    from = band.toMm;
  });
  return out;
}

/**
 * Analyse analytique : aires exactes des polygones de contour (carte de
 * statistiques 64²), épaisseurs des strates, étiquette comprise.
 */
export function analyzeRelief(
  model: ReliefModel,
  grid: number = RELIEF_GRID.stats,
): ReliefAnalysis {
  const { config, tops } = model;
  const bands = config.bands;
  const foot = reliefFootprint(config);
  const levels = reliefLevels(config, grid);
  const bandVolumes = bands.map(() => 0);
  const add = (area: number, z0: number, z1: number) => {
    const shares = slabShares(bands, z0, z1);
    shares.forEach((t, k) => (bandVolumes[k] += area * t));
  };
  add(foot.area, 0, tops[0]);
  let surface = 2 * foot.area + foot.perimeter * tops[0];
  const levelAreas: number[] = [];
  levels.forEach((polygons, k) => {
    const area = polygonsArea(polygons);
    levelAreas.push(area);
    add(area, tops[k], tops[k + 1]);
    surface += polygonsPerimeter(polygons) * (tops[k + 1] - tops[k]);
  });
  for (const line of model.lines) {
    const m = measureText(line.text);
    const area = m.areaPerCap2 * line.capMm * line.capMm;
    add(area, tops[0], tops[0] + LABEL_HEIGHT_MM);
    surface += m.perimeterPerCap * line.capMm * LABEL_HEIGHT_MM;
  }
  return {
    volumeMm3: bandVolumes.reduce((a, b) => a + b, 0),
    bandVolumesMm3: bandVolumes,
    surfaceMm2: surface,
    levelAreas,
    footprintMm2: foot.area,
  };
}
