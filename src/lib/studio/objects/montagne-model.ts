// « Montagne » (brief « Strates », §6.2 et §6.3.4, refonte du 10.10.2026 : elle
// remplace le sous-verre « Relief ») : une petite montagne à poser sur un
// bureau, jusqu'à 12 cm, imprimée en plusieurs couleurs par altitude. Ce module
// est le MODÈLE : socle, emprise de la montagne, étiquette, grilles
// d'altitude, strates et analyse (volumes par bande) ; la carte d'altitude
// elle-même est dans `montagne-field.ts`, le maillage dans `montagne.ts`.
//
// Une pièce = un socle (rond, carré ou hexagone, 4 à 8 mm) et une montagne
// posée dessus, dont l'altitude `Z = socle + hauteur × carte(x, y)` ne
// surplombe jamais : aucun support. Elle vaut 0 sur au moins 3 mm tout autour,
// donc le bord du socle reste plat.
//
// Étiquette (en option) : nom et altitude en relief de 0,8 mm sur le DEVANT du
// socle. Pour lui laisser la place, l'emprise de la montagne est repoussée vers
// l'arrière de 19,5 mm (zone de texte de 11,5 mm, 5 mm de bord, 3 mm de pied) ;
// sans étiquette, elle est centrée. Le dessus du socle est la frontière de la
// première bande : l'étiquette, posée dessus, sort dans la teinte de la bande 2
// et se détache du socle sans qu'on ait rien à peindre.
//
// Altitude de l'étiquette : fictive (1800 + fnv1a(nom en minuscules, sans
// espaces superflus) mod 2600, affichée comme telle) ou saisie (0 à 8 848 m).
// Pas de mot de préfixe automatique (POINTE / PIZ…) : il coûterait 5 à 6
// caractères sur une zone de 16 caractères, doublerait le « Mont » d'un nom
// saisi (« Mont Blanc ») et change la mise en page d'une langue à l'autre ; le
// nom d'exemple de chaque langue le porte déjà (« Pointe Léa », « Piz Léa »…) et
// le visiteur écrit ce qu'il veut.
//
// Modèle pur : identique en SSR et côté client.
import { contours } from "d3-contour";
import type { Polygon } from "../kernel/extrude";
import { ringArea } from "../kernel/extrude";
import { fnv1a32 } from "../kernel/hash";
import { simplifyClosed, type Vec2 } from "../kernel/simplify";
import {
  MONTAGNE_MARGIN_MM,
  montagneStrataTops,
  montagneTotal,
} from "../ranges";
import { checkLine, type TextIssue } from "../text/check";
import { cleanText, overLimit, sanitizeTexts } from "../text/fields";
import {
  ARC_SEGMENTS,
  circleRing,
  polygonsPerimeter,
  ringsBox,
  roundedPolygonRing,
  roundedRectRing,
  type ShapeLod,
} from "../text/geometry";
import {
  codePoints,
  fitCap,
  isSupportedChar,
  lineStartX,
  measureText,
  MIN_CAP_MM,
  textWidthMm,
  type PlacedLine,
} from "../text/layout";
import type { Band, MontagneConfig, StudioTexts } from "../types";
import {
  createMountainField,
  type Footprint,
  type MountainField,
} from "./montagne-field";

export type Locale = "fr" | "de" | "it" | "en";

// ── Constantes de mise en page ───────────────────────────────────────────────

/** Hauteur de l'étiquette en relief (mm) : quatre couches. */
export const LABEL_HEIGHT_MM = 0.8;
/** Capitale de l'étiquette : nominale (la minimale est `MIN_CAP_MM`, 3,6 mm). */
export const LABEL_CAP_MM = 4.2;
/** Du bord avant du socle au bas de la zone de texte (mm). */
export const LABEL_EDGE_MM = 5;
/** Hauteur de la zone de texte, deux lignes comprises (mm). */
export const LABEL_ZONE_MM = 11.5;
/** De la zone de texte au pied de la montagne (mm). */
export const LABEL_FOOT_MM = 3;
/** Profondeur du tablier de l'étiquette, du bord avant au pied de la montagne (mm). */
export const APRON_MM = LABEL_EDGE_MM + LABEL_ZONE_MM + LABEL_FOOT_MM;
/** Marge latérale d'une ligne de l'étiquette par rapport au bord du socle (mm). */
const LABEL_MARGIN_MM = 2;
/** Rayon des coins du socle carré et de l'hexagone (mm). */
const CORNER_MM = 3;

