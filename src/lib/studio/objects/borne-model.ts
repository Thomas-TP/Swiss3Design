// Porte-nom « Borne » (brief « Strates », §6.2 et §6.3.4) : un contour
// dimensionné sur le texte (pilule = rectangle à rayons h / 2, étiquette =
// rectangle à coins coupés du côté de l'anneau, goutte, pic = triangle arrondi
// générique), un trou d'anneau (Ø 4 à 6 mm) et le texte en relief ou gravé de
// 0,8 mm. La longueur suit le texte (40 à 80 mm) ; au-delà, les lettres
// rétrécissent jusqu'à 5 mm, puis erreur `text-fit` (« Texte trop long »).
//
// JAMAIS de croix suisse ni d'armoiries ; la forme « pic » n'est ni le mark de
// Swiss3Design ni une croix : un triangle générique aux sommets arrondis.
//
// Toute la géométrie se calcule pour l'anneau à GAUCHE ; « droite » est la
// symétrie du contour (le texte, lui, se lit toujours de gauche à droite).
// Modèle pur (métriques seulement) : identique en SSR et côté client. Le
// maillage est dans `borne.ts`.
import type { Polygon } from "../kernel/extrude";
import type { TextIssue } from "../text/check";
import { sanitizeTexts, overLimit } from "../text/fields";
import {
  ARC_SEGMENTS,
  circleRing,
  hullRing,
  mirrorRingX,
  ringsBox,
  roundedPolygonRing,
  roundedRectRing,
  translateRing,
  type Ring,
  type ShapeLod,
} from "../text/geometry";
import {
  measureText,
  STROKE_WARN_MM,
  strokeMm,
  unsupportedChars,
  type PlacedLine,
} from "../text/layout";
import type { BorneConfig, StudioTexts } from "../types";
import type { FlatModel } from "./flat-model";

/** Longueur du porte-nom (mm) et capitale minimale avant `text-fit`. */
export const BORNE_LENGTH = { min: 40, max: 80 } as const;
export const BORNE_MIN_CAP_MM = 5;
/** Hauteur du relief ou profondeur de la gravure (mm) : le même pour les deux modes (§6.2). */
export const BORNE_INK_MM = 0.8;

const PIC_TIP_RADIUS = 1.8; // congé des trois sommets du pic (mm)
const PAD_V = 1.5; // marge verticale du texte (mm)
const PAD_X = 1.8; // marge horizontale du texte avant le bord (mm)
const WALL = 2; // matière autour du trou d'anneau (mm)
/**
 * Demi-hauteur d'encre (en capitales) au-dessus et au-dessous de l'axe des
 * capitales centrées, d'après le texte : les accents des capitales montent à
 * 1,29 capitale (soit 0,79 au-dessus de l'axe) et les queues descendent à 0,31
 * (0,81 au-dessous) ; ce sont des plafonds, donc le corps ne change pas à la
 * saisie d'un é. Seuls un Å (1,37) ou une cédille de virgule (Ģ, −0,56) le
 * grandissent : sans cela leur encre sortirait de la plaque.
 */
const HALF_INK_FLOOR = 0.81;
const ASCENT_FLOOR = 1.29;
const DESCENT_FLOOR = 0.31;

export function halfInkOf(text: string): number {
  const m = measureText(text);
  const up = Math.max(ASCENT_FLOOR, m.yMaxPerCap) - 0.5;
  const down = 0.5 + Math.max(DESCENT_FLOOR, -m.yMinPerCap);
  return Math.max(HALF_INK_FLOOR, up, down);
}

interface Plan {
  length: number;
  height: number;
  /** Début du texte dans le repère de l'anneau à gauche (mm depuis l'extrémité gauche). */
  textLeft: number;
  /** Contour (anneau à gauche, x de 0 à `length`, y centré). */
  outline: Ring;
  /** Trou d'anneau : centre (x, y = 0) et rayon ; absent si « aucun ». */
  hole: { x: number; r: number } | null;
}

