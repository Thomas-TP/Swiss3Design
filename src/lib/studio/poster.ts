// Posters SVG du Studio (brief « Strates », §5.7 et §6.7) : le dessin du héros
// AVANT le JavaScript, et l'Élévation exacte du vase.
//
//  - `ghost` : 75 ellipses, trait `var(--color-iso)`, anneaux fantômes du vase
//    tous les 2 mm (≤ 6 Ko) ;
//  - `final` : 75 ellipses pleines empilées de bas en haut aux teintes des
//    bandes, filet plus sombre (≤ 8 Ko) ;
//  - `exploded` : bandes écartées de 12 mm (chapitre 01 de l'accueil) ;
//  - Élévation : silhouette SVG 2D exacte au dixième de millimètre, seule vue
//    disponible sans WebGL (C0).
//
// Un seul `viewBox` 4:5 sert aux deux cadrages (`preserveAspectRatio` en
// `meet`, fov vertical fixe, objet centré), exactement comme la caméra du
// Stage : `heroCamera()` (camera.ts) est la caméra commune, donc le poster SSR
// et la première frame WebGL se superposent. Les fonctions rendent des DONNÉES
// (ellipses, chemins) que le composant serveur affiche en JSX, et
// `posterToSvg` en donne la chaîne (mesure de poids, scripts, tests).
import { HERO_CONFIG } from "./presets";
import {
  cameraMatrix,
  heroCamera,
  heroCameraFor,
  projectPoint,
  type CameraSpec,
} from "./camera";
import { filamentHex, shade, tint } from "./filaments";
import { simplifyClosed, type Vec2 } from "./kernel/simplify";
import {
  FLOOR_MM,
  bandIndexAt,
  buildRingPlan,
  collectBreakpoints,
  createLavauxModel,
  innerRadius,
  uniformInterior,
  type LavauxModel,
} from "./objects/lavaux-model";
import type { LavauxConfig } from "./types";

/** Boîte visuelle 4:5 du héros (unités arbitraires ; seul le rapport compte). */
export const POSTER_VIEWBOX = { width: 400, height: 500 } as const;
/** Espacement des anneaux fantômes (mm) : le même `uGhostStep` que le matériau d'impression. */
export const GHOST_STEP_MM = 2;
/** Écartement des bandes de l'éclaté (mm). */
export const EXPLODE_GAP_MM = 12;