/** Segments du socle rond selon le niveau de détail. */
const DISC_SEGMENTS: Record<ShapeLod, number> = {
  drag: 96,
  display: 160,
  export: 240,
};

// ── Altitude et texte de l'étiquette ─────────────────────────────────────────

/** Séparateur de milliers : espace insécable en français, apostrophe suisse sinon (∈ jeu de glyphes). */
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

/** Altitude affichée (m) : celle que le visiteur a saisie, ou la fictive du nom. */
export function labelAltitude(
  config: Pick<MontagneConfig, "altMode" | "altitude">,
  name: string,
): number {
  return config.altMode === "saisie"
    ? Math.min(Math.max(Math.round(config.altitude), 0), 8848)
    : peakAltitude(name);
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

/** « 2 566 » (milliers groupés selon la langue) ; sous 1 000, le nombre seul. */
export function groupedAltitude(meters: number, locale: Locale): string {
  const whole = Math.round(meters);
  const thousands = Math.floor(whole / 1000);
  const rest = whole % 1000;
  return thousands > 0
    ? `${thousands}${GROUPING[locale]}${String(rest).padStart(3, "0")}`
    : String(rest);
}

export interface PeakLabelParts {
  /** Le nom, en capitales : « POINTE LÉA ». */
  peak: string;
  /** L'altitude, en capitales : « 2 566 M ». */
  altitude: string;
}

/** Les deux moitiés de l'étiquette (deux lignes quand une seule ne tient pas). */
export function peakLabelParts(
  name: string,
  locale: Locale = "fr",
  meters: number = peakAltitude(cleanText(name)),
): PeakLabelParts {
  return {
    peak: upperCase(cleanText(name)),
    altitude: upperCase(`${groupedAltitude(meters, locale)} m`),
  };
}

/** Étiquette complète sur une ligne : « POINTE LÉA · 2 566 M » (capitales, altitude fictive). */
export function peakLabel(name: string, locale: Locale = "fr"): string {
  const { peak, altitude } = peakLabelParts(name, locale);
  return `${peak} · ${altitude}`;
}

// ── Bandes ───────────────────────────────────────────────────────────────────

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

// ── Socle ────────────────────────────────────────────────────────────────────

/** Hexagone régulier dont les côtés plats sont à l'avant et à l'arrière : sommets pointant à gauche et à droite. */
function hexagonPoints(size: number): Vec2[] {
  const circumradius = size / Math.sqrt(3);
  const pts: Vec2[] = [];
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 3;
    pts.push([circumradius * Math.cos(a), circumradius * Math.sin(a)]);
  }
  return pts;
}

/** Silhouette du socle, centrée sur l'origine, sens trigonométrique. */
export function plinthOutline(
  config: Pick<MontagneConfig, "shape" | "size">,
  lod: ShapeLod,
): Vec2[] {
  const R = config.size / 2;
  switch (config.shape) {
    case "rond":
      return circleRing(0, 0, R, DISC_SEGMENTS[lod]);
    case "carre":
      return roundedRectRing(-R, -R, R, R, CORNER_MM, ARC_SEGMENTS[lod]);
    case "hexagone":
      return roundedPolygonRing(
        hexagonPoints(config.size),
        CORNER_MM,
        ARC_SEGMENTS[lod],
      );
  }
}

/** Demi-largeur du socle (mm) à l'ordonnée `y` (repère de l'objet, Y vers l'arrière). */
export function halfWidthAt(
  config: Pick<MontagneConfig, "shape" | "size">,
  y: number,
): number {
  const a = config.size / 2;
  if (Math.abs(y) > a) return 0;
  switch (config.shape) {
    case "rond":
      return Math.sqrt(a * a - y * y);
    case "carre":
      return a;
    case "hexagone": {
      const flat = a / Math.sqrt(3);
      return flat + (a - Math.abs(y)) / Math.sqrt(3);
    }
  }
}

