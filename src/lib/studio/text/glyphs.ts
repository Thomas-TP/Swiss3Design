// Chaîne de glyphes du texte en relief (brief « Strates », §6.3.3, WP-02) :
// JSON maison `public/studio/glyphs/s3d-relief-v1.json` → chemins → polylignes
// → polygones avec trous (contours classés par inclusion). Pur TypeScript, sans
// three : lu par le Worker du Studio, le client et les tests Node.
//
// Le JSON n'est JAMAIS importé par un module serveur (règle d'or 10) : le
// client ou le Worker le récupère par `fetch` (`GLYPH_URL`), puis l'enregistre
// avec `setGlyphFont`. Côté serveur, les statistiques et les garde-fous ne
// lisent que la petite table de métriques générée (`glyph-metrics.ts`).
//
// Format : `{ v: 1, family, unitsPerEm, ascender, descender, capHeight, stem,
// glyphs: { "A": { adv, d: "M…L…Q…C…Z" } } }`, unités de police, Y vers le
// haut, contours fusionnés (les trous se détectent donc par simple inclusion).
import { classifyRings, type Polygon } from "../kernel/extrude";
import type { Vec2 } from "../kernel/simplify";

/** Emplacement du fichier de glyphes dans `public/` (servi en same-origin, CSP `connect-src 'self'`). */
export const GLYPH_URL = "/studio/glyphs/s3d-relief-v1.json";

export interface GlyphRecord {
  /** Chasse (unités de police). */
  adv: number;
  /** Contours `M…L…Q…C…Z` ; absent pour l'espace. */
  d?: string;
}

export interface GlyphFontData {
  v: 1;
  family: string;
  unitsPerEm: number;
  ascender: number;
  descender: number;
  capHeight: number;
  /** Trait horizontal régulier (unités de police) : bras des E F H L T. */
  stem: number;
  glyphs: Record<string, GlyphRecord>;
}

/** Précision de l'aplatissement des courbes (brief : quadratiques ≤ 6 segments, cubiques ≤ 8). */
export type GlyphDetail = "coarse" | "fine";

const DETAIL: Record<
  GlyphDetail,
  { quadMax: number; cubicMax: number; step: number }
> = {
  // Glissé (LOD drag) : assez pour une lettre lisible, deux fois moins de points.
  coarse: { quadMax: 3, cubicMax: 4, step: 110 },
  // Affichage et export : 6 segments par quadratique, 8 par cubique au plus.
  fine: { quadMax: 6, cubicMax: 8, step: 60 },
};

type Command = { cmd: string; args: number[] };

const ARITY: Record<string, number> = { M: 2, L: 2, Q: 4, C: 6, Z: 0 };

/** Découpe `M369-12L369-12Q270-12 195 19…` en commandes (absolues ; M, L, Q, C, Z). */
export function parsePathData(d: string): Command[] {
  // Commandes absolues seulement : une commande relative ou un H/V/A serait
  // lu de travers, donc refusé d'emblée.
  if (!/^[MLQCZ0-9e.,\s-]*$/.test(d)) {
    throw new Error(
      "glyphe : seules les commandes absolues M L Q C Z existent",
    );
  }
  const out: Command[] = [];
  const re = /([MLQCZ])|(-?\d*\.?\d+(?:e-?\d+)?)/g;
  let current: Command | null = null;
  let match: RegExpExecArray | null;
  while ((match = re.exec(d)) !== null) {
    if (match[1]) {
      const cmd = match[1].toUpperCase();
      current = { cmd, args: [] };
      out.push(current);
    } else if (current) {
      const arity = ARITY[current.cmd];
      if (arity === 0) throw new Error("glyphe : nombre après Z");
      if (current.args.length === arity) {
        // Arguments répétés (« L 1 2 3 4 » = deux L) : nouvelle commande de même type.
        current = { cmd: current.cmd === "M" ? "L" : current.cmd, args: [] };
        out.push(current);
      }
      current.args.push(Number(match[2]));
    }
  }
  for (const c of out) {
    if (c.args.length !== ARITY[c.cmd]) {
      throw new Error(`glyphe : commande ${c.cmd} incomplète`);
    }
  }
  return out;
}

function segments(length: number, max: number, step: number): number {
  return Math.min(max, Math.max(2, Math.ceil(length / step)));
}

/**
 * Chemin → contours fermés (polylignes, unités de police, Y vers le haut).
 * Courbes aplaties en un nombre de segments proportionnel à leur longueur
 * (au moins 2, au plus 6 pour une quadratique et 8 pour une cubique).
 */
