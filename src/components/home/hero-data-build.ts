// Construit les données du héros (hero-data.ts) sur le serveur : chaque chiffre
// affiché par l'accueil sort de `computeStats` et de `bandStats`, les mêmes
// fonctions pures que le Studio (brief §5.2, note du 30.09.2026 : « WP-HOME lit
// computeStats(HERO_CONFIG) et ne recopie jamais ces valeurs en dur »). Seul
// fichier de l'accueil qui importe presets, stats et band-stats : il n'est lu
// que par page.tsx (Worker), jamais par un composant client.
//
// Douze variantes × (statistiques + bandes) ≈ 25 ms la première fois, puis le
// résultat est gardé dans le module : il ne dépend ni de la langue ni de la
// requête.
import { bandStats } from "@/lib/studio/band-stats";
import { HERO_CONFIG, HERO_PATTERNS, heroVariant } from "@/lib/studio/presets";
import { computeStats } from "@/lib/studio/stats";
import {
  PALETTE_KEYS,
  PATTERN_KEYS,
  variantKey,
  type HeroData,
  type VariantFigures,
} from "./hero-data";

let cached: HeroData | null = null;

export function buildHeroData(): HeroData {
  if (cached) return cached;
  const figures: Record<string, VariantFigures> = {};
  for (const palette of PALETTE_KEYS) {
    for (const pattern of PATTERN_KEYS) {
      const config = heroVariant(palette, pattern);
      const stats = computeStats(config);
      const summary = bandStats(config);
      figures[variantKey(palette, pattern)] = {
        grams: stats.grams,
        minutes: stats.minutes,
        changes: stats.changes,
        purgeGrams: stats.purgeGrams,
        extraMinutes: summary.extraMinutes,
        bands: summary.bands.map((band) => ({
          filament: band.filament,
          fromLayer: band.fromLayer,
          toLayer: band.toLayer,
          fromMm: band.fromMm,
          toMm: band.toMm,
          grams: band.grams,
        })),
      };
    }
  }
  const reference = computeStats(HERO_CONFIG);
  cached = {
    base: {
      h: HERO_CONFIG.h,
      d: HERO_CONFIG.d,
      profile: HERO_CONFIG.profile,
      belly: HERO_CONFIG.belly,
      neck: HERO_CONFIG.neck,
      lip: HERO_CONFIG.lip,
      wall: HERO_CONFIG.wall,
    },
    patterns: Object.fromEntries(
      PATTERN_KEYS.map((key) => [key, { ...HERO_PATTERNS[key] }]),
    ) as HeroData["patterns"],
    palettes: Object.fromEntries(
      PALETTE_KEYS.map((key) => [
        key,
        heroVariant(key, "gradins").bands.map((band) => ({ ...band })),
      ]),
    ) as HeroData["palettes"],
    figures,
    layers: reference.layers,
    heightMm: reference.heightMm,
    widthMm: reference.widthMm,
  };
  return cached;
}
