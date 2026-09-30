// Carte « Cartouche » (brief « Strates », §6.2 et §6.3.4) : 85 × 55 mm, le
// format suisse. Plaque = rectangle arrondi ; texte en RELIEF posé sur la plaque
// ou GRAVÉ dans son épaisseur ; quatre mises en page (marges de 5 mm) :
//
//   classique   nom en haut à gauche (capitale 5,2 mm), fonction dessous
//               (4 mm), deux lignes en bas à gauche (3,6 mm), disque de 3 mm
//               en haut à droite ;
//   centree     les quatre lignes centrées ;
//   cartouche   cadre de 1 mm à 4 mm du bord et filet sous le nom ;
//   monogramme  initiales (capitale 18 mm, réduites au besoin) à gauche, le nom
//               et la fonction à leur droite, les deux lignes de contact en bas
//               sur toute la largeur (elles ne tiendraient pas dans la colonne).
//
// Capitales minimales : 4 mm pour le nom, 3,6 mm pour le reste. Une ligne trop
// longue rétrécit jusqu'à ce minimum, puis `text-fit` (le texte est quand même
// tracé, débordant : l'interface bloque l'envoi tant qu'une erreur subsiste).
//
// Modèle pur (métriques seulement, aucun contour de glyphe) : identique en SSR
// et côté client. Le maillage est dans `cartouche.ts`.
import type { Polygon } from "../kernel/extrude";
import { checkLine, type TextIssue } from "../text/check";
import { sanitizeTexts, type TextField } from "../text/fields";
import {
  ARC_SEGMENTS,
  circleRing,
  roundedRectRing,
  type ShapeLod,
} from "../text/geometry";
import {
  codePoints,
  isSupportedChar,
  lineStartX,
  MIN_CAP_MM,
  MIN_NAME_CAP_MM,
  textWidthMm,
  type PlacedLine,
  type TextAlign,
} from "../text/layout";
import { cartoucheDepthMax } from "../schemas";
import type { CartoucheConfig, StudioTexts } from "../types";
import type { FlatModel } from "./flat-model";

/** Format suisse d'une carte de visite (mm). */
export const CARTOUCHE_SIZE = { width: 85, height: 55 } as const;
const MARGIN = 5;
/** Largeur maximale des initiales du monogramme (mm) et capitale nominale / minimale. */
const MONOGRAM = { capMm: 18, minCapMm: 8, maxWidthMm: 28, gapMm: 5 } as const;

interface LineSlot {
  field: TextField;
  cap: number;
  /** Ligne de base (mm). */
  baseline: number;
  /** Repère horizontal et alignement. */
  x: number;
  align: TextAlign;
  maxWidth: number;
}

/** Profondeur réelle de la gravure : la plaque garde au moins 0,4 mm sous la gravure. */
export function cartoucheInkDepth(config: CartoucheConfig): number {
  return Math.min(
    config.depth,
    cartoucheDepthMax(config.thickness, config.mode),
  );
}

/** Initiales (1 ou 2) d'un nom : première lettre de chacun des deux premiers mots, en capitale. */
export function initialsOf(name: string): string {
  const words = name.split(/[\s]+/).filter(Boolean).slice(0, 2);
  let out = "";
  for (const word of words) {
    const first = codePoints(word)[0];
    if (!first) continue;
    const upper = first.toUpperCase();
    const ch =
      codePoints(upper).length === 1 && isSupportedChar(upper) ? upper : first;
    if (isSupportedChar(ch)) out += ch;
  }
  return out;
}

