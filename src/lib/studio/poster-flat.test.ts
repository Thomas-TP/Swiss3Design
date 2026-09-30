// Posters « vue de dessus » des objets plats (brief « Strates », §6.12, §7.6,
// §7.7 et fiche WP-02) : calculés par le code, sans JavaScript ni WebGL, dans
// les deux thèmes ; les fichiers statiques du sous-verre par défaut (clair et
// sombre) sont ceux que le générateur produirait aujourd'hui.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { filamentHex } from "./filaments";
import {
  BORNE_DEFAULT,
  BORNE_PRESETS,
  CARTOUCHE_DEFAULT,
  CARTOUCHE_PRESETS,
  RELIEF_DEFAULT,
  RELIEF_PRESETS,
} from "./presets";
import {
  borneTopView,
  cartoucheTopView,
  reliefTopView,
  TOP_VIEW_UNITS_PER_MM,
  topViewToSvg,
  type Theme,
  type TopViewData,
} from "./poster-flat";
import { loadTestFont } from "./testing";
import { DEFAULT_TEXTS } from "./text/fields";
import type { GlyphFont } from "./text/glyphs";
import type { PlacedLine } from "./text/layout";
import { linePolygons } from "./text/shapes";

const THEMES: Theme[] = ["light", "dark"];
let font: GlyphFont;
beforeAll(() => {
  font = loadTestFont();
});

const glyphs = (line: PlacedLine) => linePolygons(line, "display", font);

function expectSvg(data: TopViewData) {
  const svg = topViewToSvg(data);
  expect(svg.startsWith("<svg ")).toBe(true);
  expect(svg.endsWith("</svg>")).toBe(true);
  expect(svg).toContain('aria-hidden="true"');
  expect(svg).toContain('focusable="false"');
  // Décoratif et statique : ni script, ni gestionnaire d'événement, ni image.
  expect(svg).not.toMatch(/<script|onload|onclick|<image|<foreignObject/i);
  const [x, y, w, h] = data.viewBox;
  expect(svg).toContain(`viewBox="${x} ${y} ${w} ${h}"`);
  return svg;
}

