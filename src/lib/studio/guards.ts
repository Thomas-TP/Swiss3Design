// Garde-fous du Studio (brief « Strates », §6.6). Règles du vase « Lavaux »
// (WP-01) ; WP-02 ajoute celles des objets à texte (text-stroke, text-fit,
// text-char) et des objets plats.
//
// | Code              | Règle                                                          |
// | overhang          | pente vers l'extérieur ≤ 45° partout (∂r_o/∂z ≤ 1)             |
// | base-narrow       | rayon du pied ≥ 20 mm et ≥ 35 % du rayon max                   |
// | plate             | boîte ≤ 250 × 250 × 250 mm                                     |
// | band-thin         | bande ≥ 2 mm                                                   |
// | pattern-coupling  | gradins gd ≤ 0,5 gs ET gd ≤ paroi − 0,2 ; vagues wl ≥ 4 wa ; voronoï w ≥ 1,2 va |
// | near-vase-spirale | BLOQUANT : nervures 28–56, |torsion| ≥ 45°, col ≤ 0,6         |
//
// Sévérités (le brief ne fixe que celle du trait des textes) : `error` bloque
// « Envoyer à l'atelier » ; `warn` affiche « À vérifier ». Surplomb entre 45°
// et 60° : avertissement (une petite rampe s'imprime), au-delà de 60° : erreur.
// Plaque > 250 mm et silhouette du Vase spirale : erreur. Pied étroit, bande
// fine, couplage de motif : avertissement (imprimable, mais à regarder).
//
// Silhouette d'Ian (Vase spirale, CC BY-ND 4.0, §1.5) : pas de profil
// « bouteille », col ≥ 0,5 (exclus par construction) et `nearVaseSpirale`.
import { layoutBorne } from "./objects/borne-model";
import { layoutCartouche } from "./objects/cartouche-model";
import type { FlatModel } from "./objects/flat-model";
import { analyzeLavaux, type LavauxAnalysis } from "./objects/lavaux-analysis";
import {
  layoutRelief,
  type Locale,
  type ReliefModel,
} from "./objects/relief-model";
import {
  clampLavaux,
  gradinsDepthMax,
  MIN_BAND_MM,
  vaguesWavelengthMin,
} from "./schemas";
import { strokeLevel, type TextIssue } from "./text/check";
import { capForStroke, STROKE_WARN_MM } from "./text/layout";
import type {
  Band,
  BorneConfig,
  IssueCode,
  LavauxConfig,
  Printability,
  StudioConfig,
  StudioTexts,
} from "./types";

/** Volume maximal d'impression des machines de l'atelier (mm) : P1S 256, K2 260. */
export const PLATE_MM = 250;
export const MIN_FOOT_RADIUS_MM = 20;
export const MIN_FOOT_RATIO = 0.35;
/** Pente (dr/dz) au-delà de laquelle une paroi extérieure est un surplomb : tan 45°. */
export const OVERHANG_SLOPE = 1;
/**
 * Tolérance de mesure (6 %) : le héros du brief (galet, gradins 5 / 1,4)
 * culmine à 1,01 (45,3°) vers z = 7,5 mm ; il doit rester « imprimable ».
 * Les corrections, elles, visent la pente exacte de 45°.
 */
export const OVERHANG_TOLERANCE = 0.06;
/** Au-delà (≈ 60°), l'impression échoue : erreur plutôt qu'avertissement. */
export const OVERHANG_ERROR_SLOPE = 1.7;

type Issue = Extract<Printability, { issues: unknown }>["issues"][number];

/**
 * Clé du message d'une anomalie dans le namespace `studioCore` : à traduire
 * avec `useTranslations("studioCore")` et les valeurs de `issueValues`
 * (`textChar` attend en plus `{ char }`, que seul le texte saisi connaît).
 */
export const ISSUE_MESSAGE_KEYS: Record<IssueCode, string> = {
  overhang: "guard.issue.overhang",
  "base-narrow": "guard.issue.baseNarrow",
  plate: "guard.issue.plate",
  "band-thin": "guard.issue.bandThin",
  "pattern-coupling": "guard.issue.patternCoupling",
  "text-stroke": "guard.issue.textStroke",
  "text-fit": "guard.issue.textFit",
  "text-char": "guard.issue.textChar",
  "near-vase-spirale": "guard.issue.nearVase",
};

/** Arguments ICU d'une anomalie : `angle` et `at` (surplomb), `value` (les autres). */
export function issueValues(issue: Issue): Record<string, number> {
  const out: Record<string, number> = {};
  if (issue.code === "overhang") {
    if (issue.value !== undefined) out.angle = issue.value;
    if (issue.atMm !== undefined) out.at = issue.atMm;
  } else if (issue.value !== undefined) {
    out.value = issue.value;
  }
  return out;
}

