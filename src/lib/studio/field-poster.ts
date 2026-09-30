// Posters de champ de courbes (brief « Strates », §2.4, §7.3, §7.12, §7.18 et
// fiche WP-01) : des isolignes SVG statiques, en un fichier CLAIR et un fichier
// SOMBRE par usage (footer, 404, Léman, accueil mobile). Un fichier servi en
// `background-image` ne voit pas les jetons CSS : les couleurs des jetons
// `iso` et `iso-index` sont donc écrites en dur, une fois par thème.
//
// Chaîne : FBM PÉRIODIQUE (bruit de gradient replié sur des périodes entières,
// `kernel/noise.ts`) → grille → `d3-contour` (polygones aux seuils) → passage
// en unités du viewBox → Douglas–Peucker → chemins relatifs au dixième
// (quelques Ko par niveau). Sortie DÉTERMINISTE : même code, mêmes octets.
//
// Ce module est pur et jamais importé par l'application (le Worker ne le voit
// pas) : le script `scripts/gen-field-posters.ts` l'appelle pour écrire
// `public/posters/field-*-{light,dark}.svg`, et son test vérifie poids,
// périodicité et fraîcheur des fichiers commités.
import { contours } from "d3-contour";
import { simplifyClosed, type Vec2 } from "./kernel/simplify";
import { createPeriodicNoise2, periodicFbm2 } from "./kernel/noise";
import { FIELD_ANCHORS, FIELD_SIZES, type FieldId } from "./field-anchors";

export type Theme = "light" | "dark";

/** Jetons `iso` et `iso-index` (brief §2.1), en dur : un `background-image` ne lit pas le CSS. */
export const FIELD_COLORS: Record<Theme, { iso: string; index: string }> = {
  light: { iso: "#C9C1B2", index: "#9C7650" },
  dark: { iso: "#3A352F", index: "#8A6C4E" },
};

/** Poids maximal d'un champ SVG (octets) : brief §9.3, « champs SVG ≤ 60 Ko chacun ». */
export const FIELD_MAX_BYTES = 60 * 1024;

