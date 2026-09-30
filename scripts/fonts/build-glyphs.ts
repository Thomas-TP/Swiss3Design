// Fabrique les glyphes du texte en relief du Studio (brief « Strates », §6.3.3).
//
//   bun scripts/fonts/build-glyphs.ts [chemin/vers/archivo-sx-black.ttf]
//
// Entrée  : l'INSTANCE STATIQUE « Archivo SemiExpanded Black » (wdth 112,5,
//           wght 900, contours fusionnés). Défaut : build/archivo-sx-black.ttf.
//           Les fichiers .ttf ne sont jamais commités (`build/` est ignoré).
// Sorties : public/studio/glyphs/s3d-relief-v1.json   (chemins des glyphes)
//           public/studio/glyphs/OFL.txt               (licence, à côté du JSON)
//           src/lib/studio/text/glyph-metrics.ts       (table de métriques pour
//             le SSR : chasse, aire, hauteurs ; le JSON, lui, n'entre jamais dans
//             le Worker)
//
// ── Reconstruire l'instance statique ────────────────────────────────────────
// La source est le fichier OFL `Archivo[wdth,wght].ttf` du dépôt Google Fonts
// (github.com/google/fonts, ofl/archivo). L'instance est figée par fonttools ;
// `--remove-overlaps` fusionne les contours qui se chevauchent (sans cela la
// détection des trous par inclusion casse : accents superposés aux lettres) :
//
//   uvx --from "fonttools[pathops]" fonttools varLib.instancer \
//     "Archivo[wdth,wght].ttf" wdth=112.5 wght=900 --remove-overlaps \
//     -o build/archivo-sx-black.ttf
//
// Puis : bun scripts/fonts/build-glyphs.ts
//
// ── Licence (SIL OFL 1.1) ───────────────────────────────────────────────────
// La police dérivée est RENOMMÉE « S3D Relief » (clause de nom réservé) ;
// `OFL.txt` accompagne le JSON. Seuls des contours sont redistribués, jamais le
// fichier de police.
//
// ── Jeu de caractères ───────────────────────────────────────────────────────
// U+0020–007E, U+00A0–00FF, U+0100–017F, plus ’ (U+2019), – (U+2013), — (U+2014).
// Les points de code absents de la police sont listés et écartés (refusés par le
// Studio avec « Caractère non imprimable »).
//
// ── Trait (`stem`) ──────────────────────────────────────────────────────────
// Épaisseur du trait horizontal régulier : le plus mince des bras des E F H L T,
// mesuré sur des verticales de balayage des contours aplatis. Les sommets des
// courbes (z, o : ≈ 20 % de la capitale) sont un peu plus fins ; le seuil
// d'avertissement de 0,8 mm (contre 0,6 mm pour l'erreur) en tient compte.
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import opentype from "opentype.js";
import {
  polygonArea,
  ringPerimeter,
} from "../../src/lib/studio/kernel/extrude";
import {
  GlyphFont,
  flattenPath,
  type GlyphFontData,
} from "../../src/lib/studio/text/glyphs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const input = resolve(
  process.argv[2] ?? join(root, "build", "archivo-sx-black.ttf"),
);
const outDir = join(root, "public", "studio", "glyphs");
const jsonPath = join(outDir, "s3d-relief-v1.json");
const metricsPath = join(
  root,
  "src",
  "lib",
  "studio",
  "text",
  "glyph-metrics.ts",
);
const FAMILY = "S3D Relief";
const MAX_GZIP_BYTES = 45 * 1024;

if (!existsSync(input)) {
  console.error(
    `✗ ${input} est introuvable.\n  Reconstruisez l'instance statique (voir l'en-tête de ce script) ou passez son chemin en argument.`,
  );
  process.exit(1);
}

const RANGES: [number, number][] = [
  [0x20, 0x7e],
  [0xa0, 0xff],
  [0x100, 0x17f],
  [0x2019, 0x2019],
  [0x2013, 0x2014],
];

const buffer = readFileSync(input);
const font = opentype.parse(
  buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
);

