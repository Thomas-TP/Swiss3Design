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
// Lignes EMPILÉES d'après l'encre réelle : chaque ligne se place sous la
// précédente à `GAP_MM` de sa plus basse encre (queue de g, cédille) et sous la
// plus haute de la suivante (accent des capitales). Les plafonds (accents à
// 1,29 capitale, queues à 0,31) valent aussi pour une ligne vide ou sans
// accent : la mise en page ne bouge donc que pour un Å (1,37) ou un Ģ (−0,56),
// jamais à la saisie d'un é. Sans cela, l'accent d'une fonction frôle la queue
// d'un nom, et la gravure (qui suppose des formes d'encre disjointes) s'ouvre.
//
// Modèle pur (métriques seulement, aucun contour de glyphe) : identique en SSR
// et côté client. Le maillage est dans `cartouche.ts`.
import type { Polygon } from "../kernel/extrude";
import { checkLine, type TextIssue } from "../text/check";
import { sanitizeTexts } from "../text/fields";
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
  measureText,
  MIN_CAP_MM,
  MIN_NAME_CAP_MM,
  textWidthMm,
  type PlacedLine,
  type TextAlign,
} from "../text/layout";
import { cartoucheDepthMax } from "../ranges";
import type { CartoucheConfig, StudioTexts } from "../types";
import type { FlatModel } from "./flat-model";

/** Format suisse d'une carte de visite (mm). */
export const CARTOUCHE_SIZE = { width: 85, height: 55 } as const;
const MARGIN = 5;
/** Largeur maximale des initiales du monogramme (mm) et capitale nominale / minimale. */
const MONOGRAM = { capMm: 18, minCapMm: 8, maxWidthMm: 28, gapMm: 5 } as const;

/** Écart minimal entre l'encre de deux lignes superposées (mm). */
export const GAP_MM = 0.8;
/** Écart entre l'encre du nom et le filet, puis entre le filet et la fonction (mm). */
const RULE_GAP_MM = 1.2;
const RULE_HEIGHT_MM = 1;
/** Plafonds de l'encre d'une ligne, en capitales : accents des capitales, queues (g, p, y, ç). */
const ASCENT_FLOOR = 1.29;
const DESCENT_FLOOR = 0.31;

const NAME = 5.2;
const ROLE = 4;
const SMALL = 3.6;
const FIELDS = ["name", "role", "line1", "line2"] as const;
type CardField = (typeof FIELDS)[number];

interface Column {
  x: number;
  align: TextAlign;
  maxWidth: number;
}

/** Ce qui change d'une mise en page à l'autre : colonnes, repères et formes d'encre. */
interface Plan {
  decor: Polygon[];
  column: Record<CardField, Column>;
  /** Nom : arête haute de ses capitales (mm), ou sa ligne de base. */
  nameTop?: number;
  nameBaseline?: number;
  /** Ligne 2 : arête basse de son encre (mm), ou sa ligne de base. */
  bottomEdge?: number;
  line2Baseline?: number;
  /** Filet entre le nom et la fonction : abscisses. */
  rule?: { x0: number; x1: number };
  /** Sommet des initiales du monogramme (mm). */
  monogramTop?: number;
}

