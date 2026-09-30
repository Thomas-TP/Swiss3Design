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
import { analyzeLavaux, type LavauxAnalysis } from "./objects/lavaux-analysis";
import { clampLavaux, gradinsDepthMax, MIN_BAND_MM } from "./schemas";
import type {
  Band,
  IssueCode,
  LavauxConfig,
  Printability,
  StudioConfig,
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
              wavelength: Math.ceil((4 * p.amplitude) / 0.5 - 1e-9) * 0.5,
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
 * Correction d'un surplomb : on essaie, du plus discret au plus visible,
 * un motif moins profond, un galbe réduit, puis plus de hauteur (la pente du
 * profil varie comme 1 / h). Chaque essai est vérifié par une analyse (≈ 1 ms)
 * et la première correction qui ramène la pente à 45° l'emporte ; le résultat
 * est la différence avec la configuration d'origine (clés modifiées seulement).
 */
function overhangFix(config: LavauxConfig): Partial<LavauxConfig> | undefined {
  const tries: LavauxConfig[] = [];
  if (config.pattern.kind !== "lisse") {
    for (const k of [0.75, 0.5]) {
      tries.push({ ...config, pattern: scalePattern(config.pattern, k) });
    }
  }
  for (const k of [0.75, 0.5])
    tries.push({ ...config, belly: config.belly * k });
  for (const k of [1.2, 1.5]) tries.push({ ...config, h: config.h * k });
  for (const candidate of tries) {
    const fixed = clampLavaux(candidate);
    if (analyzeLavaux(fixed).maxOutwardSlope > OVERHANG_SLOPE) continue;
    const partial: Partial<LavauxConfig> = {};
    if (JSON.stringify(fixed.pattern) !== JSON.stringify(config.pattern)) {
      partial.pattern = fixed.pattern;
    }
    if (fixed.belly !== config.belly) partial.belly = fixed.belly;
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
      fix: inward ? undefined : overhangFix(config),
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

/**
 * Garde-fous d'une configuration quelconque. Les objets à texte et plats
 * (Cartouche, Relief, Borne) arrivent avec WP-02 : ils lèvent ici plutôt que
 * de répondre « imprimable » sans avoir rien vérifié.
 */
export function checkPrintability(config: StudioConfig): Printability {
  if (config.object === "lavaux") return checkLavaux(config);
  throw new Error(
    `checkPrintability : « ${config.object} » est livré par WP-02`,
  );
}