function arcInset(radius: number, dy: number): number {
  return radius - Math.sqrt(Math.max(radius * radius - dy * dy, 0));
}

/** Hauteur du corps pour une capitale et une demi-hauteur d'encre (mm). */
export function borneBodyHeight(
  capMm: number,
  halfInk = HALF_INK_FLOOR,
): number {
  return 2 * (halfInk * capMm + PAD_V);
}

/**
 * Plan du contour pour une capitale et une largeur de texte données. Tout est
 * linéaire en la capitale (à l'arrondi de pilule près) : la recherche de la
 * capitale qui tient dans 80 mm se fait par pas de 0,1 mm.
 */
function plan(
  config: BorneConfig,
  capMm: number,
  textWidth: number,
  halfInk: number,
  arc: number,
): Plan {
  const H = borneBodyHeight(capMm, halfInk);
  const R = H / 2;
  const hasRing = config.ring !== "aucun";
  const ringR = config.ringD / 2;
  const dyMax = halfInk * capMm;
  const lug = arcInset(R, dyMax) + PAD_X;

  switch (config.shape) {
    case "pilule": {
      const start = (hasRing ? R + ringR + WALL : arcInset(R, dyMax)) + PAD_X;
      const end = lug;
      const length = Math.max(BORNE_LENGTH.min, start + textWidth + end);
      return {
        length,
        height: H,
        textLeft: start + (length - end - start - textWidth) / 2,
        outline: roundedRectRing(0, -H / 2, length, H / 2, R, arc),
        hole: hasRing ? { x: R, r: ringR } : null,
      };
    }
    case "etiquette": {
      const ch = 0.28 * H;
      const holeX = ringR + 2.5;
      const start = (hasRing ? holeX + ringR + WALL : ch) + PAD_X;
      const end = PAD_X + 0.8;
      const length = Math.max(BORNE_LENGTH.min, start + textWidth + end);
      return {
        length,
        height: H,
        textLeft: start + (length - end - start - textWidth) / 2,
        outline: roundedPolygonRing(
          [
            [ch, -H / 2],
            [length, -H / 2],
            [length, H / 2],
            [ch, H / 2],
            [0, H / 2 - ch],
            [0, -H / 2 + ch],
          ],
          1,
          arc,
        ),
        hole: hasRing ? { x: holeX, r: ringR } : null,
      };
    }
    case "goutte": {
      // Collet rond (qui porte l'anneau) relié au corps en pilule par deux
      // tangentes : l'enveloppe convexe des deux formes.
      const rho = hasRing ? ringR + 2.2 : 0.22 * H;
      const bodyLeft = 2 * rho + 0.55 * H;
      const start = bodyLeft + R + PAD_X;
      const end = lug;
      const length = Math.max(BORNE_LENGTH.min, start + textWidth + end);
      return {
        length,
        height: H,
        textLeft: start + (length - end - start - textWidth) / 2,
        outline: hullRing([
          ...circleRing(rho, 0, rho, 4 * arc),
          ...roundedRectRing(bodyLeft, -H / 2, length, H / 2, R, arc),
        ]),
        hole: hasRing ? { x: rho, r: ringR } : null,
      };
    }
    case "pic": {
      // Triangle arrondi : base verticale du côté de l'anneau, pointe à l'autre
      // bout. La hauteur disponible diminue vers la pointe : la longueur est
      // celle où le texte y tient encore.
      const base = 2.8 * H;
      const holeX = ringR + 3;
      const start = (hasRing ? holeX + ringR + WALL : 3) + PAD_X;
      const need = H + 1.6;
      const share = 1 - need / base;
      // Le congé de la pointe raccourcit la longueur réelle de
      // `r / sin(demi-angle) − r` : le sommet du triangle va plus loin pour que
      // le porte-nom mesure bien 40 mm au moins (et la longueur du texte au
      // plus, 80 mm).
      const shave = (apex: number) =>
        PIC_TIP_RADIUS * (1 / Math.sin(Math.atan(base / 2 / apex)) - 1);
      let minApex = BORNE_LENGTH.min;
      for (let i = 0; i < 4; i++) minApex = BORNE_LENGTH.min + shave(minApex);
      const apex = Math.max(minApex, (start + textWidth + 1) / share);
      const reach = apex * share - 1;
      return {
        length: apex - shave(apex),
        height: base,
        textLeft: start + (reach - start - textWidth) / 2,
        outline: roundedPolygonRing(
          [
            [0, -base / 2],
            [apex, 0],
            [0, base / 2],
          ],
          PIC_TIP_RADIUS,
          arc,
        ),
        hole: hasRing ? { x: holeX, r: ringR } : null,
      };
    }
  }
}