/**
 * Arguments ICU de type chaîne d'une anomalie : `char` pour `text-char`
 * (« Caractère non imprimable : {char} »). À fusionner avec `issueValues`.
 */
export function issueStrings(issue: Issue): Record<string, string> {
  return issue.code === "text-char" && issue.char !== undefined
    ? { char: issue.char }
    : {};
}

/** Silhouette du Vase spirale de Ian : nervures fines et torsadées, col fin. */
export function nearVaseSpirale(config: StudioConfig): boolean {
  if (config.object !== "lavaux") return false;
  const p = config.pattern;
  return (
    p.kind === "nervures" &&
    p.count >= 28 &&
    p.count <= 56 &&
    Math.abs(p.twistDeg) >= 45 &&
    config.neck <= 0.6
  );
}

/** Angle d'un surplomb par rapport à la verticale, en degrés (un dixième près). */
export function slopeToAngle(slope: number): number {
  return Math.round(((Math.atan(slope) * 180) / Math.PI) * 10) / 10;
}

function bandIssues(bands: readonly Band[]): Issue[] {
  const issues: Issue[] = [];
  let prev = 0;
  bands.forEach((band, k) => {
    const thickness = band.toMm - prev;
    if (thickness < MIN_BAND_MM - 1e-6 && bands.length > 1) {
      // Fusion avec la voisine : la bande fine disparaît, sa hauteur revient à
      // la précédente (ou à la suivante pour la toute première).
      const merged: Band[] = bands.map((b) => ({ ...b }));
      if (k === 0) merged.shift();
      else {
        merged[k - 1].toMm = band.toMm;
        merged.splice(k, 1);
      }
      issues.push({
        code: "band-thin",
        atMm: prev,
        value: Math.round(thickness * 10) / 10,
        fix: { bands: merged } as Partial<LavauxConfig>,
      });
    }
    prev = band.toMm;
  });
  return issues;
}

/**
 * Couplages de motif. Un gradin plus profond que la paroi disconnecte les
 * étages (voir `gradinsDepthMax`) : erreur ; plus profond que `paroi − 0,2` ou
 * que la moitié du pas : simple avertissement.
 */
function couplingIssues(
  config: LavauxConfig,
): { issue: Issue; level: "warn" | "error" }[] {
  const p = config.pattern;
  if (
    p.kind === "gradins" &&
    p.depth > gradinsDepthMax(p.step, config.wall) + 1e-9
  ) {
    const depth = gradinsDepthMax(p.step, config.wall);
    return [
      {
        level: p.depth >= config.wall - 1e-9 ? "error" : "warn",
        issue: {
          code: "pattern-coupling",
          value: p.depth,
          fix: {
            pattern: { ...p, depth: Number(depth.toFixed(1)) },
          } as Partial<LavauxConfig>,
        },
      },
    ];
  }
  if (p.kind === "vagues" && p.wavelength < 4 * p.amplitude - 1e-9) {
    return [
      {
        level: "warn",
        issue: {
          code: "pattern-coupling",
          value: p.wavelength,
          fix: {
            pattern: {
              ...p,
              wavelength: vaguesWavelengthMin(p.amplitude),
            },
          } as Partial<LavauxConfig>,
        },
      },
    ];
  }
  return [];
}

/** Motif dont la profondeur (l'amplitude) est multipliée par `k`. */
function scalePattern(
  p: LavauxConfig["pattern"],
  k: number,
): LavauxConfig["pattern"] {
  switch (p.kind) {
    case "lisse":
      return p;
    case "gradins":
      return { ...p, depth: p.depth * k };
    case "vagues":
      return { ...p, amplitude: p.amplitude * k };
    case "voronoi":
      return { ...p, relief: p.relief * k };
    case "nervures":
      return { ...p, depth: p.depth * k, twistDeg: p.twistDeg * k };
  }
}

/**
 * Correction d'un surplomb (vers l'extérieur comme vers l'intérieur) : on
 * essaie, du plus discret au plus visible, un motif moins profond, un galbe
 * réduit, une lèvre réduite (sur un vase court, c'est elle qui fait le
 * surplomb : pente ≈ 1,875 × l × R / (0,08 h)), un col moins serré, puis plus de
 * hauteur (la pente du profil varie comme 1 / h), puis des combinaisons. Chaque
 * essai est vérifié par une analyse (≈ 1 ms) ; la première correction qui
 * ramène les DEUX pentes à 45° l'emporte. Le résultat est la différence avec la
 * configuration d'origine (clés modifiées seulement).
 */