/** Dimensions hors tout du socle (mm), au dixième : largeur (X) et profondeur (Y). */
export function plinthDimensions(
  config: Pick<MontagneConfig, "shape" | "size">,
): {
  widthMm: number;
  depthMm: number;
} {
  const [x0, y0, x1, y1] = ringsBox([plinthOutline(config, "display")]);
  return {
    widthMm: Math.round((x1 - x0) * 10) / 10,
    depthMm: Math.round((y1 - y0) * 10) / 10,
  };
}

/** Aire du socle (mm²) : celle du contour du maillage d'export. */
export function plinthArea(
  config: Pick<MontagneConfig, "shape" | "size">,
): number {
  return Math.abs(ringArea(plinthOutline(config, "export")));
}

export function plinthPerimeter(
  config: Pick<MontagneConfig, "shape" | "size">,
): number {
  return polygonsPerimeter([{ outer: plinthOutline(config, "export") }]);
}

// ── Emprise de la montagne et carte d'altitude ───────────────────────────────

/**
 * Disque d'emprise de la montagne : le plus grand disque qui laisse 3 mm de bord
 * plat tout autour et, avec étiquette, le tablier de l'avant. Sans étiquette il
 * est centré ; avec, il touche le bord arrière (à 3 mm) et son front est à
 * 19,5 mm du bord avant du socle.
 */
export function mountainFootprint(
  config: Pick<MontagneConfig, "size" | "label">,
): Footprint {
  const usable = config.size / 2 - MONTAGNE_MARGIN_MM;
  if (!config.label) return { cx: 0, cy: 0, radius: usable };
  const front = -config.size / 2 + APRON_MM;
  return {
    cx: 0,
    cy: (front + usable) / 2,
    radius: (usable - front) / 2,
  };
}

/** Carte d'altitude normalisée de la configuration (mémoïsée par `createMountainField`). */
export function mountainField(
  config: Pick<MontagneConfig, "seed" | "form" | "steep" | "size" | "label">,
): MountainField {
  return createMountainField({
    seed: config.seed,
    form: config.form,
    steep: config.steep,
    footprint: mountainFootprint(config),
  });
}

/** Altitude absolue (mm depuis le plateau) en (x, y), style lissé. */
export function surfaceZ(
  config: MontagneConfig,
  field: MountainField,
  x: number,
  y: number,
): number {
  return config.plinth + config.height * field.at(x, y);
}

// ── Grilles d'altitude ───────────────────────────────────────────────────────

/** Grille de nœuds (m + 1)², ligne 0 au sud (−Y) ; `values` normalisées dans [0, 1]. */
export interface MountainGrid {
  /** Nombre de cellules par côté (m). */
  m: number;
  cell: number;
  x0: number;
  y0: number;
  values: Float32Array;
  footprint: Footprint;
}

/** Cellules en travers du disque d'emprise selon l'usage. */
export const GRID_ACROSS = {
  /** Statistiques (fil principal : ≈ 1 ms). */
  stats: 56,
  /** Plan et élévation 2D exacts, et poster. */
  poster: 144,
} as const;

const gridCache = new Map<string, MountainGrid>();

/**
 * Grille de nœuds sur le carré qui couvre l'emprise plus deux cellules de
 * marge ; la valeur est 0 hors du disque d'emprise (carte exactement nulle).
 * Mémoïsée : les statistiques, le plan et le maillage partagent la même grille
 * à résolution égale.
 */
export function mountainGrid(
  config: Pick<MontagneConfig, "seed" | "form" | "steep" | "size" | "label">,
  across: number,
): MountainGrid {
  const field = mountainField(config);
  const fp = field.footprint;
  const key = `${config.seed}|${config.form}|${config.steep}|${config.size}|${config.label}|${across}`;
  const hit = gridCache.get(key);
  if (hit) {
    gridCache.delete(key);
    gridCache.set(key, hit);
    return hit;
  }
  const cell = (2 * fp.radius) / across;
  const m = across + 4;
  const x0 = fp.cx - (m * cell) / 2;
  const y0 = fp.cy - (m * cell) / 2;
  const side = m + 1;
  const values = new Float32Array(side * side);
  const r2 = fp.radius * fp.radius;
  for (let j = 0; j < side; j++) {
    const y = y0 + j * cell;
    for (let i = 0; i < side; i++) {
      const x = x0 + i * cell;
      const dx = x - fp.cx;
      const dy = y - fp.cy;
      if (dx * dx + dy * dy < r2) values[j * side + i] = field.at(x, y);
    }
  }
  const grid: MountainGrid = { m, cell, x0, y0, values, footprint: fp };
  gridCache.set(key, grid);
  if (gridCache.size > 6) gridCache.delete(gridCache.keys().next().value!);
  return grid;
}

