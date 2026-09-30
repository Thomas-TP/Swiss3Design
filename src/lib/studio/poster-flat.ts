// Posters « vue de dessus » des objets plats (brief « Strates », §6.12, §7.6,
// §7.7 et fiche WP-02) : le dessin de la Cartouche, du Sous-verre « Relief » et
// du Porte-nom « Borne » AVANT le JavaScript, en SVG calculé par le code. Comme
// l'Élévation du vase, c'est aussi la seule vue disponible sans WebGL (C0) et
// l'aperçu exact (au dixième de millimètre) des objets plats.
//
// Les fonctions rendent des DONNÉES (chemins par couche de couleur) que le
// composant serveur affiche en JSX, et `topViewToSvg` en donne la chaîne (poids,
// fichiers statiques, tests). Coordonnées : 1 unité = 0,1 mm, Y vers le bas.
//
// Texte : sans `glyphs` (le Worker n'embarque pas les contours, règle d'or 10),
// chaque ligne est tracée par une barre aux dimensions exactes du texte
// (chasse × capitale) ; avec `glyphs`, par les contours réels des glyphes.
// Sous-verre : le poster statique du massif exclut l'étiquette (`label: false`) :
// elle est en DOM, mise à jour à chaque frappe (§7.5, chapitre 02).
import { filamentHex, shade, tint } from "./filaments";
import type { Polygon } from "./kernel/extrude";
import { layoutBorne } from "./objects/borne-model";
import { layoutCartouche } from "./objects/cartouche-model";
import type { FlatModel } from "./objects/flat-model";
import {
  bandOfSlab,
  layoutRelief,
  reliefLevels,
  reliefOutline,
  RELIEF_GRID,
  type Locale,
} from "./objects/relief-model";
import { polygonRings, type Ring } from "./text/geometry";
import { measureText, type PlacedLine } from "./text/layout";
import type {
  BorneConfig,
  CartoucheConfig,
  ReliefConfig,
  StudioTexts,
} from "./types";

export type Theme = "light" | "dark";

/** Unités du viewBox par millimètre : 1 unité = 0,1 mm. */
export const TOP_VIEW_UNITS_PER_MM = 10;

export interface TopViewLayer {
  role: "plate" | "level" | "ink" | "placeholder";
  fill: string;
  stroke: string;
  /** Opacité du remplissage (1 pour tout sauf les barres de texte). */
  opacity: number;
  /** Chemin SVG (sous-chemins fermés, règle pair-impair). */
  d: string;
}

export interface TopViewData {
  object: "cartouche" | "relief" | "borne";
  /** x, y, largeur, hauteur du viewBox (unités de 0,1 mm). */
  viewBox: [number, number, number, number];
  widthMm: number;
  depthMm: number;
  layers: TopViewLayer[];
}

export interface TopViewOptions {
  theme?: Theme;
  /**
   * Contours des glyphes d'une ligne placée (`linePolygons(line, "display",
   * font)`, fourni par l'appelant qui a chargé la police) ; sans lui, le texte
   * est tracé par des barres.
   */
  glyphs?: (line: PlacedLine) => Polygon[];
  /** Langue de l'étiquette du sous-verre. */
  locale?: Locale;
  /** Sous-verre : tracer l'étiquette (défaut oui) ; le poster statique du massif l'omet. */
  label?: boolean;
}

/** Filet d'une couche : plus sombre que sa teinte, plus clair en thème sombre pour détacher l'encre du fond. */
function strokeOf(fill: string, theme: Theme): string {
  return theme === "dark" ? tint(fill, 0.28) : shade(fill, 0.4);
}

const U = TOP_VIEW_UNITS_PER_MM;
const n = (x: number) => Math.round(x * U);

/** Sous-chemin fermé en coordonnées relatives entières (Y vers le bas). */
function subpath(ring: readonly (readonly number[])[]): string {
  if (ring.length < 3) return "";
  let d = "";
  let px = 0;
  let py = 0;
  ring.forEach((p, i) => {
    const x = n(p[0]);
    const y = -n(p[1]);
    if (i === 0) d += `M${x} ${y}l`;
    else {
      const dx = x - px;
      const dy = y - py;
      if (dx !== 0 || dy !== 0) d += `${dx} ${dy} `;
    }
    px = x;
    py = y;
  });
  return `${d.trimEnd()}z`;
}

function pathOfRings(rings: readonly Ring[]): string {
  return rings.map(subpath).join("");
}

function pathOfPolygons(polygons: readonly Polygon[]): string {
  return pathOfRings(polygonRings(polygons));
}

/** Barre de la taille exacte d'une ligne de texte : chasse × hauteur de capitale, coins ronds. */
function barOf(line: PlacedLine): Ring {
  const m = measureText(line.text);
  const x0 = line.x;
  const x1 = line.x + m.perCap * line.capMm;
  const y0 = line.y;
  const y1 = line.y + 0.72 * line.capMm;
  const r = Math.min(0.36 * line.capMm, (x1 - x0) / 2);
  const steps = 4;
  const ring: Ring = [];
  const corner = (cx: number, cy: number, a0: number) => {
    for (let k = 0; k <= steps; k++) {
      const a = a0 + (k * Math.PI) / 2 / steps;
      ring.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  };
  corner(x1 - r, y0 + r, -Math.PI / 2);
  corner(x1 - r, y1 - r, 0);
  corner(x0 + r, y1 - r, Math.PI / 2);
  corner(x0 + r, y0 + r, Math.PI);
  return ring;
}

function box(outline: readonly Ring[]): [number, number, number, number] {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const ring of outline) {
    for (const p of ring) {
      if (p[0] < x0) x0 = p[0];
      if (p[0] > x1) x1 = p[0];
      if (p[1] < y0) y0 = p[1];
      if (p[1] > y1) y1 = p[1];
    }
  }
  return [x0, y0, x1, y1];
}