function overhangFix(config: LavauxConfig): Partial<LavauxConfig> | undefined {
  const towardOne = (neck: number, k: number) => neck + (1 - neck) * k;
  const tries: LavauxConfig[] = [];
  if (config.pattern.kind !== "lisse") {
    for (const k of [0.75, 0.5, 0.25]) {
      tries.push({ ...config, pattern: scalePattern(config.pattern, k) });
    }
  }
  for (const k of [0.75, 0.5, 0.25, 0]) {
    tries.push({ ...config, belly: config.belly * k });
  }
  for (const k of [0.5, 0.25, 0])
    tries.push({ ...config, lip: config.lip * k });
  for (const k of [0.25, 0.5, 0.75]) {
    tries.push({ ...config, neck: towardOne(config.neck, k) });
  }
  for (const k of [1.2, 1.5, 2]) tries.push({ ...config, h: config.h * k });
  // Combinaisons, du plus discret au plus net : dernier recours avant d'abandonner.
  tries.push(
    { ...config, belly: config.belly * 0.5, lip: config.lip * 0.25 },
    {
      ...config,
      belly: config.belly * 0.5,
      lip: config.lip * 0.25,
      neck: towardOne(config.neck, 0.5),
    },
    {
      ...config,
      belly: 0,
      lip: 0,
      neck: towardOne(config.neck, 0.5),
      pattern: scalePattern(config.pattern, 0.5),
      h: config.h * 1.5,
    },
  );
  for (const candidate of tries) {
    const fixed = clampLavaux(candidate);
    const a = analyzeLavaux(fixed);
    if (Math.max(a.maxOutwardSlope, a.maxInwardSlope) > OVERHANG_SLOPE)
      continue;
    const partial: Partial<LavauxConfig> = {};
    if (JSON.stringify(fixed.pattern) !== JSON.stringify(config.pattern)) {
      partial.pattern = fixed.pattern;
    }
    if (fixed.belly !== config.belly) partial.belly = fixed.belly;
    if (fixed.lip !== config.lip) partial.lip = fixed.lip;
    if (fixed.neck !== config.neck) partial.neck = fixed.neck;
    if (fixed.h !== config.h) {
      partial.h = fixed.h;
      partial.bands = fixed.bands; // la hauteur change : les frontières de bande suivent
    }
    return partial;
  }
  return undefined;
}
/** Garde-fous du vase à partir d'une analyse déjà calculée. */
export function checkLavauxWith(
  config: LavauxConfig,
  analysis: LavauxAnalysis,
): Printability {
  const issues: Issue[] = [];
  let worst: "ok" | "warn" | "error" = "ok";
  const raise = (level: "warn" | "error") => {
    if (level === "error" || worst === "ok") worst = level;
  };

  if (nearVaseSpirale(config)) {
    const p = config.pattern;
    if (p.kind === "nervures") {
      issues.push({
        code: "near-vase-spirale",
        fix: {
          pattern: {
            ...p,
            twistDeg: Math.sign(p.twistDeg) * 30,
            count: Math.min(p.count, 24),
          },
        } as Partial<LavauxConfig>,
      });
      raise("error");
    }
  }

  // Boîte d'impression : largeur = diamètre de l'enveloppe, profondeur = idem.
  if (config.h > PLATE_MM || config.d > PLATE_MM) {
    issues.push({
      code: "plate",
      value: Math.max(config.h, config.d),
      fix: {
        h: Math.min(config.h, PLATE_MM),
        d: Math.min(config.d, PLATE_MM),
      } as Partial<LavauxConfig>,
    });
    raise("error");
  }

  const slope = Math.max(analysis.maxOutwardSlope, analysis.maxInwardSlope);
  if (slope > OVERHANG_SLOPE + OVERHANG_TOLERANCE) {
    const inward = analysis.maxInwardSlope > analysis.maxOutwardSlope;
    issues.push({
      code: "overhang",
      atMm:
        Math.round(
          (inward ? analysis.maxInwardSlopeZ : analysis.maxOutwardSlopeZ) * 10,
        ) / 10,
      value: slopeToAngle(slope),
      fix: overhangFix(config),
    });
    raise(slope > OVERHANG_ERROR_SLOPE ? "error" : "warn");
  }

  const foot = analysis.footRadius;
  if (
    foot < MIN_FOOT_RADIUS_MM - 1e-6 ||
    foot < MIN_FOOT_RATIO * analysis.envelopeRadius - 1e-6
  ) {
    issues.push({
      code: "base-narrow",
      atMm: 0,
      value: Math.round(foot * 10) / 10,
      fix:
        config.profile !== "cylindre"
          ? ({ profile: "cylindre" } as Partial<LavauxConfig>)
          : ({ belly: Math.min(config.belly, 0.4) } as Partial<LavauxConfig>),
    });
    raise("warn");
  }

  const thin = bandIssues(config.bands);
  if (thin.length > 0) {
    issues.push(...thin);
    raise("warn");
  }
  for (const { issue, level } of couplingIssues(config)) {
    issues.push(issue);
    raise(level);
  }

  if (worst === "ok") return { status: "ok" };
  // Les `fix: undefined` ne se sérialisent pas : on les retire.
  const cleaned = issues.map((i) => {
    const { fix, ...rest } = i;
    return fix ? { ...rest, fix } : rest;
  });
  return { status: worst, issues: cleaned };
}