describe("posters des objets plats : structure", () => {
  it("Cartouche, Relief, Borne : un viewBox aux dimensions de l'objet (+ 2 mm de cadrage), une plaque, des chemins non vides", () => {
    const U = TOP_VIEW_UNITS_PER_MM;
    const views: [string, TopViewData][] = [
      [
        "cartouche",
        cartoucheTopView(CARTOUCHE_DEFAULT, DEFAULT_TEXTS.cartouche, {
          glyphs,
        }),
      ],
      [
        "relief",
        reliefTopView(RELIEF_DEFAULT, DEFAULT_TEXTS.relief, { glyphs }),
      ],
      ["borne", borneTopView(BORNE_DEFAULT, DEFAULT_TEXTS.borne, { glyphs })],
    ];
    for (const [name, view] of views) {
      expect(view.object).toBe(name);
      expect(view.layers[0].role, `${name}`).toBe("plate");
      const [, , w, h] = view.viewBox;
      expect(w, `${name}`).toBe(Math.round((view.widthMm + 4) * U));
      expect(h, `${name}`).toBe(Math.round((view.depthMm + 4) * U));
      for (const layer of view.layers) {
        expect(layer.d.length, `${name} ${layer.role}`).toBeGreaterThan(10);
        expect(layer.d.startsWith("M"), `${name}`).toBe(true);
        expect(layer.fill).toMatch(/^#[0-9A-F]{6}$/i);
      }
      expectSvg(view);
    }
    const card = views[0][1];
    expect(card.widthMm).toBe(85);
    expect(card.depthMm).toBe(55);
    expect(card.layers.map((l) => l.role)).toEqual(["plate", "ink", "ink"]);
  });

  it("les couleurs sont celles des filaments : plaque, encre, teinte de chaque bande", () => {
    const card = cartoucheTopView(CARTOUCHE_DEFAULT, DEFAULT_TEXTS.cartouche, {
      glyphs,
    });
    expect(card.layers[0].fill).toBe(filamentHex(CARTOUCHE_DEFAULT.plate));
    expect(card.layers.at(-1)!.fill).toBe(filamentHex(CARTOUCHE_DEFAULT.ink));
    const tag = borneTopView(BORNE_DEFAULT, DEFAULT_TEXTS.borne, { glyphs });
    expect(tag.layers[0].fill).toBe(filamentHex(BORNE_DEFAULT.base));
    expect(tag.layers.at(-1)!.fill).toBe(filamentHex(BORNE_DEFAULT.ink));
    const relief = reliefTopView(RELIEF_DEFAULT, undefined, { label: false });
    // Le socle est dans la bande du lac ; les strates suivantes montent en teintes.
    expect(relief.layers[0].fill).toBe(
      filamentHex(RELIEF_DEFAULT.bands[0].filament),
    );
    const fills = new Set(relief.layers.map((l) => l.fill));
    for (const band of RELIEF_DEFAULT.bands) {
      expect(fills.has(filamentHex(band.filament)), `${band.filament}`).toBe(
        true,
      );
    }
  });

  it("deux thèmes : mêmes formes et mêmes remplissages, filets différents (éclaircis en sombre)", () => {
    const light = cartoucheTopView(CARTOUCHE_DEFAULT, DEFAULT_TEXTS.cartouche, {
      glyphs,
      theme: "light",
    });
    const dark = cartoucheTopView(CARTOUCHE_DEFAULT, DEFAULT_TEXTS.cartouche, {
      glyphs,
      theme: "dark",
    });
    expect(dark.viewBox).toEqual(light.viewBox);
    expect(dark.layers.map((l) => l.d)).toEqual(light.layers.map((l) => l.d));
    expect(dark.layers.map((l) => l.fill)).toEqual(
      light.layers.map((l) => l.fill),
    );
    expect(dark.layers[1].stroke).not.toBe(light.layers[1].stroke);
    const luma = (hex: string) => parseInt(hex.slice(1, 3), 16);
    // Encre noire : filet plus clair qu'elle en sombre, plus foncé ou égal en clair.
    expect(luma(dark.layers[1].stroke)).toBeGreaterThan(
      luma(dark.layers[1].fill),
    );
    expect(luma(light.layers[1].stroke)).toBeLessThanOrEqual(
      luma(light.layers[1].fill),
    );
  });

  it("déterministe : même entrée, même chaîne SVG (SSR et client)", () => {
    for (const theme of THEMES) {
      const a = topViewToSvg(
        reliefTopView(RELIEF_DEFAULT, DEFAULT_TEXTS.relief, { theme, glyphs }),
      );
      const b = topViewToSvg(
        reliefTopView(
          structuredClone(RELIEF_DEFAULT),
          { peak: "Léa" },
          { theme, glyphs },
        ),
      );
      expect(a).toBe(b);
    }
  });
});

describe("posters sans police (SSR : les contours des glyphes ne sont pas dans le Worker)", () => {
  it("le texte est tracé par des barres aux dimensions du texte, en calque « placeholder »", () => {
    const card = cartoucheTopView(CARTOUCHE_DEFAULT, DEFAULT_TEXTS.cartouche);
    expect(card.layers.map((l) => l.role)).toEqual([
      "plate",
      "ink",
      "placeholder",
    ]);
    const bars = card.layers[2];
    expect(bars.opacity).toBeLessThan(1);
    // Quatre lignes de texte : quatre barres (sous-chemins fermés).
    expect(bars.d.match(/z/g)).toHaveLength(4);
    const tag = borneTopView(BORNE_DEFAULT, DEFAULT_TEXTS.borne);
    expect(tag.layers.at(-1)!.role).toBe("placeholder");
    expect(tag.layers.at(-1)!.d.match(/z/g)).toHaveLength(1);
  });

  it("un poster sans police reste léger : moins de 6 Ko pour une carte, 4 Ko pour un porte-nom", () => {
    const card = topViewToSvg(
      cartoucheTopView(CARTOUCHE_DEFAULT, DEFAULT_TEXTS.cartouche),
    );
    const tag = topViewToSvg(borneTopView(BORNE_DEFAULT, DEFAULT_TEXTS.borne));
    console.log(
      `[poster] sans police : carte ${card.length} o, porte-nom ${tag.length} o`,
    );
    expect(card.length).toBeLessThan(6 * 1024);
    expect(tag.length).toBeLessThan(4 * 1024);
  });

  it("aucun texte saisi : plaque seule (et formes d'encre de la mise en page)", () => {
    const empty = cartoucheTopView(
      { ...CARTOUCHE_DEFAULT, layout: "centree" },
      {},
    );
    expect(empty.layers.map((l) => l.role)).toEqual(["plate"]);
    const withDisc = cartoucheTopView(CARTOUCHE_DEFAULT, {});
    expect(withDisc.layers.map((l) => l.role)).toEqual(["plate", "ink"]);
  });
});

describe("posters avec glyphes", () => {
  it("les vrais contours remplacent les barres ; poids raisonnable", () => {
    const card = cartoucheTopView(CARTOUCHE_DEFAULT, DEFAULT_TEXTS.cartouche, {
      glyphs,
    });
    expect(card.layers.map((l) => l.role)).toEqual(["plate", "ink", "ink"]);
    const svg = topViewToSvg(card);
    console.log(`[poster] avec glyphes : carte ${svg.length} o`);
    expect(svg.length).toBeLessThan(20 * 1024);
  });

  it("chaque préréglage a un poster valide, dans les deux thèmes", () => {
    for (const theme of THEMES) {
      for (const { config } of CARTOUCHE_PRESETS) {
        expectSvg(
          cartoucheTopView(config, DEFAULT_TEXTS.cartouche, { theme, glyphs }),
        );
      }
      for (const { config } of BORNE_PRESETS) {
        expectSvg(borneTopView(config, DEFAULT_TEXTS.borne, { theme, glyphs }));
      }
      for (const { config } of RELIEF_PRESETS) {
        const view = reliefTopView(config, DEFAULT_TEXTS.relief, {
          theme,
          glyphs,
        });
        expectSvg(view);
        // Socle + une strate par niveau (toutes existent) + l'étiquette.
        expect(view.layers.length).toBe(1 + config.levels + 1);
      }
    }
  });

  it("un texte hostile (accents, cédilles) reste dans le cadrage du poster", () => {
    const view = cartoucheTopView(
      CARTOUCHE_DEFAULT,
      {
        name: "Çgpqy Åsa",
        role: "ÅÉÈÊÎÔÛÜ Ï",
        line1: "Ģķ ÇÇ gypj",
        line2: "ÉÅÜ Ģ gyp",
      },
      { glyphs },
    );
    const [x0, y0, w, h] = view.viewBox;
    const bounds = pathBounds(view.layers[view.layers.length - 1].d);
    expect(bounds.minX).toBeGreaterThanOrEqual(x0);
    expect(bounds.maxX).toBeLessThanOrEqual(x0 + w);
    expect(bounds.minY).toBeGreaterThanOrEqual(y0);
    expect(bounds.maxY).toBeLessThanOrEqual(y0 + h);
  });
});

/** Boîte d'un chemin « M x y l dx dy … z » en coordonnées relatives entières. */
function pathBounds(d: string) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const sub of d.split("M").filter(Boolean)) {
    const [head, rest] = sub.split("l");
    const [sx, sy] = head.trim().split(/\s+/).map(Number);
    let x = sx;
    let y = sy;
    const visit = () => {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    };
    visit();
    const nums = (rest ?? "")
      .replace(/z$/, "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map(Number);
    for (let i = 0; i + 1 < nums.length; i += 2) {
      x += nums[i];
      y += nums[i + 1];
      visit();
    }
  }
  return { minX, maxX, minY, maxY };
}