export interface FieldSpec {
  id: FieldId;
  /** Nombre de niveaux ; une courbe maîtresse tous les `indexEvery` niveaux. */
  levels: number;
  indexEvery: number;
  /** Côté d'une cellule de la grille, en unités du viewBox. */
  cell: number;
  /** Tolérance de Douglas–Peucker, en unités du viewBox. */
  tolerance: number;
  /** Hauteur en (u, v) ∈ [0, 1)² ; normalisée ensuite sur [0, 1]. */
  height(u: number, v: number, w: number, h: number): number;
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** Graine commune : la même pour tous les posters, une période différente par poster. */
const SEED = 20260930;

function periodicField(
  px: number,
  py: number,
  octaves: number,
  seed = SEED,
  persistence = 0.5,
) {
  const noise = createPeriodicNoise2(seed);
  return (u: number, v: number) =>
    periodicFbm2(noise, u * px, v * py, px, py, {
      octaves,
      persistence,
      lacunarity: 2,
    });
}

// ── Léman : un lac en croissant, deux rives, des reliefs de part et d'autre ──

/** Axe du lac (Genève en bas à gauche, Villeneuve à droite), en (u, v) ∈ [0, 1]². */
const LAKE_AXIS: Vec2[] = [
  [-0.08, 1.02],
  [0.1, 0.86],
  [0.3, 0.68],
  [0.5, 0.56],
  [0.7, 0.58],
  [0.9, 0.68],
  [1.08, 0.8],
];
/** Demi-largeur du lac (unités de hauteur du viewBox) le long de l'axe (0 → 1). */
const lakeHalfWidth = (t: number) =>
  0.03 + 0.05 * Math.sin(Math.PI * clamp01(t)) ** 0.7;

/** Spline de Catmull-Rom uniforme échantillonnée finement : points (u, v) et abscisse curviligne t. */
function lakeCenterline(samples = 240): { p: Vec2[]; t: number[] } {
  const pts = LAKE_AXIS;
  const out: Vec2[] = [];
  const n = pts.length - 1;
  for (let i = 0; i < samples; i++) {
    const f = (i / (samples - 1)) * n;
    const k = Math.min(Math.floor(f), n - 1);
    const s = f - k;
    const p0 = pts[Math.max(k - 1, 0)];
    const p1 = pts[k];
    const p2 = pts[k + 1];
    const p3 = pts[Math.min(k + 2, n)];
    const cr = (a: number, b: number, c: number, d: number) =>
      0.5 *
      (2 * b +
        (-a + c) * s +
        (2 * a - 5 * b + 4 * c - d) * s * s +
        (-a + 3 * b - 3 * c + d) * s * s * s);
    out.push([cr(p0[0], p1[0], p2[0], p3[0]), cr(p0[1], p1[1], p2[1], p3[1])]);
  }
  return { p: out, t: out.map((_, i) => i / (samples - 1)) };
}

const CENTERLINE = lakeCenterline();

/**
 * Distance signée à la rive (unités de hauteur du viewBox, isotrope) : < 0 dans
 * le lac ; `north` vaut 1 au nord de l'axe (les collines du Jorat), 0 au sud
 * (les Alpes de Savoie, plus raides).
 */
function shoreDistance(u: number, v: number, aspect: number) {
  let best = Infinity;
  let bestT = 0;
  let bestNorth = 1;
  for (let i = 0; i < CENTERLINE.p.length; i++) {
    const du = (u - CENTERLINE.p[i][0]) * aspect;
    const dv = v - CENTERLINE.p[i][1];
    const d = Math.hypot(du, dv);
    if (d < best) {
      best = d;
      bestT = CENTERLINE.t[i];
      bestNorth = dv < 0 ? 1 : 0;
    }
  }
  return { d: best - lakeHalfWidth(bestT), north: bestNorth };
}

/** Point de la rive NORD à l'abscisse `u` (repère (u, v) ∈ [0, 1]²) : ancre d'une ville. */
export function northShoreAt(u: number, aspect: number): Vec2 {
  // Balayage vertical : la première rive rencontrée en descendant depuis le haut.
  for (let i = 0; i <= 4000; i++) {
    const v = i / 4000;
    if (shoreDistance(u, v, aspect).d < 0) return [u, v];
  }
  throw new Error(`northShoreAt : pas de lac à u = ${u}`);
}
const lemanNoise = periodicField(3, 2, 4, SEED + 3);

function lemanHeight(u: number, v: number, w: number, h: number): number {
  const { d, north } = shoreDistance(u, v, w / h);
  if (d <= 0) return 0; // le lac : plat, sans isoligne
  // Tout part de 0 à la rive (continuité : la rive est la première isoligne,
  // sans dentelure de grille) puis les collines du Jorat (nord, douces) et les
  // Alpes de Savoie (sud, plus hautes et plus raides) montent.
  const rise = 1 - Math.exp(-d / (north ? 0.22 : 0.15));
  const base =
    (north ? 0.42 : 0.3) * rise + (north ? 0.05 : 0.18) * smooth(0, 0.5, d);
  const detail = lemanNoise(u, v) * 0.22 * smooth(0, 0.08, d);
  return Math.max(0, base + detail);
}

// ── 404 : un sommet « non coté » à l'ancre « Vous êtes ici » ────────────────

const notFoundNoise = periodicField(3, 2, 3, SEED + 404, 0.45);

function notFoundHeight(u: number, v: number, w: number, h: number): number {
  const a = FIELD_ANCHORS["404"].here;
  const du = (u - a.u) * (w / h);
  const dv = v - a.v;
  const r2 = du * du + dv * dv;
  const bump = Math.exp(-r2 / (2 * 0.16 * 0.16));
  return 0.6 * bump + 0.45 * (notFoundNoise(u, v) * 0.5 + 0.5);
}

// ── Footer et accueil mobile : des champs purement périodiques ──────────────

const footerNoise = periodicField(2, 2, 3, SEED + 11, 0.42);
const homeNoise = periodicField(2, 3, 3, SEED + 23, 0.42);

export const FIELD_SPECS: Record<FieldId, FieldSpec> = {
  footer: {
    id: "footer",
    levels: 16,
    indexEvery: 5,
    cell: 3,
    tolerance: 0.45,
    height: (u, v) => footerNoise(u, v),
  },
  "404": {
    id: "404",
    levels: 20,
    indexEvery: 5,
    cell: 4,
    tolerance: 0.5,
    height: notFoundHeight,
  },
  leman: {
    id: "leman",
    levels: 22,
    indexEvery: 5,
    cell: 3,
    tolerance: 0.45,
    height: lemanHeight,
  },
  home: {
    id: "home",
    levels: 18,
    indexEvery: 5,
    cell: 3,
    tolerance: 0.45,
    height: (u, v) => homeNoise(u, v),
  },
};

// ── Génération ───────────────────────────────────────────────────────────────

export interface FieldData {
  id: FieldId;
  width: number;
  height: number;
  /** Chemin (sous-chemins fermés, relatifs) des courbes ordinaires. */
  iso: string;
  /** Chemin des courbes maîtresses. */
  index: string;
  /** Nombre de sous-chemins, pour les tests. */
  rings: { iso: number; index: number };
}

/** Nombre au dixième, sans zéro de tête (« .5 », « -.5 »), pour un chemin compact. */
function tenths(n: number): string {
  const s = (n / 10).toString();
  return s.replace(/^(-?)0\./, "$1.");
}

/** Sous-chemin fermé en coordonnées relatives au dixième (l'erreur ne s'accumule pas). */
function ringPath(ring: readonly Vec2[]): string {
  if (ring.length < 3) return "";
  const pts = ring.map(
    (p) => [Math.round(p[0] * 10), Math.round(p[1] * 10)] as const,
  );
  let out = `M${tenths(pts[0][0])} ${tenths(pts[0][1])}l`;
  let prev = "";
  for (let i = 1; i < pts.length; i++) {
    const dx = tenths(pts[i][0] - pts[i - 1][0]);
    const dy = tenths(pts[i][1] - pts[i - 1][1]);
    if (dx === "0" && dy === "0") continue;
    // Séparateur : espace seulement quand il est nécessaire à la lecture.
    const token = dy.startsWith("-") ? `${dx}${dy}` : `${dx} ${dy}`;
    out += (prev && !token.startsWith("-") ? " " : "") + token;
    prev = token;
  }
  return `${out}z`;
}

export function generateField(spec: FieldSpec): FieldData {
  const { width: W, height: H } = FIELD_SIZES[spec.id];
  const cell = spec.cell;
  // Une cellule de marge de chaque côté : d3-contour ferme ses polygones le
  // long du bord de la grille ; ce bord tombe hors du viewBox, donc invisible.
  const cols = Math.ceil(W / cell) + 2;
  const rows = Math.ceil(H / cell) + 2;
  const values = new Float64Array(cols * rows);
  let lo = Infinity;
  let hi = -Infinity;
  for (let j = 0; j < rows; j++) {
    const v = (j - 1) / (rows - 2);
    for (let i = 0; i < cols; i++) {
      const u = (i - 1) / (cols - 2);
      const value = spec.height(u, v, W, H);
      values[j * cols + i] = value;
      if (value < lo) lo = value;
      if (value > hi) hi = value;
    }
  }
  for (let k = 0; k < values.length; k++)
    values[k] = (values[k] - lo) / (hi - lo || 1);

  const thresholds: number[] = [];
  for (let k = 1; k <= spec.levels; k++)
    thresholds.push((k - 0.5) / spec.levels);
  const generator = contours().size([cols, rows]).thresholds(thresholds);
  const multi = generator(Array.from(values));

  const iso: string[] = [];
  const index: string[] = [];
  multi.forEach((level, k) => {
    const target = (k + 1) % spec.indexEvery === 0 ? index : iso;
    for (const polygon of level.coordinates) {
      for (const ring of polygon) {
        // d3-contour répète le premier point en fin de contour ; grille → viewBox.
        const pts: Vec2[] = ring
          .slice(0, -1)
          .map(([x, y]) => [(x - 1) * cell, (y - 1) * cell]);
        const simplified = simplifyClosed(pts, spec.tolerance);
        // Un contour entièrement hors du viewBox (bord de marge) ne sert à rien.
        if (
          simplified.every(
            ([x, y]) => x < -cell || x > W + cell || y < -cell || y > H + cell,
          )
        ) {
          continue;
        }
        const d = ringPath(simplified);
        if (d) target.push(d);
      }
    }
  });
  return {
    id: spec.id,
    width: W,
    height: H,
    iso: iso.join(""),
    index: index.join(""),
    rings: { iso: iso.length, index: index.length },
  };
}

/** Fichier SVG d'un champ pour un thème : couleurs des jetons écrites en dur. */
export function fieldSvg(data: FieldData, theme: Theme): string {
  const c = FIELD_COLORS[theme];
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${data.width} ${data.height}" preserveAspectRatio="xMidYMid slice">` +
    `<g fill="none" stroke-linejoin="round">` +
    `<path stroke="${c.iso}" stroke-width="1" vector-effect="non-scaling-stroke" d="${data.iso}"/>` +
    `<path stroke="${c.index}" stroke-width="1.4" vector-effect="non-scaling-stroke" d="${data.index}"/>` +
    `</g></svg>\n`
  );
}

/** Nom de fichier public d'un champ : `field-footer-light.svg`. */
export function fieldFileName(id: FieldId, theme: Theme): string {
  return `field-${id}-${theme}.svg`;
}

export const FIELD_IDS = Object.keys(FIELD_SPECS) as FieldId[];