export function layoutBorne(
  config: BorneConfig,
  texts: StudioTexts | undefined,
  lod: ShapeLod = "export",
): FlatModel {
  const arc = ARC_SEGMENTS[lod];
  const text = sanitizeTexts("borne", texts).text ?? "";
  const issues: TextIssue[] = [];
  for (const char of unsupportedChars(text)) {
    issues.push({ code: "text-char", field: "text", char });
  }
  const perCap = measureText(text).perCap;
  const halfInk = halfInkOf(text);

  // Plus grande capitale (au dixième de mm, de la demandée à 5 mm) dont le
  // porte-nom tient dans 80 mm ; sinon la capitale minimale et `text-fit`.
  let tenths = Math.round(config.cap * 10);
  const minTenths = Math.round(BORNE_MIN_CAP_MM * 10);
  let chosen = plan(config, tenths / 10, perCap * (tenths / 10), halfInk, arc);
  while (chosen.length > BORNE_LENGTH.max + 1e-9 && tenths > minTenths) {
    tenths--;
    chosen = plan(config, tenths / 10, perCap * (tenths / 10), halfInk, arc);
  }
  const capMm = tenths / 10;
  if (chosen.length > BORNE_LENGTH.max + 1e-9) {
    issues.push({
      code: "text-fit",
      field: "text",
      value: Math.round(chosen.length * 10) / 10,
    });
  } else if (text && overLimit("text", text)) {
    issues.push({ code: "text-fit", field: "text" });
  }
  const stroke = strokeMm(capMm);
  if (text && stroke < STROKE_WARN_MM - 1e-9) {
    issues.push({
      code: "text-stroke",
      field: "text",
      value: Math.round(stroke * 100) / 100,
    });
  }

  // Anneau à droite : symétrie du contour, du trou et de la zone de texte.
  const mirrored = config.ring === "droite";
  const { length } = chosen;
  const textWidth = perCap * capMm;
  const textLeftFrame = mirrored
    ? length - (chosen.textLeft + textWidth)
    : chosen.textLeft;
  let outer: Ring = chosen.outline;
  let holeX = chosen.hole?.x ?? 0;
  if (mirrored) {
    outer = mirrorRingX(outer, length / 2);
    holeX = length - holeX;
  }
  const shift = -length / 2;
  const outline: Polygon = {
    outer: translateRing(outer, shift, 0),
    ...(chosen.hole
      ? {
          holes: [circleRing(holeX + shift, 0, chosen.hole.r, 4 * arc)],
        }
      : {}),
  };
  const lines: PlacedLine[] = text
    ? [
        {
          key: "text",
          text,
          capMm,
          x: textLeftFrame + shift,
          y: -capMm / 2,
        },
      ]
    : [];

  // Dimensions réelles du contour (les pointes arrondies du pic raccourcissent
  // un peu la longueur nominale).
  const [bx0, by0, bx1, by1] = ringsBox([outline.outer]);

  return {
    object: "borne",
    mode: config.mode,
    outline,
    lines,
    decor: [],
    plateMm: config.thickness,
    inkMm: BORNE_INK_MM,
    widthMm: bx1 - bx0,
    depthMm: by1 - by0,
    plate: config.base,
    ink: config.ink,
    issues,
  };
}