// ── Strates (style « En strates ») et courbes de niveau ──────────────────────

/**
 * Seuils normalisés des strates : la strate k (k = 1 à `levels`) est la région
 * où la carte dépasse `t_k = (sommet de la strate k − 1 − socle) / hauteur` ;
 * un seuil nul engloberait toute la grille, pourtour plat compris : on exige > 0.
 */
export function strataThresholds(
  config: Pick<MontagneConfig, "plinth" | "height" | "levels">,
): number[] {
  const tops = montagneStrataTops(config.plinth, config.height, config.levels);
  return Array.from({ length: config.levels }, (_, k) =>
    Math.max((tops[k] - config.plinth) / config.height, 1e-3),
  );
}

/** Aire minimale d'un îlot ou d'un lac gardé (mm²) : en dessous, une cellule isolée. */
const MIN_RING_AREA = 0.4;

/** Contours déjà calculés, par grille (la grille meurt, ses contours aussi). */
const levelCache = new WeakMap<MountainGrid, Map<string, Polygon[][]>>();

/**
 * Polygones de chaque seuil (mm, Y vers le haut) : `levels[k]` est la région
 * au-dessus de `thresholds[k]`. Contours de `d3-contour` sur la grille, simplifiés
 * à `tolerance` mm ; un îlot ou un lac de moins de 0,4 mm² est abandonné.
 */
export function contourLevels(
  grid: MountainGrid,
  thresholds: readonly number[],
  tolerance: number,
): Polygon[][] {
  let perGrid = levelCache.get(grid);
  if (!perGrid) {
    perGrid = new Map();
    levelCache.set(grid, perGrid);
  }
  const key = `${thresholds.join(",")}|${tolerance}`;
  const hit = perGrid.get(key);
  if (hit) return hit;
  const side = grid.m + 1;
  const toMm = (p: number[]): Vec2 => [
    grid.x0 + (p[0] - 0.5) * grid.cell,
    grid.y0 + (p[1] - 0.5) * grid.cell,
  ];
  const tidy = (ring: number[][]): Vec2[] | null => {
    const pts = ring.slice(0, -1).map(toMm); // d3 répète le premier point à la fin
    const simple = simplifyClosed(pts, tolerance);
    if (simple.length < 3 || Math.abs(ringArea(simple)) < MIN_RING_AREA)
      return null;
    return simple;
  };
  const bands = contours()
    .size([side, side])
    .thresholds([...thresholds])(grid.values as unknown as number[]);
  const levels: Polygon[][] = bands.map((band) => {
    const polygons: Polygon[] = [];
    for (const rings of band.coordinates) {
      const outer = tidy(rings[0]);
      if (!outer) continue;
      const holes: Vec2[][] = [];
      for (const hole of rings.slice(1)) {
        const h = tidy(hole);
        if (h) holes.push(h);
      }
      polygons.push({ outer, holes });
    }
    return polygons;
  });
  perGrid.set(key, levels);
  if (perGrid.size > 4) perGrid.delete(perGrid.keys().next().value!);
  return levels;
}

/** Hauteur (mm, au-dessus du socle) de la strate qui recouvre l'altitude normalisée `hn` : escalier du style « En strates ». */
export function stairHeight(
  hn: number,
  thresholds: readonly number[],
  tops: readonly number[],
  plinth: number,
): number {
  if (hn <= 0) return 0;
  let k = 0;
  while (k < thresholds.length && hn > thresholds[k]) k++;
  // k seuils franchis : le dessus de la strate k.
  return k === 0 ? 0 : tops[k] - plinth;
}

// ── Modèle complet ───────────────────────────────────────────────────────────

export interface MontagneModel {
  config: MontagneConfig;
  /** Hauteur totale de la pièce (mm) : le socle plus la montagne. */
  total: number;
  /** Sommets de strates (mm), du dessus du socle (k = 0) au sommet (k = strates). */
  tops: number[];
  footprint: Footprint;
  widthMm: number;
  depthMm: number;
  /** Lignes de l'étiquette (vide sans étiquette ni nom). */
  lines: PlacedLine[];
  issues: TextIssue[];
}

