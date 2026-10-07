// Construit les données de l'accueil à partir des bibliothèques du Studio
// (brief « Strates », §5.2 note du 30.09, §5.7, §7.5) : chaque chiffre affiché
// sort de `computeStats` et de `bandStats`, les fonctions pures du Studio, et
// chaque poster de `poster.ts` / `poster-flat.ts` ; rien n'est écrit à la main.
//
// Ce module n'est PAS lu par la page : il tire presets, statistiques, gardes,
// générateurs, d3-contour et métriques de glyphes (≈ 100 Kio gzip dans le Worker,
// pour des données qui ne changent qu'avec le code). Il sert au script
// `generate-home-data.ts`, qui écrit `home-data.generated.ts` (l'unique module de
// données que la page importe), et au test qui prouve que ce fichier est à jour :
// un préréglage, un coefficient ou un texte d'exemple qui bouge fait échouer la
// CI jusqu'à la régénération (`bun src/components/home/generate-home-data.ts`).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { bandStats } from "@/lib/studio/band-stats";
import {
  borneTopView,
  cartoucheTopView,
  topViewToSvg,
} from "@/lib/studio/poster-flat";
import { heroPoster } from "@/lib/studio/poster";
import { peakLabel } from "@/lib/studio/objects/relief-model";
import {
  BORNE_DEFAULT,
  CARTOUCHE_DEFAULT,
  DEFAULT_CONFIGS,
  HERO_CONFIG,
  HERO_PATTERNS,
  RELIEF_DEFAULT,
  heroVariant,
} from "@/lib/studio/presets";
import { computeStats } from "@/lib/studio/stats";
import { configFragment } from "@/lib/studio/url-state";
import type { StudioObjectId, StudioTexts } from "@/lib/studio/types";
import {
  PALETTE_KEYS,
  PATTERN_KEYS,
  variantKey,
  type HeroData,
  type VariantFigures,
} from "./hero-data";
import type {
  HomeData,
  HomeLocale,
  ObjectCard,
  ObjectPoster,
} from "./home-data-types";

const LOCALES: readonly HomeLocale[] = ["fr", "de", "it", "en"];
const OBJECTS: readonly StudioObjectId[] = [
  "lavaux",
  "cartouche",
  "relief",
  "borne",
];

export function buildHeroData(): HeroData {
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
  return {
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
}

/** Textes d'exemple d'une langue (`studioCore.examples`), tels que la page les affiche. */
function examplesOf(locale: HomeLocale): StudioTexts {
  const file = join(process.cwd(), "messages", locale, "studioCore.json");
  const { examples } = JSON.parse(readFileSync(file, "utf8")) as {
    examples: Required<StudioTexts>;
  };
  return {
    name: examples.name,
    role: examples.role,
    line1: examples.line1,
    line2: examples.line2,
    peak: examples.peak,
    text: examples.text,
  };
}

function figuresOf(stats: ReturnType<typeof computeStats>) {
  return {
    widthMm: stats.widthMm,
    depthMm: stats.depthMm,
    heightMm: stats.heightMm,
    grams: stats.grams,
    minutes: stats.minutes,
    changes: stats.changes,
  };
}

export function buildHomeData(): HomeData {
  const french = examplesOf("fr");
  // Les affiches de la Cartouche et du Porte-nom tracent le texte par des barres
  // de la longueur exacte des lignes : décoratives, calculées avec les textes
  // français pour les quatre langues (les chiffres, eux, suivent chaque langue).
  const flat = (id: "cartouche" | "borne"): ObjectPoster => ({
    kind: "svg",
    svg: topViewToSvg(
      id === "cartouche"
        ? cartoucheTopView(CARTOUCHE_DEFAULT, french)
        : borneTopView(BORNE_DEFAULT, french),
      { className: "h-full w-full" },
    ),
  });
  const posters: Record<StudioObjectId, ObjectPoster> = {
    lavaux: { kind: "hero" },
    cartouche: flat("cartouche"),
    relief: { kind: "relief" },
    borne: flat("borne"),
  };

  const summit = {} as HomeData["summit"];
  const objects = {} as HomeData["objects"];
  for (const locale of LOCALES) {
    const texts = examplesOf(locale);
    summit[locale] = {
      label: peakLabel(texts.peak ?? "", locale),
      stats: figuresOf(
        computeStats(RELIEF_DEFAULT, { peak: texts.peak }, undefined, locale),
      ),
    };
    objects[locale] = {} as Record<StudioObjectId, ObjectCard>;
    for (const id of OBJECTS) {
      const stats = computeStats(DEFAULT_CONFIGS[id], texts, undefined, locale);
      objects[locale][id] = {
        stats: figuresOf(stats),
        estimate: stats.estimate ?? null,
        poster: posters[id],
      };
    }
  }

  return {
    hero: buildHeroData(),
    posters: {
      plate: heroPoster(HERO_CONFIG, "plate"),
      final: heroPoster(HERO_CONFIG, "final"),
      exploded: heroPoster(HERO_CONFIG, "exploded"),
    },
    summit,
    reliefConfig: RELIEF_DEFAULT,
    reliefHref: `/studio/relief${configFragment(RELIEF_DEFAULT)}`,
    objects,
  };
}