export function checkLavaux(config: LavauxConfig): Printability {
  return checkLavauxWith(config, analyzeLavaux(config));
}

// ── Objets plats à texte (WP-02) ─────────────────────────────────────────────
//
// Textes (brief §6.3.3 et §6.6) : un caractère hors du jeu de glyphes est une
// ERREUR (`text-char`, « Caractère non imprimable : ✦ », retirez-le) ; un texte
// qui ne tient pas à la capitale minimale est une ERREUR (`text-fit`,
// « raccourcissez-le ») ; un trait sous 0,8 mm est un AVERTISSEMENT, sous
// 0,6 mm une ERREUR (`text-stroke`, agrandissez les lettres). Le porte-nom
// propose la correction (la hauteur de ses lettres) ; la carte et le sous-verre
// n'ont pas de réglage de taille de texte : pas de correction automatique.

type Found = { issue: Issue; level: "warn" | "error" };

/** Anomalies de texte d'un modèle, avec leur niveau. */
function textIssues(
  issues: readonly TextIssue[],
  fixStroke?: () => Partial<StudioConfig> | undefined,
): Found[] {
  return issues.map((t): Found => {
    if (t.code === "text-char") {
      return {
        level: "error",
        issue: { code: "text-char", field: t.field, char: t.char },
      };
    }
    if (t.code === "text-fit") {
      return {
        level: "error",
        issue: {
          code: "text-fit",
          field: t.field,
          ...(t.value !== undefined ? { value: t.value } : {}),
        },
      };
    }
    const fix = fixStroke?.();
    return {
      level: strokeLevel(t.value ?? 0),
      issue: {
        code: "text-stroke",
        field: t.field,
        ...(t.value !== undefined ? { value: t.value } : {}),
        ...(fix ? { fix } : {}),
      },
    };
  });
}

function toPrintability(found: Found[]): Printability {
  if (found.length === 0) return { status: "ok" };
  const status = found.some((f) => f.level === "error") ? "error" : "warn";
  return { status, issues: found.map((f) => f.issue) };
}

function plateIssue(width: number, depth: number, height: number): Found[] {
  const biggest = Math.max(width, depth, height);
  return biggest > PLATE_MM
    ? [
        {
          level: "error",
          issue: { code: "plate", value: Math.round(biggest * 10) / 10 },
        },
      ]
    : [];
}

/** Garde-fous d'un modèle de Cartouche ou de Borne (plaque + encre). */
export function checkFlatWith(
  model: FlatModel,
  fixStroke?: () => Partial<StudioConfig> | undefined,
): Printability {
  return toPrintability([
    ...plateIssue(model.widthMm, model.depthMm, model.plateMm + model.inkMm),
    ...textIssues(model.issues, fixStroke),
  ]);
}

/** Garde-fous du sous-verre : le plateau et le texte de l'étiquette. */
export function checkReliefWith(
  config: { size: number },
  model: ReliefModel,
): Printability {
  return toPrintability([
    ...plateIssue(config.size, config.size, model.heightMm),
    ...textIssues(model.issues),
  ]);
}

/** Correction du trait du porte-nom : la plus petite hauteur de lettres (0,5 mm près) qui donne 0,8 mm. */
export function borneStrokeFix(
  config: BorneConfig,
): Partial<BorneConfig> | undefined {
  const cap = Math.min(10, Math.ceil(capForStroke(STROKE_WARN_MM) * 2) / 2);
  return cap > config.cap ? { cap } : undefined;
}

/**
 * Garde-fous d'une configuration quelconque. Les objets à texte lisent `texts` ;
 * `locale` ne compte que pour l'étiquette du sous-verre (sa longueur varie avec
 * « POINTE » / « PIZ » / « PIZZO » / « MOUNT »).
 */
export function checkPrintability(
  config: StudioConfig,
  texts?: StudioTexts,
  locale?: Locale,
): Printability {
  switch (config.object) {
    case "lavaux":
      return checkLavaux(config);
    case "cartouche":
      return checkFlatWith(layoutCartouche(config, texts));
    case "borne":
      return checkFlatWith(layoutBorne(config, texts), () =>
        borneStrokeFix(config),
      );
    case "relief":
      return checkReliefWith(config, layoutRelief(config, texts, locale));
  }
}