const glyphs: GlyphFontData["glyphs"] = {};
const missing: string[] = [];
for (const [from, to] of RANGES) {
  for (let code = from; code <= to; code++) {
    const ch = String.fromCodePoint(code);
    if (!font.charToGlyphIndex(ch)) {
      missing.push(`U+${code.toString(16).toUpperCase().padStart(4, "0")}`);
      continue;
    }
    const glyph = font.charToGlyph(ch);
    const adv = Math.round(glyph.advanceWidth ?? 0);
    const commands = glyph.path.commands;
    // Zéro point : pas de contour (espaces). Les L vers le point courant
    // (doublons de la police) sont retirés : ni aire ni angle.
    let d = "";
    let px = NaN;
    let py = NaN;
    const r = (n: number) => String(Math.round(n));
    for (const c of commands) {
      if (c.type === "M") {
        d += `M${r(c.x)} ${r(c.y)}`;
      } else if (c.type === "L") {
        if (r(c.x) === r(px) && r(c.y) === r(py)) continue;
        d += `L${r(c.x)} ${r(c.y)}`;
      } else if (c.type === "Q") {
        d += `Q${r(c.x1)} ${r(c.y1)} ${r(c.x)} ${r(c.y)}`;
      } else if (c.type === "C") {
        d += `C${r(c.x1)} ${r(c.y1)} ${r(c.x2)} ${r(c.y2)} ${r(c.x)} ${r(c.y)}`;
      } else if (c.type === "Z") {
        d += "Z";
      }
      if (c.type !== "Z") {
        px = c.x;
        py = c.y;
      }
    }
    glyphs[ch] = d ? { adv, d } : { adv };
  }
}

// Hauteur de capitale : le H (la valeur OS/2 arrondit d'une ou deux unités).
const box = font.charToGlyph("H").getBoundingBox();
const capHeight = Math.round(box.y2);

// Trait : balayage vertical des bras de E F H L T.
function verticalRuns(rings: [number, number][][], x: number): number[] {
  const hits: number[] = [];
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i++) {
      const [x0, y0] = ring[i];
      const [x1, y1] = ring[(i + 1) % ring.length];
      if (x0 === x1) continue;
      if (x0 <= x !== x1 <= x) {
        hits.push(y0 + ((x - x0) / (x1 - x0)) * (y1 - y0));
      }
    }
  }
  hits.sort((a, b) => a - b);
  const runs: number[] = [];
  for (let i = 0; i + 1 < hits.length; i += 2) runs.push(hits[i + 1] - hits[i]);
  return runs;
}

function measureStem(): number {
  const probes: [string, number[]][] = [
    ["E", [0.5, 0.65]],
    ["F", [0.5, 0.65]],
    ["H", [0.5]],
    ["L", [0.6, 0.8]],
    ["T", [0.1, 0.9]],
  ];
  let stem = Infinity;
  for (const [ch, fractions] of probes) {
    const rings = flattenPath(glyphs[ch].d ?? "", "fine");
    const xs = rings.flat().map((p) => p[0]);
    const lo = Math.min(...xs);
    const hi = Math.max(...xs);
    for (const f of fractions) {
      for (const run of verticalRuns(rings, lo + (hi - lo) * f)) {
        // Les balayages voient aussi la hauteur des fûts (≥ 0,9 capitale) : ignorés.
        if (run < 0.45 * capHeight) stem = Math.min(stem, run);
      }
    }
  }
  return Math.round(stem);
}

const stem = measureStem();
const data: GlyphFontData = {
  v: 1,
  family: FAMILY,
  unitsPerEm: font.unitsPerEm,
  ascender: font.ascender,
  descender: font.descender,
  capHeight,
  stem,
  glyphs,
};

mkdirSync(outDir, { recursive: true });
const json = JSON.stringify(data);
writeFileSync(jsonPath, json);

// OFL.txt à côté du JSON : copié depuis le dossier de la police s'il y est,
// sinon l'exemplaire déjà commité est conservé.
const oflNext = join(outDir, "OFL.txt");
const oflSource = join(dirname(input), "OFL.txt");
if (existsSync(oflSource)) copyFileSync(oflSource, oflNext);
if (!existsSync(oflNext)) {
  console.error("✗ OFL.txt manque à côté du JSON (licence de la police).");
  process.exit(1);
}