export function layoutCartouche(
  config: CartoucheConfig,
  texts: StudioTexts | undefined,
  lod: ShapeLod = "export",
): FlatModel {
  const arc = ARC_SEGMENTS[lod];
  const { width: W, height: H } = CARTOUCHE_SIZE;
  const x0 = -W / 2;
  const x1 = W / 2;
  const y0 = -H / 2;
  const y1 = H / 2;
  const left = x0 + MARGIN;
  const right = x1 - MARGIN;
  const top = y1 - MARGIN;
  const bottom = y0 + MARGIN;
  const clean = sanitizeTexts("cartouche", texts);
  const decor: Polygon[] = [];
  const slots: LineSlot[] = [];
  const lines: PlacedLine[] = [];
  const issues: TextIssue[] = [];

  const NAME = 5.2;
  const ROLE = 4;
  const SMALL = 3.6;
  // Descente des caractères à queue (g, p, y, ç) : 0,3 capitale, gardée sous la ligne du bas.
  const lowBase = bottom + 0.3 * SMALL;
  const nameBase = top - NAME;
  const roleBase = nameBase - 6.7;
  const lineGap = SMALL + 2.6;

  switch (config.layout) {
    case "classique": {
      decor.push({ outer: circleRing(right - 1.5, top - 1.5, 1.5, 4 * arc) });
      const nameMax = right - 6 - left;
      slots.push(
        {
          field: "name",
          cap: NAME,
          baseline: nameBase,
          x: left,
          align: "left",
          maxWidth: nameMax,
        },
        {
          field: "role",
          cap: ROLE,
          baseline: roleBase,
          x: left,
          align: "left",
          maxWidth: right - left,
        },
        {
          field: "line1",
          cap: SMALL,
          baseline: lowBase + lineGap,
          x: left,
          align: "left",
          maxWidth: right - left,
        },
        {
          field: "line2",
          cap: SMALL,
          baseline: lowBase,
          x: left,
          align: "left",
          maxWidth: right - left,
        },
      );
      break;
    }
    case "centree": {
      const maxWidth = right - left;
      slots.push(
        {
          field: "name",
          cap: NAME,
          baseline: 9.6,
          x: 0,
          align: "center",
          maxWidth,
        },
        {
          field: "role",
          cap: ROLE,
          baseline: 2.9,
          x: 0,
          align: "center",
          maxWidth,
        },
        {
          field: "line1",
          cap: SMALL,
          baseline: -7.5,
          x: 0,
          align: "center",
          maxWidth,
        },
        {
          field: "line2",
          cap: SMALL,
          baseline: -13.7,
          x: 0,
          align: "center",
          maxWidth,
        },
      );
      break;
    }
    case "cartouche": {
      // Cadre de 1 mm à 4 mm du bord ; contenu à 8 mm du bord.
      const r = config.corner;
      decor.push({
        outer: roundedRectRing(
          x0 + 4,
          y0 + 4,
          x1 - 4,
          y1 - 4,
          Math.max(0, r - 4),
          arc,
        ),
        holes: [
          roundedRectRing(
            x0 + 5,
            y0 + 5,
            x1 - 5,
            y1 - 5,
            Math.max(0, r - 5),
            arc,
          ),
        ],
      });
      const cl = x0 + 8;
      const cr = x1 - 8;
      const ct = y1 - 8;
      const cb = y0 + 8;
      const base1 = ct - NAME;
      const ruleTop = base1 - 0.3 * NAME - 1.6;
      decor.push({
        outer: [
          [cl, ruleTop - 1],
          [cr, ruleTop - 1],
          [cr, ruleTop],
          [cl, ruleTop],
        ],
      });
      const low = cb + 0.3 * SMALL;
      const maxWidth = cr - cl;
      slots.push(
        {
          field: "name",
          cap: NAME,
          baseline: base1,
          x: cl,
          align: "left",
          maxWidth,
        },
        {
          field: "role",
          cap: ROLE,
          baseline: ruleTop - 1 - 1.3 - ROLE,
          x: cl,
          align: "left",
          maxWidth,
        },
        {
          field: "line1",
          cap: SMALL,
          baseline: low + lineGap,
          x: cl,
          align: "left",
          maxWidth,
        },
        {
          field: "line2",
          cap: SMALL,
          baseline: low,
          x: cl,
          align: "left",
          maxWidth,
        },
      );
      break;
    }
    case "monogramme": {
      const initials = clean.name ? initialsOf(clean.name) : "";
      let columnX = left;
      if (initials) {
        const check = checkLine({
          field: "name",
          text: initials,
          capMm: MONOGRAM.capMm,
          minCapMm: MONOGRAM.minCapMm,
          maxWidthMm: MONOGRAM.maxWidthMm,
        });
        const width = textWidthMm(initials, check.capMm);
        lines.push({
          key: "monogram",
          text: initials,
          capMm: check.capMm,
          x: left,
          y: top - check.capMm,
        });
        columnX = left + width + MONOGRAM.gapMm;
      }
      const columnWidth = right - columnX;
      slots.push(
        {
          field: "name",
          cap: NAME,
          baseline: nameBase,
          x: columnX,
          align: "left",
          maxWidth: columnWidth,
        },
        {
          field: "role",
          cap: ROLE,
          baseline: roleBase,
          x: columnX,
          align: "left",
          maxWidth: columnWidth,
        },
        {
          field: "line1",
          cap: SMALL,
          baseline: lowBase + lineGap,
          x: left,
          align: "left",
          maxWidth: right - left,
        },
        {
          field: "line2",
          cap: SMALL,
          baseline: lowBase,
          x: left,
          align: "left",
          maxWidth: right - left,
        },
      );
      break;
    }
  }

  for (const slot of slots) {
    const text = clean[slot.field];
    if (!text) continue;
    const check = checkLine({
      field: slot.field,
      text,
      capMm: slot.cap,
      minCapMm: slot.field === "name" ? MIN_NAME_CAP_MM : MIN_CAP_MM,
      maxWidthMm: slot.maxWidth,
    });
    issues.push(...check.issues);
    lines.push({
      key: slot.field,
      text,
      capMm: check.capMm,
      x: lineStartX(text, check.capMm, slot.x, slot.align),
      y: slot.baseline,
    });
  }

  return {
    object: "cartouche",
    mode: config.mode,
    outline: {
      outer: roundedRectRing(x0, y0, x1, y1, config.corner, arc),
    },
    lines,
    decor,
    plateMm: config.thickness,
    inkMm: cartoucheInkDepth(config),
    widthMm: W,
    depthMm: H,
    plate: config.plate,
    ink: config.ink,
    issues,
  };
}
