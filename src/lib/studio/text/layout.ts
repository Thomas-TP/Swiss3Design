// Mesure et mise en page du texte en relief (brief « Strates », §6.3.3, WP-02),
// à partir de la SEULE table de métriques générée (`glyph-metrics.ts`) : chasse,
// aire et hauteurs de chaque glyphe. Pas de contours ici, donc rien de lourd
// dans le Worker : les statistiques et les garde-fous du Studio (SSR comme
// client) passent par ces fonctions, et le maillage (`shapes.ts`) place ensuite
// les vrais contours aux positions que ce module a calculées.
//
// Règles du brief : hauteur de capitale en mm, approche = chasse × échelle +
// 0,02 em, pas de crénage, alignement gauche ou centre ; ajustement automatique
// (réduction jusqu'au minimum, sinon erreur `text-fit`) ; trait = `stem` ×
// échelle : < 0,8 mm avertissement, < 0,6 mm erreur ; capitale minimale 3,6 mm
// (4 mm pour le nom).
import { FONT_METRICS, GLYPH_HOOKS, GLYPH_TABLE } from "./glyph-metrics";

/** Approche entre deux glyphes : 0,02 em, sans crénage. */
export const TRACKING_EM = 0.02;
/** Trait minimal conseillé (avertissement en dessous) et imprimable (erreur en dessous), mm. */
export const STROKE_WARN_MM = 0.8;
export const STROKE_ERROR_MM = 0.6;
/** Capitale minimale du texte courant et du nom (mm). */
export const MIN_CAP_MM = 3.6;
export const MIN_NAME_CAP_MM = 4;

export type TextAlign = "left" | "center" | "right";

/** Échelle (mm par unité de police) d'une capitale de `capMm`. */
export function scaleForCap(capMm: number): number {
  return capMm / FONT_METRICS.capHeight;
}

/** Trait horizontal régulier (mm) d'un texte dont la capitale mesure `capMm`. */
export function strokeMm(capMm: number): number {
  return FONT_METRICS.stem * scaleForCap(capMm);
}

/** Capitale (mm) qui donne exactement le trait `strokeMmTarget`. */
export function capForStroke(strokeMmTarget: number): number {
  return (strokeMmTarget * FONT_METRICS.capHeight) / FONT_METRICS.stem;
}

/** Normalisation d'un texte saisi : NFC (les accents composés sont des caractères du jeu). */
export function normalizeText(text: string): string {
  return text.normalize("NFC");
}

/** Points de code d'un texte (un emoji hors BMP reste UN caractère). */
export function codePoints(text: string): string[] {
  return Array.from(text);
}

export function isSupportedChar(ch: string): boolean {
  return Object.hasOwn(GLYPH_TABLE, ch);
}

/**
 * Caractères hors du jeu de glyphes, sans doublon, dans l'ordre d'apparition.
 * Le jeu : U+0020–007E, U+00A0–00FF, U+0100–017F et ’ – —. Un saut de ligne ou
 * une tabulation est hors jeu (les champs du Studio sont des lignes).
 */
export function unsupportedChars(text: string): string[] {
  const seen = new Set<string>();
  for (const ch of codePoints(normalizeText(text))) {
    if (!isSupportedChar(ch)) seen.add(ch);
  }
  return [...seen];
}

export interface TextMeasure {
  /** Nombre de caractères mesurés. */
  count: number;
  /** Chasse totale à la capitale 1 mm (mm par mm de capitale) : largeur = `perCap` × capMm. */
  perCap: number;
  /** Aire d'encre à la capitale 1 mm (mm² par mm² de capitale). */
  areaPerCap2: number;
  /** Périmètre des contours (trous compris) à la capitale 1 mm (mm par mm de capitale). */
  perimeterPerCap: number;
  /** Plus basse et plus haute encre relatives à la ligne de base (mm par mm de capitale). */
  yMinPerCap: number;
  yMaxPerCap: number;
}

const EMPTY: TextMeasure = {
  count: 0,
  perCap: 0,
  areaPerCap2: 0,
  perimeterPerCap: 0,
  yMinPerCap: 0,
  yMaxPerCap: 0,
};

/** Marge verticale (unités de police) : un voisin qui frôle la hauteur du dépassement compte aussi. */
const HOOK_Y_MARGIN = 12;

function overlapsY(a0: number, a1: number, b0: number, b1: number): boolean {
  return a0 - HOOK_Y_MARGIN <= b1 && b0 <= a1 + HOOK_Y_MARGIN;
}

/**
 * Espace supplémentaire (unités de police) entre deux glyphes voisins dont
 * l'encre se frôlerait : l'accent de î ou ï sous la barre d'un T, le caron de ď
 * devant n'importe quelle lettre haute, le crochet de j sous une parenthèse…
 * Ce n'est PAS un crénage (aucune paire n'est resserrée) : seulement le
 * dépassement de chaque glyphe hors de sa boîte de chasse, et seulement contre un
 * voisin dont l'encre monte ou descend à la même hauteur. Les formes d'encre
 * restent ainsi disjointes, condition de la gravure sans CSG (test sur les
 * 322 × 322 paires du jeu). Le même calcul sert à la mesure (SSR) et au maillage.
 */
