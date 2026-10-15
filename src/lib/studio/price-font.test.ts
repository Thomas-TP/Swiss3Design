import { readFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { exportStl } from "./build";
import { PRICE_LOCALE } from "./price";
import { studioPrice } from "./price-figures";
import { DEFAULT_CONFIGS, PRESETS } from "./presets";
import {
  surpriseBorne,
  surpriseCartouche,
  surpriseLavaux,
  surpriseMontagne,
} from "./presets";
import { clampConfig } from "./ranges";
import { computeStats } from "./stats";
import { DEFAULT_TEXTS } from "./text/fields";
import { getGlyphFont, parseGlyphFont, setGlyphFont } from "./text/glyphs";
import type { StudioConfig, StudioObjectId, StudioTexts } from "./types";

// INVARIANT CRITIQUE de l'achat direct : le prix ne dépend PAS du chargement de
// la police de glyphes complète (public/studio/glyphs/…json), que le serveur ne
// charge jamais (il n'a que `glyph-metrics.ts`). Le navigateur, lui, la charge
// avant d'afficher un texte. Si `computeStats` en dépendait, un même panier
// n'aurait pas le même prix des deux côtés.

const JSON_PATH = new URL(
  "../../../public/studio/glyphs/s3d-relief-v1.json",
  import.meta.url,
);

const OBJECTS: StudioObjectId[] = ["lavaux", "cartouche", "montagne", "borne"];

const TEXTS: Record<StudioObjectId, StudioTexts[]> = {
  lavaux: [{}],
  cartouche: [
    DEFAULT_TEXTS.cartouche,
    {
      name: "Élodie Müller-Zürcher",
      role: "Ingénieure ETH",
      line1: "élodie@exemple.ch",
      line2: "+41 79 123 45 67",
    },
    { name: "A" },
    {
      name: "WWWWWWWWWWWWWWWWWWWWWWWW",
      role: "MMMMMMMMMMMMMMMMMMMMMMMMMMMMMM",
    },
    { name: "Çédille ŒÆ ß?", role: "—’–", line1: "i l j", line2: "@#%&" },
    {},
  ],
  montagne: [
    DEFAULT_TEXTS.montagne,
    { peak: "Cervin" },
    { peak: "Mont-Blanc de Cheilon" },
    { peak: "Piz Bernina" },
    { peak: "" },
  ],
  borne: [
    DEFAULT_TEXTS.borne,
    { text: "Jean-Claude" },
    { text: "WWWWWWWWWWWWWW" },
    { text: "iiiiiiiiiiiiii" },
    { text: "Ça va ?" },
  ],
};

function configs(object: StudioObjectId): StudioConfig[] {
  const out: StudioConfig[] = [DEFAULT_CONFIGS[object]];
  for (const preset of PRESETS[object] as readonly { config?: StudioConfig }[])
    if (preset.config) out.push(preset.config);
  const surprise = {
    lavaux: surpriseLavaux,
    cartouche: surpriseCartouche,
    montagne: surpriseMontagne,
    borne: surpriseBorne,
  }[object];
  for (let seed = 1; seed <= 12; seed++) out.push(surprise(seed * 7919));
  return out.map((c) => clampConfig(c));
}

function matrix() {
  const rows: { key: string; json: string; price: number }[] = [];
  for (const object of OBJECTS)
    for (const config of configs(object))
      for (const texts of TEXTS[object])
        for (const locale of ["fr", "de", "it", "en"] as const) {
          const stats = computeStats(config, texts, undefined, locale);
          const { unitCents } = studioPrice(config, texts, 1, {
            locale,
            stats,
          });
          rows.push({
            key: `${object}|${JSON.stringify(texts)}|${locale}`,
            json: JSON.stringify(stats),
            price: unitCents,
          });
        }
  return rows;
}

describe("le prix ne dépend pas de la police de glyphes complète", () => {
  afterAll(() => setGlyphFont(null));

  it("computeStats est identique sans police, avec la vraie police et après un export STL", () => {
    // Aucune police chargée : l'état du Worker serveur.
    setGlyphFont(null);
    expect(getGlyphFont()).toBeNull();
    const without = matrix();
    expect(without.length).toBeGreaterThan(500);

    // La vraie police, comme `loadGlyphFont(GLYPH_URL)` la charge dans le navigateur.
    const font = parseGlyphFont(JSON.parse(readFileSync(JSON_PATH, "utf8")));
    setGlyphFont(font);
    expect(getGlyphFont()).not.toBeNull();
    const withFont = matrix();

    // Et après qu'un maillage a utilisé les contours.
    exportStl(DEFAULT_CONFIGS.cartouche, DEFAULT_TEXTS.cartouche);
    const afterExport = matrix();

    const different = without.filter(
      (row, i) =>
        row.json !== withFont[i].json ||
        row.json !== afterExport[i].json ||
        row.price !== withFont[i].price ||
        row.price !== afterExport[i].price,
    );
    expect(different.map((row) => row.key)).toEqual([]);
  });

  it("le prix de départ est le même sans et avec la police", () => {
    const price = (object: StudioObjectId, q: number) =>
      studioPrice(DEFAULT_CONFIGS[object], DEFAULT_TEXTS[object], q).unitCents;
    setGlyphFont(null);
    const before = OBJECTS.map((o) => [price(o, 1), price(o, 10)]);
    setGlyphFont(parseGlyphFont(JSON.parse(readFileSync(JSON_PATH, "utf8"))));
    const after = OBJECTS.map((o) => [price(o, 1), price(o, 10)]);
    expect(after).toEqual(before);
    expect(before).toEqual([
      [4490, 3130],
      [1790, 490],
      [4990, 3550],
      [2490, 1500],
    ]);
  });

  it("les chiffres du prix se calculent en langue canonique", () => {
    expect(PRICE_LOCALE).toBe("fr");
  });
});