// Table de métriques pour le SSR : chasse, aire (unités² / 100), yMin et yMax.
// Calculée sur les mêmes polylignes que le maillage (détail « fine »).
const parsed = new GlyphFont(data);
const rows: string[] = [];
let ascentMax = 0;
let descentMax = 0;
for (const ch of Object.keys(glyphs)) {
  const polygons = parsed.polygons(ch, "fine");
  let area = 0;
  let perimeter = 0;
  let yMin = 0;
  let yMax = 0;
  for (const polygon of polygons) {
    area += polygonArea(polygon);
    perimeter += ringPerimeter(polygon.outer);
    for (const hole of polygon.holes ?? []) perimeter += ringPerimeter(hole);
    for (const p of polygon.outer) {
      if (p[1] < yMin) yMin = p[1];
      if (p[1] > yMax) yMax = p[1];
    }
  }
  if (ch !== " " && ch !== " ") {
    ascentMax = Math.max(ascentMax, yMax);
    descentMax = Math.max(descentMax, -yMin);
  }
  rows.push(
    `  ${JSON.stringify(ch)}: [${glyphs[ch].adv}, ${Math.round(area / 100)}, ${Math.round(yMin)}, ${Math.round(yMax)}, ${Math.round(perimeter / 10)}],`,
  );
}

const metrics = `// GÉNÉRÉ par scripts/fonts/build-glyphs.ts : ne pas éditer à la main.
// Métriques de la police « ${FAMILY} » (Archivo SemiExpanded Black, SIL OFL 1.1,
// renommée). Table légère pour le SSR : les statistiques et les garde-fous du
// Studio mesurent le texte sans charger les contours (public/studio/glyphs/).
// Un test compare cette table au JSON de glyphes : elles ne peuvent pas dériver.

export const FONT_METRICS = {
  unitsPerEm: ${font.unitsPerEm},
  ascender: ${font.ascender},
  descender: ${font.descender},
  capHeight: ${capHeight},
  /** Trait horizontal régulier (bras des E F H L T), unités de police. */
  stem: ${stem},
  /** Plus haute encre du jeu (accents des capitales compris), unités de police. */
  ascentMax: ${Math.round(ascentMax)},
  /** Plus basse encre du jeu (cédille, ogonek, queues), unités de police, positive. */
  descentMax: ${Math.round(descentMax)},
} as const;

/**
 * Par caractère : [chasse, aire / 100 (unités²), yMin, yMax, périmètre / 10] en
 * unités de police (contours extérieurs et trous aplatis comme le maillage).
 */
export type GlyphMetric = readonly [
  advance: number,
  areaHundreds: number,
  yMin: number,
  yMax: number,
  perimeterTens: number,
];

export const GLYPH_TABLE: Readonly<Record<string, GlyphMetric>> = {
${rows.join("\n")}
};
`;
writeFileSync(metricsPath, metrics);

const gzip = gzipSync(Buffer.from(json), { level: 9 }).length;
console.log(
  `✓ ${Object.keys(glyphs).length} glyphes · JSON ${(json.length / 1024).toFixed(1)} Kio · gzip ${(gzip / 1024).toFixed(1)} Kio (plafond ${MAX_GZIP_BYTES / 1024})`,
);
console.log(
  `  unitsPerEm ${font.unitsPerEm} · capitale ${capHeight} · trait ${stem} (${((100 * stem) / capHeight).toFixed(1)} % de la capitale) · encre ${Math.round(ascentMax)} / −${Math.round(descentMax)}`,
);
if (missing.length > 0) {
  console.log(
    `  absents de la police (${missing.length}) : ${missing.join(" ")}`,
  );
}
if (gzip > MAX_GZIP_BYTES) {
  console.error(`✗ le JSON dépasse ${MAX_GZIP_BYTES / 1024} Kio gzip`);
  process.exit(1);
}