export function pairExtraUnits(a: string, b: string): number {
  const ha = Object.hasOwn(GLYPH_HOOKS, a) ? GLYPH_HOOKS[a] : undefined;
  const hb = Object.hasOwn(GLYPH_HOOKS, b) ? GLYPH_HOOKS[b] : undefined;
  if (!ha && !hb) return 0;
  let extra = 0;
  if (ha && ha[3] > 0) {
    const [, , lo, hi] = GLYPH_TABLE[b];
    if (overlapsY(ha[4], ha[5], lo, hi)) extra += ha[3];
  }
  if (hb && hb[0] > 0) {
    const [, , lo, hi] = GLYPH_TABLE[a];
    if (overlapsY(hb[1], hb[2], lo, hi)) extra += hb[0];
  }
  return extra;
}

/**
 * Mesure d'un texte (déjà normalisé) à la capitale de 1 mm : la largeur et
 * l'aire se déduisent de toute capitale par `× capMm` et `× capMm²`. Les
 * caractères hors du jeu comptent pour zéro (ils sont signalés à part).
 */
export function measureText(text: string): TextMeasure {
  const chars = codePoints(text).filter(isSupportedChar);
  if (chars.length === 0) return EMPTY;
  let advance = 0;
  let area = 0;
  let perimeter = 0;
  let yMin = 0;
  let yMax = 0;
  let previous = "";
  for (const ch of chars) {
    const [adv, areaHundreds, lo, hi, perimeterTens] = GLYPH_TABLE[ch];
    advance += adv;
    if (previous) advance += pairExtraUnits(previous, ch);
    previous = ch;
    area += areaHundreds * 100;
    perimeter += perimeterTens * 10;
    if (lo < yMin) yMin = lo;
    if (hi > yMax) yMax = hi;
  }
  const upm = FONT_METRICS.unitsPerEm;
  const cap = FONT_METRICS.capHeight;
  const units = advance + (chars.length - 1) * TRACKING_EM * upm;
  return {
    count: chars.length,
    perCap: units / cap,
    areaPerCap2: area / (cap * cap),
    perimeterPerCap: perimeter / cap,
    yMinPerCap: yMin / cap,
    yMaxPerCap: yMax / cap,
  };
}

/** Largeur (mm) d'un texte à la capitale `capMm` (chasses + approche, sans marge). */
export function textWidthMm(text: string, capMm: number): number {
  return measureText(text).perCap * capMm;
}

export interface FitResult {
  /** Capitale retenue (mm), au dixième de mm vers le bas. */
  capMm: number;
  /** Faux si le texte déborde même à la capitale minimale : `text-fit`. */
  fits: boolean;
  /** Vrai si la capitale a dû être réduite sous la capitale demandée. */
  shrunk: boolean;
}

/** Arrondi au dixième de millimètre vers le bas (le texte ne déborde jamais d'un arrondi). */
function floorTenth(mm: number): number {
  return Math.floor(mm * 10 + 1e-9) / 10;
}

/**
 * Ajustement automatique : la capitale demandée, réduite jusqu'à ce que le
 * texte tienne dans `maxWidthMm`, sans descendre sous `minCapMm`. Un texte qui
 * déborde au minimum ne « tient pas » (`fits: false`, capitale = minimum).
 */
export function fitCap(
  text: string,
  capMm: number,
  minCapMm: number,
  maxWidthMm: number,
): FitResult {
  const perCap = measureText(text).perCap;
  if (perCap === 0) return { capMm, fits: true, shrunk: false };
  if (perCap * capMm <= maxWidthMm + 1e-9) {
    return { capMm, fits: true, shrunk: false };
  }
  const fitted = floorTenth(maxWidthMm / perCap);
  if (fitted >= minCapMm - 1e-9) {
    return { capMm: fitted, fits: true, shrunk: true };
  }
  return { capMm: minCapMm, fits: false, shrunk: true };
}

/** Abscisse du départ de la ligne (mm) selon l'alignement ; `x` est le repère d'alignement. */
export function lineStartX(
  text: string,
  capMm: number,
  x: number,
  align: TextAlign,
): number {
  const width = textWidthMm(text, capMm);
  if (align === "center") return x - width / 2;
  if (align === "right") return x - width;
  return x;
}

/** Ligne de texte placée : tout ce qu'il faut pour la tracer ou la mesurer. */
export interface PlacedLine {
  /** Champ de `StudioTexts` d'où vient le texte (ou `label`, `monogram`). */
  key: string;
  text: string;
  capMm: number;
  /** Départ de la ligne de base (mm), repère de l'objet centré sur l'origine. */
  x: number;
  /** Ligne de base (mm). */
  y: number;
}

/** Boîte d'encre d'une ligne placée [x0, y0, x1, y1] (mm), d'après les hauteurs des glyphes. */
export function lineInkBox(line: PlacedLine): [number, number, number, number] {
  const m = measureText(line.text);
  return [
    line.x,
    line.y + m.yMinPerCap * line.capMm,
    line.x + m.perCap * line.capMm,
    line.y + m.yMaxPerCap * line.capMm,
  ];
}

/** Aire d'encre (mm²) d'une ligne placée. */
export function lineInkArea(line: PlacedLine): number {
  return measureText(line.text).areaPerCap2 * line.capMm * line.capMm;
}