export interface PosterEllipse {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

export interface PosterLayer {
  /** Indice de bande. */
  band: number;
  fill: string;
  stroke: string;
  /** Ellipses de bas en haut (l'ordre est l'ordre de dessin). */
  ellipses: PosterEllipse[];
  /** Couronne du dessus (éclaté) : extérieur clair puis ouverture sombre. */
  cap?: { top: PosterEllipse; topFill: string; mouth: PosterEllipse; mouthFill: string };
}

export interface HeroPoster {
  variant: "ghost" | "final" | "exploded";
  viewBox: string;
  width: number;
  height: number;
  camera: CameraSpec;
  /** `ghost` : une seule série d'ellipses au trait. */
  ghost?: PosterEllipse[];
  /** `final` et `exploded` : une couche par bande. */
  layers?: PosterLayer[];
  /** `final` : ouverture du vase (ellipse sombre au sommet). */
  mouth?: { ellipse: PosterEllipse; fill: string };
}

const r1 = (x: number) => Math.round(x * 10) / 10;

function project(
  spec: CameraSpec,
  aspect: number,
  model: LavauxModel,
  z: number,
  nudge: number,
  radiusOf: (theta: number) => number,
  zShift: number,
): PosterEllipse {
  const m = cameraMatrix(spec, aspect);
  const { width: W, height: H } = POSTER_VIEWBOX;
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  const K = 96;
  void model;
  void nudge;
  for (let i = 0; i < K; i++) {
    const theta = (i * 2 * Math.PI) / K;
    const r = radiusOf(theta);
    const [nx, ny] = projectPoint(m, [r * Math.cos(theta), r * Math.sin(theta), z + zShift]);
    const x = W / 2 + (nx * W) / 2;
    const y = H / 2 - (ny * H) / 2;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return {
    cx: r1((x0 + x1) / 2),
    cy: r1((y0 + y1) / 2),
    rx: r1((x1 - x0) / 2),
    ry: r1((y1 - y0) / 2),
  };
}

function ringTools(config: LavauxConfig) {
  const model = createLavauxModel(config);
  const tmp = new Float64Array(3);
  const outer = (z: number, nudge: number) => (theta: number) => {
    model.outer(theta, z, nudge, tmp);
    return tmp[0];
  };
  const mouth = (z: number, nudge: number) => (theta: number) => {
    model.outer(theta, z, nudge, tmp);
    return innerRadius(model.wall, tmp[0], tmp[1], tmp[2]);
  };
  return { model, outer, mouth };
}

/** Caméra de l'éclaté : mêmes angles et même part de hauteur que le héros, hauteur totale écartée. */
function explodedCamera(config: LavauxConfig): CameraSpec {
  const gap = (z: number) => bandIndexAt(config.bands, z - 1e-6) * EXPLODE_GAP_MM;
  return heroCameraFor(config, gap, config.h + (config.bands.length - 1) * EXPLODE_GAP_MM);
}

/**
 * Poster du héros. `ghost` et `final` utilisent la caméra du héros (celle du
 * Stage) ; `exploded` recadre sur la hauteur écartée.
 */
export function heroPoster(
  config: LavauxConfig,
  variant: HeroPoster["variant"],
): HeroPoster {
  const { width: W, height: H } = POSTER_VIEWBOX;
  const aspect = W / H;
  const exploded = variant === "exploded";
  const camera =
    exploded || config.h !== HERO_CONFIG.h || config.d !== HERO_CONFIG.d
      ? exploded
        ? explodedCamera(config)
        : heroCameraFor(config)
      : heroCamera();
  const { model, outer, mouth } = ringTools(config);
  const count = Math.floor(config.h / GHOST_STEP_MM + 1e-9);
  const zs: number[] = [];
  for (let k = 1; k <= count; k++) zs.push(k * GHOST_STEP_MM);
  const base = {
    variant,
    viewBox: `0 0 ${W} ${H}`,
    width: W,
    height: H,
    camera,
  } as const;

  if (variant === "ghost") {
    return {
      ...base,
      ghost: zs.map((z) => project(camera, aspect, model, z, -1, outer(z, -1), 0)),
    };
  }

  const bands = config.bands;
  const layers: PosterLayer[] = bands.map((band, k) => {
    const fill = filamentHex(band.filament);
    return { band: k, fill, stroke: shade(fill, 0.38), ellipses: [] };
  });
  const shift = (z: number) =>
    exploded ? bandIndexAt(bands, z - 1e-6) * EXPLODE_GAP_MM : 0;
  for (const z of zs) {
    const k = bandIndexAt(bands, z - GHOST_STEP_MM / 2);
    layers[k].ellipses.push(
      project(camera, aspect, model, z, -1, outer(z, -1), exploded ? k * EXPLODE_GAP_MM : 0),
    );
  }
  void shift;

  if (exploded) {
    bands.forEach((band, k) => {
      const zTop = Math.min(band.toMm, config.h);
      const s = k * EXPLODE_GAP_MM;
      layers[k].cap = {
        top: project(camera, aspect, model, zTop, -1, outer(zTop, -1), s),
        topFill: tint(layers[k].fill, 0.22),
        mouth: project(camera, aspect, model, zTop, -1, mouth(zTop, -1), s),
        mouthFill: shade(layers[k].fill, 0.5),
      };
    });
    return { ...base, layers };
  }

  const last = layers[layers.length - 1];
  return {
    ...base,
    layers,
    mouth: {
      ellipse: project(camera, aspect, model, config.h, -1, mouth(config.h, -1), 0),
      fill: shade(last.fill, 0.5),
    },
  };
}

// ── Sérialisation en chaîne SVG ──────────────────────────────────────────────

export interface SvgOptions {
  /** Classe du `<svg>` (défaut `s3d-poster-svg`). */
  className?: string;
  /** Préfixe des identifiants (plusieurs posters dans une même page). */
  idPrefix?: string;
}

const n = (x: number) => String(Math.round(x * 10) / 10);
const ell = (e: PosterEllipse, extra = "") =>
  `<ellipse${extra} cx="${n(e.cx)}" cy="${n(e.cy)}" rx="${n(e.rx)}" ry="${n(e.ry)}"/>`;

/** Chaîne SVG d'un poster de héros (décoratif : `aria-hidden`). */
export function posterToSvg(poster: HeroPoster, options: SvgOptions = {}): string {
  const cls = options.className ?? "s3d-poster-svg";
  const head = `<svg xmlns="http://www.w3.org/2000/svg" class="${cls}" viewBox="${poster.viewBox}" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">`;
  if (poster.ghost) {
    // Le trait suit le jeton `iso` du thème ; `vector-effect` garde 1 px à toute échelle.
    return (
      `${head}<style>.s3d-pg ellipse{fill:none;stroke:var(--color-iso);stroke-width:1;vector-effect:non-scaling-stroke}</style>` +
      `<g class="s3d-pg">${poster.ghost.map((e) => ell(e)).join("")}</g></svg>`
    );
  }
  const body = (poster.layers ?? [])
    .map((layer) => {
      const group = layer.ellipses.map((e) => ell(e)).join("");
      const cap = layer.cap
        ? `<g fill="${layer.cap.topFill}">${ell(layer.cap.top)}</g><g fill="${layer.cap.mouthFill}">${ell(layer.cap.mouth)}</g>`
        : "";
      return `<g fill="${layer.fill}" stroke="${layer.stroke}" stroke-width="0.6">${group}</g>${cap}`;
    })
    .join("");
  const mouth = poster.mouth
    ? `<g fill="${poster.mouth.fill}">${ell(poster.mouth.ellipse)}</g>`
    : "";
  return `${head}${body}${mouth}</svg>`;
}

// ── Élévation exacte ─────────────────────────────────────────────────────────

export interface ElevationData {
  /** x, y, largeur, hauteur du viewBox, en mm (1 unité = 1 mm, y vers le bas). */
  viewBox: [number, number, number, number];
  /** Silhouette fermée (chemin SVG, mm, un dixième de millimètre). */
  outline: string;
  /** Bandes de bas en haut : rectangles découpés par la silhouette. */
  bands: { filament: string; hex: string; y: number; height: number }[];
  /** Ligne du plateau (y en mm). */
  baseY: number;
  heightMm: number;
  widthMm: number;
}

const ELEVATION_PAD_MM = 6;

/** Élévation du vase : silhouette latérale exacte (max et min de x sur θ) et bandes de couleur. */
export function lavauxElevation(config: LavauxConfig): ElevationData {
  const model = createLavauxModel(config);
  const h = config.h;
  const bps = collectBreakpoints(
    0,
    h,
    [FLOOR_MM, ...config.bands.slice(0, -1).map((b) => b.toMm)],
    model.pattern.discontinuities(h),
  );
  // Échantillonnage en z : 1 mm, resserré sur les rampes de gradin (0,25 mm).
  const fine = model.pattern.discontinuities(h).length > 0 ? 0.25 : 1;
  const plan = buildRingPlan(
    bps,
    (a, b) => uniformInterior(a, b, Math.max(1, Math.ceil((b - a) / fine))),
    true,
  );
  const tmp = new Float64Array(3);
  const K = model.pattern.axisymmetric ? 1 : 180;
  const right: Vec2[] = [];
  const left: Vec2[] = [];
  let maxX = 0;
  for (let j = 0; j < plan.count; j++) {
    if (plan.ledge[j] === 1 && plan.nudge[j] === -1) continue; // doublon de la rampe
    let x1 = -Infinity;
    let x0 = Infinity;
    for (let i = 0; i < K; i++) {
      const theta = K === 1 ? 0 : (i * 2 * Math.PI) / K;
      model.outer(theta, plan.z[j], plan.nudge[j], tmp);
      if (K === 1) {
        x1 = tmp[0];
        x0 = -tmp[0];
      } else {
        const x = tmp[0] * Math.cos(theta);
        if (x > x1) x1 = x;
        if (x < x0) x0 = x;
      }
    }
    right.push([x1, plan.z[j]]);
    left.push([x0, plan.z[j]]);
    maxX = Math.max(maxX, x1, -x0);
  }
  // Contour : monte à droite, redescend à gauche (sens trigonométrique vu de face).
  const ring: Vec2[] = [...right, ...left.slice().reverse()];
  const simplified = simplifyClosed(ring, 0.04);
  const W = 2 * maxX + 2 * ELEVATION_PAD_MM;
  const H = h + 2 * ELEVATION_PAD_MM;
  const x0 = -maxX - ELEVATION_PAD_MM;
  const toY = (z: number) => h - z + ELEVATION_PAD_MM;
  const outline =
    simplified
      .map((p, i) => `${i === 0 ? "M" : "L"}${n(p[0])} ${n(toY(p[1]))}`)
      .join("") + "Z";
  let from = 0;
  const bands = config.bands.map((b) => {
    const top = Math.min(b.toMm, h);
    const out = {
      filament: b.filament,
      hex: filamentHex(b.filament),
      y: r1(toY(top)),
      height: r1(top - from),
    };
    from = top;
    return out;
  });
  return {
    viewBox: [r1(x0), 0, r1(W), r1(H)],
    outline,
    bands,
    baseY: r1(toY(0)),
    heightMm: h,
    widthMm: r1(2 * maxX),
  };
}

/** Chaîne SVG de l'élévation (décorative : `aria-hidden`). */
export function elevationToSvg(data: ElevationData, options: SvgOptions = {}): string {
  const cls = options.className ?? "s3d-elevation-svg";
  const id = `${options.idPrefix ?? "s3d-el"}-sil`;
  const [x, y, w, h] = data.viewBox;
  const rects = data.bands
    .map(
      (b) =>
        `<rect x="${n(x)}" y="${n(b.y)}" width="${n(w)}" height="${n(b.height)}" fill="${b.hex}"/>`,
    )
    .join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" class="${cls}" viewBox="${n(x)} ${n(y)} ${n(w)} ${n(h)}" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">` +
    `<defs><clipPath id="${id}"><path d="${data.outline}"/></clipPath></defs>` +
    `<g clip-path="url(#${id})">${rects}</g>` +
    `<path d="${data.outline}" fill="none" stroke="currentColor" stroke-width="0.5" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>` +
    `<path d="M${n(x)} ${n(data.baseY)}H${n(x + w)}" stroke="currentColor" stroke-width="0.5" vector-effect="non-scaling-stroke"/>` +
    `</svg>`
  );
}