export function flattenPath(d: string, detail: GlyphDetail = "fine"): Vec2[][] {
  const { quadMax, cubicMax, step } = DETAIL[detail];
  const rings: Vec2[][] = [];
  let ring: Vec2[] = [];
  let x = 0;
  let y = 0;
  const close = () => {
    if (ring.length >= 3) rings.push(ring);
    ring = [];
  };
  for (const { cmd, args } of parsePathData(d)) {
    if (cmd === "M") {
      close();
      x = args[0];
      y = args[1];
      ring = [[x, y]];
    } else if (cmd === "L") {
      x = args[0];
      y = args[1];
      ring.push([x, y]);
    } else if (cmd === "Q") {
      const [cx, cy, ex, ey] = args;
      const n = segments(
        Math.hypot(cx - x, cy - y) + Math.hypot(ex - cx, ey - cy),
        quadMax,
        step,
      );
      for (let k = 1; k <= n; k++) {
        const t = k / n;
        const u = 1 - t;
        ring.push([
          u * u * x + 2 * u * t * cx + t * t * ex,
          u * u * y + 2 * u * t * cy + t * t * ey,
        ]);
      }
      x = ex;
      y = ey;
    } else if (cmd === "C") {
      const [c1x, c1y, c2x, c2y, ex, ey] = args;
      const n = segments(
        Math.hypot(c1x - x, c1y - y) +
          Math.hypot(c2x - c1x, c2y - c1y) +
          Math.hypot(ex - c2x, ey - c2y),
        cubicMax,
        step,
      );
      for (let k = 1; k <= n; k++) {
        const t = k / n;
        const u = 1 - t;
        ring.push([
          u * u * u * x +
            3 * u * u * t * c1x +
            3 * u * t * t * c2x +
            t * t * t * ex,
          u * u * u * y +
            3 * u * u * t * c1y +
            3 * u * t * t * c2y +
            t * t * t * ey,
        ]);
      }
      x = ex;
      y = ey;
    } else {
      close();
    }
  }
  close();
  return rings;
}

export class GlyphFont {
  readonly data: GlyphFontData;
  private readonly cache = new Map<string, Polygon[]>();

  constructor(data: GlyphFontData) {
    this.data = data;
  }

  get unitsPerEm(): number {
    return this.data.unitsPerEm;
  }

  get capHeight(): number {
    return this.data.capHeight;
  }

  get stem(): number {
    return this.data.stem;
  }

  has(ch: string): boolean {
    return Object.hasOwn(this.data.glyphs, ch);
  }

  /** Chasse d'un caractère (unités de police) ; 0 s'il est hors du jeu. */
  advance(ch: string): number {
    return this.data.glyphs[ch]?.adv ?? 0;
  }

  /**
   * Polygones d'un caractère (unités de police, Y vers le haut) : contours
   * classés par inclusion (trous des « o », « a », « e », îlots des « ® »).
   * Mémoïsés : le même tableau est rendu à chaque appel, à ne pas modifier.
   */
  polygons(ch: string, detail: GlyphDetail = "fine"): Polygon[] {
    const key = `${detail}|${ch}`;
    let polygons = this.cache.get(key);
    if (!polygons) {
      const d = this.data.glyphs[ch]?.d;
      polygons = d ? classifyRings(flattenPath(d, detail)) : [];
      this.cache.set(key, polygons);
    }
    return polygons;
  }
}

/** Valide et enveloppe le JSON de glyphes ; lève une erreur lisible si le format n'est pas `v: 1`. */
export function parseGlyphFont(json: unknown): GlyphFont {
  const data = json as Partial<GlyphFontData> | null;
  if (
    !data ||
    typeof data !== "object" ||
    data.v !== 1 ||
    typeof data.unitsPerEm !== "number" ||
    typeof data.capHeight !== "number" ||
    typeof data.stem !== "number" ||
    typeof data.glyphs !== "object" ||
    data.glyphs === null
  ) {
    throw new Error("glyphes : format s3d-relief-v1 attendu");
  }
  return new GlyphFont(data as GlyphFontData);
}

// ── Police enregistrée (Worker du Studio, client, tests) ─────────────────────

let current: GlyphFont | null = null;

/** Enregistre (ou retire) la police des glyphes ; le Worker l'appelle après `loadGlyphFont`. */
export function setGlyphFont(font: GlyphFont | null): void {
  current = font;
}

export function getGlyphFont(): GlyphFont | null {
  return current;
}

/** Erreur des générateurs : le texte est demandé avant le chargement des glyphes. */
export class GlyphsNotLoadedError extends Error {
  constructor() {
    super("glyphes non chargés : appelez loadGlyphFont / setGlyphFont d'abord");
    this.name = "GlyphsNotLoadedError";
  }
}

/** Police enregistrée, ou erreur typée si le texte est demandé avant le chargement. */
export function requireGlyphFont(font?: GlyphFont | null): GlyphFont {
  const f = font ?? current;
  if (!f) throw new GlyphsNotLoadedError();
  return f;
}

/** Charge le JSON de glyphes (`fetch` same-origin) et l'enregistre. */
export async function loadGlyphFont(
  url: string = GLYPH_URL,
  fetchImpl: typeof fetch = fetch,
): Promise<GlyphFont> {
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error(`glyphes : HTTP ${response.status}`);
  const font = parseGlyphFont(await response.json());
  setGlyphFont(font);
  return font;
}