describe("sous-verre par défaut : fichiers statiques clair et sombre", () => {
  const dir = fileURLToPath(
    new URL("../../../public/posters/", import.meta.url),
  );

  for (const theme of THEMES) {
    it(`relief-default-${theme}.svg est celui que le code produit (graine 1291, sans étiquette)`, () => {
      const file = readFileSync(`${dir}relief-default-${theme}.svg`, "utf8");
      const svg = topViewToSvg(
        reliefTopView(RELIEF_DEFAULT, undefined, { theme, label: false }),
        { className: "s3d-relief-poster" },
      );
      expect(file).toBe(svg);
      expect(file.length).toBeLessThan(40 * 1024);
      expect(file).toContain('class="s3d-relief-poster"');
      // La zone plate de l'étiquette reste libre : aucune ligne « ink » ni « placeholder ».
      expect(file).not.toContain('fill-opacity="0.85"');
    });
  }

  it("les fichiers clair et sombre ne diffèrent que par leurs filets", () => {
    const light = readFileSync(`${dir}relief-default-light.svg`, "utf8");
    const dark = readFileSync(`${dir}relief-default-dark.svg`, "utf8");
    expect(light).not.toBe(dark);
    const strip = (s: string) =>
      s.replace(/stroke="#[0-9A-F]{6}"/gi, 'stroke=""');
    expect(strip(light)).toBe(strip(dark));
  });
});
