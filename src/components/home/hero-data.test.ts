import { describe, expect, it } from "vitest";
import {
  HERO_PALETTES,
  HERO_PATTERNS,
  heroVariant,
} from "@/lib/studio/presets";
import { computeStats } from "@/lib/studio/stats";
import { HERO_CONFIG } from "@/lib/studio/presets";
import { encodeConfig } from "@/lib/studio/url-state";
import {
  PALETTE_KEYS,
  PATTERN_KEYS,
  lavauxFragmentValue,
  studioHref,
  variantConfig,
  variantKey,
} from "./hero-data";
import { buildHeroData } from "./hero-data-build";

// Les données du héros doivent rester celles du Studio : les douze variantes,
// leurs chiffres et le lien du bouton rouge. Le module léger (hero-data.ts) ne
// tire ni presets ni url-state dans le JavaScript initial ; ce test l'égale
// aux versions complètes, il ne peut donc pas dériver sans que la CI le dise.
describe("données du héros (accueil)", () => {
  const data = buildHeroData();

  it("liste les mêmes palettes et motifs que les préréglages du Studio", () => {
    expect([...PALETTE_KEYS].sort()).toEqual(Object.keys(HERO_PALETTES).sort());
    expect([...PATTERN_KEYS].sort()).toEqual(Object.keys(HERO_PATTERNS).sort());
  });

  it("reconstitue chacune des douze variantes à l'identique", () => {
    for (const palette of PALETTE_KEYS)
      for (const pattern of PATTERN_KEYS)
        expect(variantConfig(data, palette, pattern)).toEqual(
          heroVariant(palette, pattern),
        );
  });

  it("écrit le même fragment d'URL que le codec du Studio, octet pour octet", () => {
    for (const palette of PALETTE_KEYS)
      for (const pattern of PATTERN_KEYS) {
        const config = heroVariant(palette, pattern);
        expect(lavauxFragmentValue(config)).toBe(encodeConfig(config));
      }
  });

  it("construit un lien du Studio sans aucun texte personnel", () => {
    const href = studioHref(heroVariant("signal", "voronoi"));
    expect(href).toMatch(/^\/studio\/lavaux#c=v1\.[A-Za-z0-9_-]+$/);
  });

  it("tire les chiffres de computeStats, jamais d'une estimation à la main", () => {
    const reference = computeStats(HERO_CONFIG);
    const figures = data.figures[variantKey("leman", "gradins")];
    expect(figures.grams).toBe(reference.grams);
    expect(figures.minutes).toBe(reference.minutes);
    expect(figures.changes).toBe(reference.changes);
    expect(data.layers).toBe(reference.layers);
    expect(data.heightMm).toBe(reference.heightMm);
    // 750 couches et deux changements de filament (brief §5.2, note du 30.09).
    expect(data.layers).toBe(750);
    expect(figures.changes).toBe(2);
  });

  it("décrit les bandes de chaque variante, couche par couche", () => {
    const figures = data.figures[variantKey("leman", "gradins")];
    expect(figures.bands.map((b) => [b.fromLayer, b.toLayer])).toEqual([
      [1, 210],
      [211, 540],
      [541, 750],
    ]);
    const total = figures.bands.reduce((sum, band) => sum + band.grams, 0);
    // Les masses de bande plus la purge font la masse de computeStats.
    expect(total + figures.purgeGrams).toBeCloseTo(figures.grams, 0);
  });

  it("« Uni » n'a qu'une bande : aucun changement, aucune purge", () => {
    const figures = data.figures[variantKey("uni", "vagues")];
    expect(figures.bands).toHaveLength(1);
    expect(figures.changes).toBe(0);
    expect(figures.purgeGrams).toBe(0);
  });
});