/** Marge du cadrage autour de l'objet (mm). */
const PAD_MM = 2;

function viewBoxOf(
  b: [number, number, number, number],
): TopViewData["viewBox"] {
  return [
    n(b[0] - PAD_MM),
    -n(b[3] + PAD_MM),
    n(b[2] - b[0] + 2 * PAD_MM),
    n(b[3] - b[1] + 2 * PAD_MM),
  ];
}

function flatTopView(model: FlatModel, options: TopViewOptions): TopViewData {
  const theme = options.theme ?? "light";
  const plate = filamentHex(model.plate);
  const ink = filamentHex(model.ink);
  const layers: TopViewLayer[] = [
    {
      role: "plate",
      fill: plate,
      stroke: strokeOf(plate, theme),
      opacity: 1,
      d: pathOfPolygons([model.outline]),
    },
  ];
  if (model.decor.length > 0) {
    layers.push({
      role: "ink",
      fill: ink,
      stroke: strokeOf(ink, theme),
      opacity: 1,
      d: pathOfPolygons(model.decor),
    });
  }
  if (model.lines.length > 0) {
    if (options.glyphs) {
      const glyphs = model.lines.flatMap(options.glyphs);
      layers.push({
        role: "ink",
        fill: ink,
        stroke: strokeOf(ink, theme),
        opacity: 1,
        d: pathOfPolygons(glyphs),
      });
    } else {
      layers.push({
        role: "placeholder",
        fill: ink,
        stroke: "none",
        opacity: 0.55,
        d: pathOfRings(model.lines.map(barOf)),
      });
    }
  }
  return {
    object: model.object,
    viewBox: viewBoxOf(box(polygonRings([model.outline]))),
    widthMm: model.widthMm,
    depthMm: model.depthMm,
    layers,
  };
}

/** Vue de dessus de la Cartouche. */
export function cartoucheTopView(
  config: CartoucheConfig,
  texts?: StudioTexts,
  options: TopViewOptions = {},
): TopViewData {
  return flatTopView(layoutCartouche(config, texts, "display"), options);
}

/** Vue de dessus du Porte-nom. */
export function borneTopView(
  config: BorneConfig,
  texts?: StudioTexts,
  options: TopViewOptions = {},
): TopViewData {
  return flatTopView(layoutBorne(config, texts, "display"), options);
}

/**
 * Vue de dessus du sous-verre : le socle puis chaque strate dans la teinte de
 * sa bande, de bas en haut (les strates hautes recouvrent les basses), avec le
 * filet qui dessine les courbes de niveau.
 */
export function reliefTopView(
  config: ReliefConfig,
  texts?: StudioTexts,
  options: TopViewOptions = {},
): TopViewData {
  const theme = options.theme ?? "light";
  const model = layoutRelief(config, texts, options.locale);
  const bands = config.bands;
  const fillOf = (z0: number, z1: number) =>
    filamentHex(bands[bandOfSlab(bands, z0, z1)].filament);
  const baseFill = fillOf(0, model.tops[0]);
  const layers: TopViewLayer[] = [
    {
      role: "plate",
      fill: baseFill,
      stroke: strokeOf(baseFill, theme),
      opacity: 1,
      d: subpath(reliefOutline(config, "display")),
    },
  ];
  reliefLevels(config, RELIEF_GRID.display).forEach((polygons, k) => {
    if (polygons.length === 0) return;
    const fill = fillOf(model.tops[k], model.tops[k + 1]);
    layers.push({
      role: "level",
      fill,
      stroke: strokeOf(fill, theme),
      opacity: 1,
      d: pathOfPolygons(polygons),
    });
  });
  if (options.label !== false && model.lines.length > 0) {
    const labelFill = fillOf(model.tops[0], model.tops[0] + 0.6);
    if (options.glyphs) {
      layers.push({
        role: "ink",
        fill: labelFill,
        stroke: strokeOf(labelFill, theme),
        opacity: 1,
        d: pathOfPolygons(model.lines.flatMap(options.glyphs)),
      });
    } else {
      layers.push({
        role: "placeholder",
        fill: labelFill,
        stroke: "none",
        opacity: 0.85,
        d: pathOfRings(model.lines.map(barOf)),
      });
    }
  }
  const R = config.size / 2;
  return {
    object: "relief",
    viewBox: viewBoxOf([-R, -R, R, R]),
    widthMm: config.size,
    depthMm: config.size,
    layers,
  };
}

// ── Sérialisation en chaîne SVG ──────────────────────────────────────────────

export interface TopViewSvgOptions {
  /** Classe du `<svg>` (défaut `s3d-topview-svg`). */
  className?: string;
}

/** Chaîne SVG d'une vue de dessus (décorative : `aria-hidden`). */
export function topViewToSvg(
  data: TopViewData,
  options: TopViewSvgOptions = {},
): string {
  const cls = options.className ?? "s3d-topview-svg";
  const [x, y, w, h] = data.viewBox;
  const body = data.layers
    .map((layer) => {
      const stroke =
        layer.stroke === "none"
          ? ' stroke="none"'
          : ` stroke="${layer.stroke}" stroke-width="1" stroke-linejoin="round" vector-effect="non-scaling-stroke"`;
      const opacity =
        layer.opacity < 1 ? ` fill-opacity="${layer.opacity}"` : "";
      return `<path fill="${layer.fill}"${opacity}${stroke} fill-rule="evenodd" d="${layer.d}"/>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" class="${cls}" viewBox="${x} ${y} ${w} ${h}" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">${body}</svg>`;
}
