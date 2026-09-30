// Contrôles d'un champ de texte (brief « Strates », §6.3.3 et §6.6) : jeu de
// glyphes (`text-char`), longueur saisissable et ajustement à la place
// disponible (`text-fit`), épaisseur du trait (`text-stroke`). Les modèles des
// objets (Cartouche, Relief, Borne) appellent `checkLine` pour chaque ligne ;
// les garde-fous (`guards.ts`) traduisent les anomalies en `Printability`.
import { overLimit, type TextField } from "./fields";
import {
  fitCap,
  STROKE_ERROR_MM,
  STROKE_WARN_MM,
  strokeMm,
  textWidthMm,
  unsupportedChars,
} from "./layout";

export interface TextIssue {
  code: "text-char" | "text-fit" | "text-stroke";
  /** Champ concerné : `name`, `role`, `line1`, `line2`, `peak`, `text`, ou `label`. */
  field: string;
  /** `text-char` : le caractère refusé. */
  char?: string;
  /** `text-stroke` : trait mesuré (mm). `text-fit` : largeur nécessaire à la capitale minimale (mm). */
  value?: number;
}

export interface LineCheck {
  /** Capitale retenue (mm) : celle demandée, réduite au besoin jusqu'au minimum. */
  capMm: number;
  issues: TextIssue[];
}

export interface LineSpec {
  field: TextField | "label";
  /** Texte nettoyé (NFC, espaces fusionnés). */
  text: string;
  /** Capitale souhaitée et minimale (mm). */
  capMm: number;
  minCapMm: number;
  /** Largeur disponible (mm). */
  maxWidthMm: number;
}

/**
 * Contrôle d'une ligne : caractères hors du jeu, dépassement de la longueur
 * saisissable, ajustement automatique (réduction jusqu'au minimum, sinon
 * `text-fit`), puis trait sur la capitale retenue.
 */
export function checkLine(spec: LineSpec): LineCheck {
  const issues: TextIssue[] = [];
  for (const char of unsupportedChars(spec.text)) {
    issues.push({ code: "text-char", field: spec.field, char });
  }
  const fit = fitCap(spec.text, spec.capMm, spec.minCapMm, spec.maxWidthMm);
  if (!fit.fits) {
    issues.push({
      code: "text-fit",
      field: spec.field,
      value: Math.round(textWidthMm(spec.text, spec.minCapMm) * 10) / 10,
    });
  } else if (spec.field !== "label" && overLimit(spec.field, spec.text)) {
    issues.push({ code: "text-fit", field: spec.field });
  }
  const stroke = strokeMm(fit.capMm);
  if (stroke < STROKE_WARN_MM - 1e-9) {
    issues.push({
      code: "text-stroke",
      field: spec.field,
      value: Math.round(stroke * 100) / 100,
    });
  }
  return { capMm: fit.capMm, issues };
}

/** Sévérité d'un trait trop fin : erreur sous 0,6 mm, avertissement sous 0,8 mm. */
export function strokeLevel(stroke: number): "warn" | "error" {
  return stroke < STROKE_ERROR_MM - 1e-9 ? "error" : "warn";
}
