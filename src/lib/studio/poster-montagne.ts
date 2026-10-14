// Élévation de la Montagne (brief « Strates », §6.7 : « Élévation (SVG 2D exact) ») :
// la silhouette latérale EXACTE, vue de face (on regarde vers l'arrière, +Y), au
// dixième de millimètre, avec les bandes de couleur par altitude et une ligne
// de couche toutes les 10 couches (2 mm). C'est le poster du Stage (le dessin
// que le serveur rend avant le JavaScript et sans WebGL) et la vue « Élévation ».
//
// La silhouette est l'enveloppe haute de la surface : pour chaque abscisse, le
// maximum de l'altitude sur toutes les profondeurs (grille de poster, 144
// cellules en travers de l'emprise). Le socle est un rectangle de la largeur hors
// tout du contour. En strates, la hauteur est celle de l'escalier.
import { filamentHex } from "./filaments";
import type { Vec2 } from "./kernel/simplify";
import { simplifyClosed } from "./kernel/simplify";
import {
  GRID_ACROSS,
  layoutMontagne,
  mountainGrid,
  plinthDimensions,
  stairHeight,
  strataThresholds,
} from "./objects/montagne-model";
import { elevationToSvg, type ElevationData } from "./poster";
import { MONTAGNE_DEFAULT } from "./presets";
import type { MontagneConfig } from "./types";

/** Écart des lignes de couche de l'élévation (mm) : 10 couches de 0,2 mm. */
export const COURSE_INTERVAL_MM = 2;
const ELEVATION_PAD_MM = 6;

const r1 = (x: number) => Math.round(x * 10) / 10;
const n = (x: number) => String(r1(x));

export function montagneElevation(config: MontagneConfig): ElevationData {
  const model = layoutMontagne(config, undefined);
  const half = plinthDimensions(config).widthMm / 2;
  const total = model.total;
  const grid = mountainGrid(config, GRID_ACROSS.poster);
  const side = grid.m + 1;
  const thresholds = strataThresholds(config);

  // Enveloppe haute : maximum sur toutes les profondeurs, colonne par colonne.
  const crest: Vec2[] = [];
  for (let i = 0; i < side; i++) {
    let hn = 0;
    for (let j = 0; j < side; j++) {
      const v = grid.values[j * side + i];
      if (v > hn) hn = v;
    }
    const h =
      config.style === "strates"
        ? stairHeight(hn, thresholds, model.tops, config.plinth)
        : hn * config.height;
    crest.push([grid.x0 + i * grid.cell, config.plinth + h]);
  }
  // Socle puis crête, sens trigonométrique vu de face : bas gauche, bas droit,
  // dessus du socle à droite, crête de droite à gauche, dessus du socle à gauche.
  const left = crest[0][0];
  const right = crest[crest.length - 1][0];
  const ring: Vec2[] = [
    [-half, 0],
    [half, 0],
    [half, config.plinth],
    [right, config.plinth],
    ...crest.slice().reverse(),
    [left, config.plinth],
    [-half, config.plinth],
  ];
  const simplified = simplifyClosed(ring, 0.04);

  const W = 2 * half + 2 * ELEVATION_PAD_MM;
  const H = total + 2 * ELEVATION_PAD_MM;
  const toY = (z: number) => total - z + ELEVATION_PAD_MM;
  const outline =
    simplified
      .map((p, i) => `${i === 0 ? "M" : "L"}${n(p[0])} ${n(toY(p[1]))}`)
      .join("") + "Z";
  let from = 0;
  const bands = config.bands.map((band) => {
    const top = Math.min(band.toMm, total);
    const out = {
      filament: band.filament,
      hex: filamentHex(band.filament),
      y: r1(toY(top)),
      height: r1(top - from),
    };
    from = top;
    return out;
  });
  // Lignes de couche : une toutes les 10 couches, du socle au sommet.
  const courses: number[] = [];
  for (let z = COURSE_INTERVAL_MM; z < total - 1e-6; z += COURSE_INTERVAL_MM) {
    courses.push(r1(toY(z)));
  }
  return {
    viewBox: [r1(-half - ELEVATION_PAD_MM), 0, r1(W), r1(H)],
    outline,
    bands,
    baseY: r1(toY(0)),
    heightMm: total,
    widthMm: r1(2 * half),
    courses,
  };
}

// ── Poster statique par défaut ───────────────────────────────────────────────

/** Filets du poster statique par thème : l'encre du jeton `ink` clair, le papier du thème sombre. */
export const MONTAGNE_POSTER_STROKE = {
  light: "#1C1917",
  dark: "#EDE8E0",
} as const;

/**
 * SVG du poster par défaut (`public/posters/montagne-default-<thème>.svg`,
 * écrit par `scripts/gen-montagne-posters.ts`) : l'élévation de la montagne par
 * défaut, sans étiquette. Un fichier `<img>` n'hérite d'aucune couleur : les
 * filets portent celle de leur thème.
 */
export function montagnePosterSvg(
  theme: keyof typeof MONTAGNE_POSTER_STROKE,
): string {
  return elevationToSvg(montagneElevation(MONTAGNE_DEFAULT), {
    className: "s3d-montagne-poster",
    idPrefix: `s3d-mp-${theme}`,
    stroke: MONTAGNE_POSTER_STROKE[theme],
  });
}