/** Largeur disponible (mm) d'une ligne dont la base est à l'ordonnée `y` : la corde du socle moins deux marges. */
function lineWidthAt(config: MontagneConfig, y: number): number {
  return Math.max(2 * (halfWidthAt(config, y) - LABEL_MARGIN_MM), 0);
}

/**
 * Étiquette : « NOM · 2 566 M » sur une ligne si la capitale y reste ≥ 3,6 mm,
 * sinon deux lignes (le nom, puis l'altitude) à la plus grande capitale commune
 * qui tienne dans la corde du socle à chacune de leurs hauteurs, sinon
 * `text-fit`. La zone est centrée devant la montagne, jamais plus haute que
 * 11,5 mm : la montagne ne change pas avec le texte.
 */
export function layoutLabel(
  config: MontagneConfig,
  texts: StudioTexts | undefined,
  locale: Locale = "fr",
): { lines: PlacedLine[]; issues: TextIssue[] } {
  const name = sanitizeTexts("montagne", texts).peak ?? "";
  if (!config.label || !name) return { lines: [], issues: [] };
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

  const { peak, altitude } = peakLabelParts(
    name,
    locale,
    labelAltitude(config, name),
  );
  const zoneBottom = -config.size / 2 + LABEL_EDGE_MM;
  const zoneCenter = zoneBottom + LABEL_ZONE_MM / 2;
  const place = (
    key: string,
    text: string,
    cap: number,
    baseline: number,
  ): PlacedLine => ({
    key,
    text,
    capMm: cap,
    x: lineStartX(text, cap, 0, "center"),
    y: baseline,
  });

  const single = `${peak} · ${altitude}`;
  // La capitale d'une ligne seule change sa hauteur : on cherche le point fixe.
  let cap = LABEL_CAP_MM;
  let one = fitCap(
    single,
    cap,
    MIN_CAP_MM,
    lineWidthAt(config, zoneCenter - cap / 2),
  );
  for (let pass = 0; pass < 4 && one.capMm !== cap; pass++) {
    cap = one.capMm;
    one = fitCap(
      single,
      cap,
      MIN_CAP_MM,
      lineWidthAt(config, zoneCenter - cap / 2),
    );
  }
  if (one.fits) {
    return {
      lines: [place("label", single, one.capMm, zoneCenter - one.capMm / 2)],
      issues,
    };
  }

  // Deux lignes : du nominal au minimum, par dixièmes de millimètre.
  const fits = (c: number) => {
    const gap = 0.4 * c;
    const block = 2 * c + gap;
    const lower = zoneCenter - block / 2;
    const upper = lower + c + gap;
    return (
      textWidthMm(peak, c) <= lineWidthAt(config, upper) + 1e-9 &&
      textWidthMm(altitude, c) <= lineWidthAt(config, lower) + 1e-9
    );
  };
  let chosen = MIN_CAP_MM;
  let ok = false;
  for (
    let c = LABEL_CAP_MM;
    c >= MIN_CAP_MM - 1e-9;
    c = Math.round((c - 0.1) * 10) / 10
  ) {
    if (fits(c)) {
      chosen = c;
      ok = true;
      break;
    }
  }
  if (!ok) {
    const needed = Math.max(
      textWidthMm(peak, MIN_CAP_MM),
      textWidthMm(altitude, MIN_CAP_MM),
    );
    issues.push({
      code: "text-fit",
      field: "peak",
      value: Math.round(needed * 10) / 10,
    });
  }
  const gap = 0.4 * chosen;
  const lower = zoneCenter - (2 * chosen + gap) / 2;
  return {
    lines: [
      place("label", peak, chosen, lower + chosen + gap),
      place("label2", altitude, chosen, lower),
    ],
    issues,
  };
}

export function layoutMontagne(
  config: MontagneConfig,
  texts: StudioTexts | undefined,
  locale: Locale = "fr",
): MontagneModel {
  const { lines, issues } = layoutLabel(config, texts, locale);
  const { widthMm, depthMm } = plinthDimensions(config);
  return {
    config,
    total: montagneTotal(config.plinth, config.height),
    tops: montagneStrataTops(config.plinth, config.height, config.levels),
    footprint: mountainFootprint(config),
    widthMm,
    depthMm,
    lines,
    issues,
  };
}

