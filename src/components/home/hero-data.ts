// Données du héros, côté léger (brief « Strates », §5.2, §5.6, §7.5) : les
// douze variantes (palette × motif) du vase « Lavaux » de l'accueil, leurs
// chiffres et l'assemblage de leur configuration. Ce module n'importe rien de
// lourd : il est lu par les composants client de l'accueil (contrôles,
// télémétrie, chapitre 01), donc par le JavaScript initial de la page. Les
// chiffres sortent du serveur (hero-data-build.ts : `computeStats`, `bandStats`,
// jamais recopiés à la main) et traversent la frontière serveur/client en
// props ; le client n'en calcule aucun.
import type {
  Band,
  FilamentId,
  LavauxConfig,
  LavauxPattern,
} from "@/lib/studio/types";

// Mêmes clés que HERO_PALETTES et HERO_PATTERNS (src/lib/studio/presets.ts) ;
// redites ici pour ne pas tirer presets.ts (gardes, relief, d3-contour) dans le
// JavaScript initial. Un test (hero-data.test.ts) les compare.
export type HeroPaletteKey = "leman" | "molasse" | "signal" | "uni";
export type HeroPatternKey = "gradins" | "vagues" | "voronoi";

export const PALETTE_KEYS: readonly HeroPaletteKey[] = [
  "leman",
  "molasse",
  "signal",
  "uni",
];
export const PATTERN_KEYS: readonly HeroPatternKey[] = [
  "gradins",
  "vagues",
  "voronoi",
];

export const DEFAULT_PALETTE: HeroPaletteKey = "leman";
export const DEFAULT_PATTERN: HeroPatternKey = "gradins";

/** Chiffres d'une bande de couleur (chapitre 01, étiquettes de l'éclaté). */
export interface BandFigures {
  filament: FilamentId;
  /** Couches numérotées depuis 1 : « couches 211–540 ». */
  fromLayer: number;
  toLayer: number;
  fromMm: number;
  toMm: number;
  /** Masse de la bande seule, sans la purge. */
  grams: number;
}

/** Chiffres d'une variante : ceux de `computeStats` et de `bandStats`. */
export interface VariantFigures {
  grams: number;
  minutes: number;
  changes: number;
  purgeGrams: number;
  /** Temps ajouté par les changements de filament (minutes). */
  extraMinutes: number;
  bands: BandFigures[];
}

export interface HeroData {
  /** Géométrie commune aux douze variantes (HERO_CONFIG sans motif ni bandes). */
  base: Pick<
    LavauxConfig,
    "h" | "d" | "profile" | "belly" | "neck" | "lip" | "wall"
  >;
  patterns: Record<HeroPatternKey, LavauxPattern>;
  /** Bandes de chaque palette, du bas vers le haut (une seule pour « Uni »). */
  palettes: Record<HeroPaletteKey, Band[]>;
  /** Clé `variantKey(palette, pattern)`. */
  figures: Record<string, VariantFigures>;
  /** Couches du vase (ceil(h / 0,2)) et dimensions de l'objet, mm. */
  layers: number;
  heightMm: number;
  widthMm: number;
}

export const variantKey = (palette: HeroPaletteKey, pattern: HeroPatternKey) =>
  `${palette}.${pattern}`;

/** Configuration complète d'une variante : les props de la scène `print-hero`. */
export function variantConfig(
  data: HeroData,
  palette: HeroPaletteKey,
  pattern: HeroPatternKey,
): LavauxConfig {
  return {
    object: "lavaux",
    ...data.base,
    pattern: data.patterns[pattern],
    bands: data.palettes[palette],
  };
}

// ── Fragment d'URL du Studio (#c=v1.…) ───────────────────────────────────────
//
// Le CTA rouge du héros « suit la configuration » (§5.6) : il ouvre le Studio
// sur le vase qu'on vient de régler. Le codec du Studio (url-state.ts) tire zod
// et les schémas : trop lourd pour le JavaScript initial. Celui-ci écrit la
// même forme (clés courtes du §6.2, même ordre, base64url) pour un vase
// seulement ; un test l'égale octet pour octet à `encodeConfig` sur les douze
// variantes, donc il ne peut pas dériver sans que la CI le dise. Aucun texte
// personnel n'entre jamais dans ce fragment.

function patternShort(pattern: LavauxPattern): Record<string, unknown> {
  switch (pattern.kind) {
    case "lisse":
      return { m: "lisse" };
    case "gradins":
      return { m: "gradins", gs: pattern.step, gd: pattern.depth };
    case "vagues":
      return {
        m: "vagues",
        wl: pattern.wavelength,
        wa: pattern.amplitude,
        wk: pattern.lobes,
      };
    case "voronoi":
      return {
        m: "voronoi",
        vc: pattern.cells,
        va: pattern.relief,
        vs: pattern.seed,
      };
    case "nervures":
      return {
        m: "nervures",
        rn: pattern.count,
        ra: pattern.depth,
        rt: pattern.twistDeg,
      };
  }
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Valeur du paramètre `c` du fragment (`v1.<base64url>`) d'une configuration de vase. */
export function lavauxFragmentValue(config: LavauxConfig): string {
  const short = {
    h: config.h,
    d: config.d,
    p: config.profile,
    b: config.belly,
    n: config.neck,
    l: config.lip,
    ...patternShort(config.pattern),
    w: config.wall,
    bd: config.bands.map((band) => [band.filament, band.toMm]),
  };
  return `v1.${toBase64Url(JSON.stringify(short))}`;
}

/** Lien du Studio pour une variante : `/studio/lavaux#c=v1.…`. */
export function studioHref(config: LavauxConfig): string {
  return `/studio/lavaux#c=${lavauxFragmentValue(config)}`;
}