/** Encre d'une ligne au-dessus et au-dessous de sa ligne de base (mm), plafonds compris. */
function inkExtent(
  text: string | undefined,
  cap: number,
): { up: number; down: number } {
  const m = text ? measureText(text) : null;
  return {
    up: Math.max(ASCENT_FLOOR, m?.yMaxPerCap ?? 0) * cap,
    down: Math.max(DESCENT_FLOOR, -(m?.yMinPerCap ?? 0)) * cap,
  };
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
  const lines: PlacedLine[] = [];
  const issues: TextIssue[] = [];

  const plan = planOf(config, clean.name, {
    x0,
    x1,
    y0,
    y1,
    left,
    right,
    top,
    bottom,
    arc,
  });

  // 1. Capitale retenue de chaque ligne (ajustement à la largeur de sa colonne).
  const cap: Record<CardField, number> = {
    name: NAME,
    role: ROLE,
    line1: SMALL,
    line2: SMALL,
  };
  for (const field of FIELDS) {
    const text = clean[field];
    if (!text) continue;
    const check = checkLine({
      field,
      text,
      capMm: field === "name" ? NAME : field === "role" ? ROLE : SMALL,
      minCapMm: field === "name" ? MIN_NAME_CAP_MM : MIN_CAP_MM,
      maxWidthMm: plan.column[field].maxWidth,
    });
    issues.push(...check.issues);
    cap[field] = check.capMm;
  }

  // 2. Lignes de base : du haut vers le bas pour le nom, le filet et la
  //    fonction ; du bas vers le haut pour la ligne 2 puis la ligne 1.
  const ext = {
    name: inkExtent(clean.name, cap.name),
    role: inkExtent(clean.role, cap.role),
    line1: inkExtent(clean.line1, cap.line1),
    line2: inkExtent(clean.line2, cap.line2),
  };
  const base = {} as Record<CardField, number>;
  base.name = plan.nameBaseline ?? (plan.nameTop ?? top) - cap.name;
  const decor = plan.decor.slice();
  if (plan.rule) {
    const ruleTop = base.name - ext.name.down - RULE_GAP_MM;
    decor.push({
      outer: [
        [plan.rule.x0, ruleTop - RULE_HEIGHT_MM],
        [plan.rule.x1, ruleTop - RULE_HEIGHT_MM],
        [plan.rule.x1, ruleTop],
        [plan.rule.x0, ruleTop],
      ],
    });
    base.role = ruleTop - RULE_HEIGHT_MM - RULE_GAP_MM - ext.role.up;
  } else {
    base.role = base.name - ext.name.down - GAP_MM - ext.role.up;
  }
  base.line2 =
    plan.line2Baseline ?? (plan.bottomEdge ?? bottom) + ext.line2.down;
  base.line1 = base.line2 + ext.line2.up + GAP_MM + ext.line1.down;

  // 3. Initiales du monogramme : sommet de l'encre au repère haut.
  if (plan.monogramTop !== undefined && clean.name) {
    const initials = initialsOf(clean.name);
    if (initials) {
      const check = checkLine({
        field: "name",
        text: initials,
        capMm: MONOGRAM.capMm,
        minCapMm: MONOGRAM.minCapMm,
        maxWidthMm: MONOGRAM.maxWidthMm,
      });
      const up = Math.max(1, measureText(initials).yMaxPerCap) * check.capMm;
      lines.push({
        key: "monogram",
        text: initials,
        capMm: check.capMm,
        x: left,
        y: plan.monogramTop - up,
      });
    }
  }

  for (const field of FIELDS) {
    const text = clean[field];
    if (!text) continue;
    const column = plan.column[field];
    lines.push({
      key: field,
      text,
      capMm: cap[field],
      x: lineStartX(text, cap[field], column.x, column.align),
      y: base[field],
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

interface Frame {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  arc: number;
}

/** Colonnes, repères et formes d'encre de la mise en page. */
function planOf(
  config: CartoucheConfig,
  name: string | undefined,
  f: Frame,
): Plan {
  const full: Column = {
    x: f.left,
    align: "left",
    maxWidth: f.right - f.left,
  };
  switch (config.layout) {
    case "classique":
      return {
        decor: [
          {
            outer: circleRing(f.right - 1.5, f.top - 1.5, 1.5, 4 * f.arc),
          },
        ],
        // Le nom laisse 6 mm au disque de 3 mm.
        column: {
          name: { ...full, maxWidth: f.right - 6 - f.left },
          role: full,
          line1: full,
          line2: full,
        },
        nameTop: f.top,
        bottomEdge: f.bottom,
      };
    case "centree": {
      const centered: Column = {
        x: 0,
        align: "center",
        maxWidth: f.right - f.left,
      };
      return {
        decor: [],
        column: {
          name: centered,
          role: centered,
          line1: centered,
          line2: centered,
        },
        nameBaseline: 9.6,
        line2Baseline: -13.7,
      };
    }
    case "cartouche": {
      // Cadre de 1 mm à 4 mm du bord ; contenu à 8 mm du bord.
      const r = config.corner;
      const cl = f.x0 + 8;
      const cr = f.x1 - 8;
      const content: Column = { x: cl, align: "left", maxWidth: cr - cl };
      return {
        decor: [
          {
            outer: roundedRectRing(
              f.x0 + 4,
              f.y0 + 4,
              f.x1 - 4,
              f.y1 - 4,
              Math.max(0, r - 4),
              f.arc,
            ),
            holes: [
              roundedRectRing(
                f.x0 + 5,
                f.y0 + 5,
                f.x1 - 5,
                f.y1 - 5,
                Math.max(0, r - 5),
                f.arc,
              ),
            ],
          },
        ],
        column: {
          name: content,
          role: content,
          line1: content,
          line2: content,
        },
        nameTop: f.y1 - 8,
        bottomEdge: f.y0 + 8,
        rule: { x0: cl, x1: cr },
      };
    }
    case "monogramme": {
      // La colonne du nom et de la fonction commence après les initiales.
      let columnX = f.left;
      const initials = name ? initialsOf(name) : "";
      if (initials) {
        const check = checkLine({
          field: "name",
          text: initials,
          capMm: MONOGRAM.capMm,
          minCapMm: MONOGRAM.minCapMm,
          maxWidthMm: MONOGRAM.maxWidthMm,
        });
        columnX = f.left + textWidthMm(initials, check.capMm) + MONOGRAM.gapMm;
      }
      const column: Column = {
        x: columnX,
        align: "left",
        maxWidth: f.right - columnX,
      };
      return {
        decor: [],
        column: { name: column, role: column, line1: full, line2: full },
        nameTop: f.top,
        bottomEdge: f.bottom,
        monogramTop: f.top,
      };
    }
  }
}