// ── Analyse ──────────────────────────────────────────────────────────────────

export interface MontagneAnalysis {
  /** Volume de matière (mm³), total et par bande. */
  volumeMm3: number;
  bandVolumesMm3: number[];
  /** Surface extérieure (mm²) : sert à la coque pleine. */
  surfaceMm2: number;
  /** Aire (mm²) de la montagne au pied (là où la carte est > 0). */
  footMm2: number;
  /** Aire du socle (mm²). */
  plinthMm2: number;
}

/**
 * Analyse par intégration de la grille de statistiques (56 cellules en travers,
 * ≈ 1 ms) : volume par bande en cumulant, cellule par cellule, la part de la
 * colonne qui tombe dans chaque bande ; surface = flancs lissés (pente locale)
 * ou, en strates, dessus plats et marches (périmètre de grille × 0,8, le biais
 * moyen entre une marche en escalier et un contour lisse). Socle et étiquette
 * sont exacts (aire du contour, métriques des glyphes).
 */
export function analyzeMontagne(model: MontagneModel): MontagneAnalysis {
  const { config } = model;
  const bands = config.bands;
  const plinthTop = config.plinth;
  const area = plinthArea(config);
  const bandVolumes = bands.map(() => 0);
  const add = (a: number, z0: number, z1: number) => {
    const shares = slabShares(bands, z0, z1);
    shares.forEach((t, k) => (bandVolumes[k] += a * t));
  };
  add(area, 0, plinthTop);
  let surface = 2 * area + plinthPerimeter(config) * plinthTop;

  const grid = mountainGrid(config, GRID_ACROSS.stats);
  const side = grid.m + 1;
  const cellArea = grid.cell * grid.cell;
  const v = grid.values;
  const thresholds = strataThresholds(config);
  const strata = config.style === "strates";
  let foot = 0;
  let steps = 0;
  const level = new Float32Array(side * side);
  if (strata) {
    for (let k = 0; k < level.length; k++) {
      level[k] = stairHeight(v[k], thresholds, model.tops, plinthTop);
    }
  }
  for (let j = 0; j < side - 1; j++) {
    for (let i = 0; i < side - 1; i++) {
      const a = j * side + i;
      const b = a + 1;
      const d = a + side;
      const c = d + 1;
      const hn = (v[a] + v[b] + v[c] + v[d]) / 4;
      if (hn <= 0) continue;
      foot += cellArea;
      if (strata) {
        const h = (level[a] + level[b] + level[c] + level[d]) / 4;
        add(cellArea, plinthTop, plinthTop + h);
        // Marches : écart de niveau avec le voisin de droite et celui du dessus.
        if (i + 1 < side - 1) {
          const right = (level[b] + level[b + 1] + level[c] + level[c + 1]) / 4;
          steps += Math.abs(right - h) * grid.cell;
        }
        if (j + 1 < side - 1) {
          const up =
            (level[d] + level[c] + level[d + side] + level[c + side]) / 4;
          steps += Math.abs(up - h) * grid.cell;
        }
      } else {
        const h = hn * config.height;
        add(cellArea, plinthTop, plinthTop + h);
        const gx =
          ((v[b] + v[c] - (v[a] + v[d])) * config.height) / (2 * grid.cell);
        const gy =
          ((v[d] + v[c] - (v[a] + v[b])) * config.height) / (2 * grid.cell);
        surface += cellArea * (Math.sqrt(1 + gx * gx + gy * gy) - 1);
      }
    }
  }
  // La montagne recouvre son pied : le dessus du socle n'a plus que le reste ;
  // les marches comptent leur flanc, le lissé a déjà ajouté sa pente.
  if (strata) surface += steps * 0.8;
  for (const line of model.lines) {
    const m = measureText(line.text);
    const a = m.areaPerCap2 * line.capMm * line.capMm;
    add(a, plinthTop, plinthTop + LABEL_HEIGHT_MM);
    surface += m.perimeterPerCap * line.capMm * LABEL_HEIGHT_MM;
  }
  return {
    volumeMm3: bandVolumes.reduce((x, y) => x + y, 0),
    bandVolumesMm3: bandVolumes,
    surfaceMm2: surface,
    footMm2: foot,
    plinthMm2: area,
  };
}
