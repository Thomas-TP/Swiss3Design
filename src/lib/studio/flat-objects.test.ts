// Objets plats (brief « Strates », §6.3.4, §6.5, §6.6 et fiche WP-02) :
// Cartouche, Relief, Borne : mises en page, gravure sans chevauchement,
// statistiques, garde-fous, préréglages, étiquette du sommet, export STL,
// budgets de temps. Les maillages sont vérifiés dans manifold.test.ts.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { bandStats, bandStatsFor } from "./band-stats";
import { buildStudioMesh, exportStl } from "./build";
import type { Polygon } from "./kernel/extrude";
import { checkManifold, meshVolume } from "./kernel/mesh";
import { mulberry32, pick } from "./kernel/rng";
import {
  checkFlatWith,
  checkPrintability,
  ISSUE_MESSAGE_KEYS,
  issueStrings,
  issueValues,
} from "./guards";
import { layoutBorne } from "./objects/borne-model";
import { layoutCartouche, GAP_MM } from "./objects/cartouche-model";
import {
  analyzeFlat,
  flatBands,
  flatHeight,
  hasInk,
  type FlatModel,
} from "./objects/flat-model";
import {
  analyzeRelief,
  labelZone,
  layoutLabel,
  layoutRelief,
  peakAltitude,
  peakLabel,
  peakLabelParts,
  reliefGrid,
  reliefLevels,
  RELIEF_GRID,
  startsWithPeakWord,
  strataThresholds,
  type Locale,
} from "./objects/relief-model";
import {
  BORNE_DEFAULT,
  BORNE_PRESETS,
  CARTOUCHE_DEFAULT,
  CARTOUCHE_PRESETS,
  HERO_CONFIG,
  PRESETS,
  RELIEF_DEFAULT,
  RELIEF_PRESETS,
  surpriseBorne,
  surpriseCartouche,
  surpriseRelief,
} from "./presets";
import { PRICING } from "./pricing-params";
import { clampConfig, parseConfig, strataTops } from "./schemas";
import { computeStats } from "./stats";
import {
  loadTestFont,
  randomBorne,
  randomCartouche,
  randomRelief,
  randomTexts,
} from "./testing";
import { DEFAULT_TEXTS } from "./text/fields";
import type { GlyphFont } from "./text/glyphs";
import { textWidthMm } from "./text/layout";
import { boundaryGap, findOverlaps, polygonGap } from "./text/overlap";
import { linePolygons, linesPolygons } from "./text/shapes";
import type {
  BorneConfig,
  CartoucheConfig,
  ReliefConfig,
  StudioConfig,
  StudioObjectId,
  StudioTexts,
} from "./types";

const LOCALES: Locale[] = ["fr", "de", "it", "en"];

let font: GlyphFont;
beforeAll(() => {
  font = loadTestFont();
});

/** Formes d'encre d'un modèle plat : formes (disque, cadre, filet) puis contours des glyphes. */
function inkOf(
  model: FlatModel,
  lod: "drag" | "display" | "export" = "export",
) {
  return [...model.decor, ...linesPolygons(model.lines, lod, font)];
}

function isConvex(ring: readonly (readonly number[])[]): boolean {
  let sign = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const c = ring[(i + 2) % ring.length];
    const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (Math.abs(cross) < 1e-9) continue;
    const s = Math.sign(cross);
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

function inRing(ring: readonly (readonly number[])[], x: number, y: number) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** La matière du polygone contient ce point (dans l'extérieur, hors des trous). */
function inMatter(polygon: Polygon, x: number, y: number) {
  return (
    inRing(polygon.outer, x, y) &&
    !(polygon.holes ?? []).some((hole) => inRing(hole, x, y))
  );
}

function median(values: number[]): number {
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function measure(run: () => unknown, passes = 9): number {
  run();
  run();
  const times: number[] = [];
  for (let i = 0; i < passes; i++) {
    const t0 = performance.now();
    run();
    times.push(performance.now() - t0);
  }
  return median(times);
}

// Textes les plus hostiles : queues, cédilles, accents de capitales, Å, cédille de virgule.
const HOSTILE_CARD: StudioTexts = {
  name: "Çgpqy Åsa",
  role: "ÅÉÈÊÎÔÛÜ Ï",
  line1: "Ģķ ÇÇ gypj",
  line2: "ÉÅÜ Ģ gyp",
};

describe("Cartouche : mise en page", () => {
  const layouts = ["classique", "centree", "cartouche", "monogramme"] as const;

  it("le défaut : 85 × 55 × 2,2 mm, 11 couches, un changement de filament, imprimable", () => {
    const stats = computeStats(CARTOUCHE_DEFAULT, DEFAULT_TEXTS.cartouche);
    expect(stats.widthMm).toBe(85);
    expect(stats.depthMm).toBe(55);
    expect(stats.heightMm).toBe(2.2);
    expect(stats.layers).toBe(11);
    expect(stats.changes).toBe(1);
    expect(stats.printable).toEqual({ status: "ok" });
    expect(stats.estimate).toBeNull();
    expect(PRICING.validated).toBe(false);
    expect(stats.grams).toBeGreaterThan(5);
    expect(stats.grams).toBeLessThan(20);
  });

  it("les quatre mises en page tracent les quatre lignes avec le texte d'exemple, sans erreur", () => {
    for (const layout of layouts) {
      const config: CartoucheConfig = { ...CARTOUCHE_DEFAULT, layout };
      const model = layoutCartouche(config, DEFAULT_TEXTS.cartouche);
      const keys = model.lines.map((l) => l.key);
      expect(keys, `${layout}`).toEqual(
        layout === "monogramme"
          ? ["monogram", "name", "role", "line1", "line2"]
          : ["name", "role", "line1", "line2"],
      );
      expect(model.issues, `${layout}`).toEqual([]);
      const cap = (key: string) =>
        model.lines.find((l) => l.key === key)!.capMm;
      // Le monogramme prend de la largeur au nom : il rétrécit, sans passer sous 4 mm.
      const [nameMin, roleMin] = layout === "monogramme" ? [4, 4] : [5.2, 4];
      expect(cap("name"), `${layout}`).toBeGreaterThanOrEqual(nameMin);
      expect(cap("name"), `${layout}`).toBeLessThanOrEqual(5.2);
      expect(cap("role"), `${layout}`).toBeGreaterThanOrEqual(roleMin);
      expect(cap("role"), `${layout}`).toBeLessThanOrEqual(4);
      expect(cap("line1"), `${layout}`).toBe(3.6);
      expect(cap("line2"), `${layout}`).toBe(3.6);
    }
  });

  it("la mise en page décrite par le brief : disque de 3 mm (classique), cadre de 1 mm et filet (cartouche), initiales de 18 mm (monogramme)", () => {
    const classique = layoutCartouche(
      CARTOUCHE_DEFAULT,
      DEFAULT_TEXTS.cartouche,
    );
    expect(classique.decor).toHaveLength(1);
    const disc = classique.decor[0].outer;
    const xs = disc.map((p) => p[0]);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(3, 1);
    const frame = layoutCartouche(
      { ...CARTOUCHE_DEFAULT, layout: "cartouche" },
      DEFAULT_TEXTS.cartouche,
    );
    // Cadre (avec un trou) + filet de 1 mm sous le nom.
    expect(frame.decor).toHaveLength(2);
    expect(frame.decor[0].holes).toHaveLength(1);
    const ruleYs = frame.decor[1].outer.map((p) => p[1]);
    expect(Math.max(...ruleYs) - Math.min(...ruleYs)).toBeCloseTo(1, 6);
    const frameXs = frame.decor[0].outer.map((p) => p[0]);
    const holeXs = frame.decor[0].holes![0].map((p) => p[0]);
    expect(Math.max(...frameXs) - Math.max(...holeXs)).toBeCloseTo(1, 6);
    expect(Math.max(...frameXs)).toBeCloseTo(42.5 - 4, 6);
    const mono = layoutCartouche(
      { ...CARTOUCHE_DEFAULT, layout: "monogramme" },
      DEFAULT_TEXTS.cartouche,
    );
    const initials = mono.lines.find((l) => l.key === "monogram")!;
    expect(initials.text).toBe("LD");
    expect(initials.x).toBeCloseTo(-37.5, 6);
    // Deux initiales de 18 mm seraient plus larges que les 28 mm réservés : elles rétrécissent.
    expect(initials.capMm).toBeLessThan(18);
    expect(initials.capMm).toBeGreaterThanOrEqual(8);
    expect(textWidthMm("LD", initials.capMm)).toBeLessThanOrEqual(28);
    // Une seule initiale tient à 18 mm.
    const single = layoutCartouche(
      { ...CARTOUCHE_DEFAULT, layout: "monogramme" },
      { name: "Zoé" },
    );
    expect(single.lines.find((l) => l.key === "monogram")!.capMm).toBe(18);
  });

  it("monogramme : initiales d'un nom composé, accentuées, sans nom", () => {
    const model = (name: string) =>
      layoutCartouche({ ...CARTOUCHE_DEFAULT, layout: "monogramme" }, { name });
    expect(model("éloïse de la Tour").lines[0].text).toBe("ÉD");
    expect(model("Zoé").lines[0].text).toBe("Z");
    expect(model("").lines.some((l) => l.key === "monogram")).toBe(false);
    // Initiale accentuée : le sommet de l'encre reste sous la marge haute, sans sortir de la carte.
    const accented = model("Éric Åsa");
    const polygons = linePolygons(accented.lines[0], "export", font);
    const top = Math.max(
      ...polygons.flatMap((p) => p.outer.map((pt) => pt[1])),
    );
    expect(top).toBeLessThanOrEqual(22.5 + 1e-6);
    expect(top).toBeGreaterThan(22);
  });

  it("une ligne trop longue rétrécit jusqu'à la capitale minimale, puis `text-fit`", () => {
    const at = (name: string) =>
      layoutCartouche(CARTOUCHE_DEFAULT, { name }).lines.find(
        (l) => l.key === "name",
      )!;
    expect(at("Léa").capMm).toBe(5.2);
    // Un nom qui ne tient pas à 5,2 mm mais tient à 4 mm : la capitale diminue, sans erreur.
    const source = "Jean-Baptiste Dubois-Martin";
    let mid = "";
    for (let n = 1; n <= source.length && at(mid || "x").capMm === 5.2; n++) {
      mid = source.slice(0, n);
    }
    expect(at(mid).capMm).toBeLessThan(5.2);
    expect(at(mid).capMm).toBeGreaterThanOrEqual(4);
    expect(layoutCartouche(CARTOUCHE_DEFAULT, { name: mid }).issues).toEqual(
      [],
    );
    const huge = layoutCartouche(CARTOUCHE_DEFAULT, {
      name: "WWWWWWWWWWWWWWWWWWWWWWWW",
    });
    expect(huge.lines[0].capMm).toBe(4);
    expect(huge.issues.map((i) => i.code)).toContain("text-fit");
    const stats = computeStats(CARTOUCHE_DEFAULT, {
      name: "WWWWWWWWWWWWWWWWWWWWWWWW",
    });
    expect(stats.printable.status).toBe("error");
  });

  it("les lignes restent dans la carte, les formes d'encre ne se touchent jamais (4 mises en page, textes hostiles compris)", () => {
    for (const layout of layouts) {
      for (const mode of ["relief", "gravure"] as const) {
        const config: CartoucheConfig = {
          ...CARTOUCHE_DEFAULT,
          layout,
          mode,
          depth: 0.6,
          corner: 6,
        };
        const model = layoutCartouche(config, HOSTILE_CARD);
        expect(model.issues.map((i) => i.code)).not.toContain("text-fit");
        const ink = inkOf(model);
        expect(findOverlaps(ink), `${layout} ${mode}`).toEqual([]);
        // Toute l'encre à 2,5 mm du bord de la carte au moins.
        for (const polygon of ink) {
          for (const [x, y] of polygon.outer) {
            expect(Math.abs(x), `${layout} x`).toBeLessThanOrEqual(42.5 - 2.5);
            expect(Math.abs(y), `${layout} y`).toBeLessThanOrEqual(27.5 - 2.5);
          }
        }
      }
    }
  });

  it("entre deux lignes, l'écart d'encre est d'au moins 0,75 mm même avec queues, cédilles et accents", () => {
    for (const layout of layouts) {
      const model = layoutCartouche(
        { ...CARTOUCHE_DEFAULT, layout },
        HOSTILE_CARD,
      );
      const lines = model.lines.filter((l) => l.key !== "monogram");
      const shapes = lines.map((l) => linePolygons(l, "export", font));
      for (let i = 0; i < lines.length; i++) {
        for (let j = i + 1; j < lines.length; j++) {
          for (const a of shapes[i]) {
            for (const b of shapes[j]) {
              expect(
                polygonGap(a, b, 5),
                `${layout} ${lines[i].key}/${lines[j].key}`,
              ).toBeGreaterThanOrEqual(GAP_MM - 0.05);
            }
          }
        }
      }
      // Le filet et le cadre restent à distance de l'encre des lettres.
      const letters = shapes.flat();
      for (const decor of model.decor) {
        for (const glyph of letters) {
          expect(
            boundaryGap(decor, glyph, 3),
            `${layout}`,
          ).toBeGreaterThanOrEqual(0.45);
        }
      }
    }
  });

  it("la mise en page ne bouge pas à la saisie d'un accent ordinaire (é, è, ç, g)", () => {
    const base = layoutCartouche(CARTOUCHE_DEFAULT, {
      name: "Lea Dubois",
      role: "Architecte",
      line1: "lea@exemple.ch",
      line2: "+41 21 000 00 00",
    });
    const accented = layoutCartouche(CARTOUCHE_DEFAULT, {
      name: "Léa Dubois",
      role: "Architecte",
      line1: "lea@exemple.ch",
      line2: "+41 21 000 00 00",
    });
    for (let k = 0; k < base.lines.length; k++) {
      expect(accented.lines[k].y).toBeCloseTo(base.lines[k].y, 9);
    }
    // Un Å, lui, pousse la ligne du dessous (accent à 1,37 capitale).
    const ring = layoutCartouche(CARTOUCHE_DEFAULT, {
      name: "Åsa",
      role: "Architecte",
    });
    const plain = layoutCartouche(CARTOUCHE_DEFAULT, {
      name: "Asa",
      role: "Architecte",
    });
    expect(ring.lines[1].y).toBe(plain.lines[1].y);
    const below = layoutCartouche(CARTOUCHE_DEFAULT, {
      name: "Ģa",
      role: "Architecte",
    });
    expect(below.lines[1].y).toBeLessThan(plain.lines[1].y);
  });

  it("gravure : profondeur bornée (la plaque garde 0,4 mm sous la gravure), bandes encre puis plaque", () => {
    const config: CartoucheConfig = {
      ...CARTOUCHE_DEFAULT,
      mode: "gravure",
      thickness: 1.2,
      depth: 1.2,
    };
    const clamped = clampConfig(config);
    expect(clamped.depth).toBe(0.8);
    const model = layoutCartouche(clamped, DEFAULT_TEXTS.cartouche);
    expect(flatBands(model)).toEqual([
      { filament: "encre", toMm: 0.4 },
      { filament: "blanc-neve", toMm: 1.2 },
    ]);
    expect(flatHeight(model)).toBe(1.2);
    // Relief : plaque puis encre.
    const relief = layoutCartouche(CARTOUCHE_DEFAULT, DEFAULT_TEXTS.cartouche);
    expect(flatBands(relief)).toEqual([
      { filament: "blanc-neve", toMm: 1.6 },
      { filament: "encre", toMm: 2.2 },
    ]);
  });

  it("un relief sans aucune encre garde la hauteur de la plaque et une seule bande", () => {
    const empty = layoutCartouche(
      { ...CARTOUCHE_DEFAULT, layout: "centree" },
      {},
    );
    expect(hasInk(empty)).toBe(false);
    expect(flatHeight(empty)).toBe(1.6);
    expect(flatBands(empty)).toHaveLength(1);
    const stats = computeStats({ ...CARTOUCHE_DEFAULT, layout: "centree" }, {});
    expect(stats.heightMm).toBe(1.6);
    expect(stats.changes).toBe(0);
  });

  it("les textes des autres objets sont ignorés", () => {
    const a = layoutCartouche(CARTOUCHE_DEFAULT, DEFAULT_TEXTS.cartouche);
    const b = layoutCartouche(CARTOUCHE_DEFAULT, {
      ...DEFAULT_TEXTS.cartouche,
      peak: "Zzz",
      text: "Zzz",
    });
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });
});

describe("Borne : contour, anneau et texte", () => {
  const shapes = ["pilule", "etiquette", "goutte", "pic"] as const;
  const rings = ["gauche", "droite", "aucun"] as const;
  const TEXTS = [
    "Léa",
    "Çgpqy",
    "Åsa",
    "Ģķ Ņ",
    "Jean-Luc",
    "WWW",
    "I",
    "ÉÈÊ ÎÔ",
  ];

  it("le défaut : pilule de 40,9 × 14,3 mm, 4,8 mm de haut, 24 couches, un changement", () => {
    const stats = computeStats(BORNE_DEFAULT, DEFAULT_TEXTS.borne);
    expect(stats.heightMm).toBe(4.8);
    expect(stats.layers).toBe(24);
    expect(stats.changes).toBe(1);
    expect(stats.widthMm).toBeGreaterThanOrEqual(40);
    expect(stats.widthMm).toBeLessThanOrEqual(80);
    expect(stats.printable).toEqual({ status: "ok" });
  });

  it("le texte, dans toutes les formes et tous les anneaux, reste dans la plaque, à l'écart du trou et des bords", () => {
    for (const shape of shapes) {
      for (const ring of rings) {
        for (const text of TEXTS) {
          const config: BorneConfig = {
            ...BORNE_DEFAULT,
            shape,
            ring,
            cap: 7,
            ringD: 6,
          };
          const model = layoutBorne(config, { text });
          const label = `${shape} ${ring} « ${text} »`;
          // Le pic est un triangle : seuls les mots courts y tiennent en 80 mm.
          const tooLong = model.issues.some((i) => i.code === "text-fit");
          expect(
            !tooLong || (shape === "pic" && text.length > 3),
            `${label}`,
          ).toBe(true);
          if (tooLong) continue;
          expect(
            model.issues.map((i) => i.code),
            `${label}`,
          ).toEqual([]);
          const glyphs = linesPolygons(model.lines, "export", font);
          const plate = model.outline;
          for (const glyph of glyphs) {
            // Tous les sommets dans la matière de la plaque.
            for (const [x, y] of glyph.outer) {
              expect(inMatter(plate, x, y), `${label} (${x}, ${y})`).toBe(true);
            }
            // Marge de 0,5 mm au moins avec le bord extérieur et avec le trou.
            expect(
              boundaryGap(glyph, { outer: plate.outer }, 1),
              `${label}`,
            ).toBeGreaterThanOrEqual(0.5);
            for (const hole of plate.holes ?? []) {
              expect(
                polygonGap(glyph, { outer: hole }, 1),
                `${label} trou`,
              ).toBeGreaterThanOrEqual(0.5);
            }
          }
          expect(findOverlaps(glyphs), `${label}`).toEqual([]);
          // Le trou est dans la plaque, avec 1 mm de matière autour.
          for (const hole of plate.holes ?? []) {
            expect(
              hole.every(([x, y]) => inMatter({ outer: plate.outer }, x, y)),
            ).toBe(true);
            expect(
              boundaryGap({ outer: hole }, { outer: plate.outer }, 2),
              `${label}`,
            ).toBeGreaterThanOrEqual(0.9);
          }
          expect(Boolean(plate.holes?.length), `${label}`).toBe(
            ring !== "aucun",
          );
        }
      }
    }
  });

  it("la longueur suit le texte : 40 mm au moins, 80 mm au plus ; les lettres rétrécissent jusqu'à 5 mm, puis `text-fit`", () => {
    const at = (
      text: string,
      cap = 10,
      shape: BorneConfig["shape"] = "pilule",
    ) => layoutBorne({ ...BORNE_DEFAULT, cap, shape }, { text });
    const short = at("I", 7);
    expect(short.widthMm).toBeCloseTo(40, 0);
    // « Jean-Baptiste » à 10 mm dépasse 80 mm : la capitale diminue.
    const long = at("Jean-Baptiste");
    expect(long.lines[0].capMm).toBeLessThan(10);
    expect(long.lines[0].capMm).toBeGreaterThanOrEqual(5);
    expect(long.widthMm).toBeLessThanOrEqual(80 + 1e-6);
    expect(long.issues).toEqual([]);
    // 14 « W » ne tiennent pas à 5 mm : capitale minimale et erreur.
    const huge = at("WWWWWWWWWWWWWW");
    expect(huge.lines[0].capMm).toBe(5);
    expect(huge.issues.map((i) => i.code)).toContain("text-fit");
    expect(
      checkPrintability(
        { ...BORNE_DEFAULT, cap: 10 },
        { text: "WWWWWWWWWWWWWW" },
      ).status,
    ).toBe("error");
    // Quelle que soit la forme, la longueur réelle du contour reste dans 40–80 mm.
    for (const shape of shapes) {
      for (const text of ["I", "Léa", "Jean-Baptiste", "WWWWWWWWWWWW"]) {
        const model = at(text, 7, shape);
        if (model.issues.some((i) => i.code === "text-fit")) continue;
        expect(model.widthMm, `${shape} ${text}`).toBeGreaterThanOrEqual(39.95);
        expect(model.widthMm, `${shape} ${text}`).toBeLessThanOrEqual(80.05);
      }
    }
  });

  it("anneau à droite : le contour est le symétrique de celui de gauche, le texte se lit toujours de gauche à droite", () => {
    for (const shape of shapes) {
      const left = layoutBorne(
        { ...BORNE_DEFAULT, shape, ring: "gauche" },
        { text: "Léa" },
      );
      const right = layoutBorne(
        { ...BORNE_DEFAULT, shape, ring: "droite" },
        { text: "Léa" },
      );
      expect(right.widthMm).toBeCloseTo(left.widthMm, 6);
      expect(right.depthMm).toBeCloseTo(left.depthMm, 6);
      // Le trou est de l'autre côté.
      const holeX = (m: FlatModel) =>
        m.outline.holes![0].reduce((s, p) => s + p[0], 0) /
        m.outline.holes![0].length;
      expect(holeX(left)).toBeLessThan(0);
      expect(holeX(right)).toBeGreaterThan(0);
      expect(left.lines[0].text).toBe("Léa");
      expect(right.lines[0].text).toBe("Léa");
    }
  });

  it("jamais de croix suisse ni d'armoiries : contours convexes, forme « pic » = triangle arrondi symétrique, ni le mark ni une croix", () => {
    for (const shape of shapes) {
      const model = layoutBorne(
        { ...BORNE_DEFAULT, shape, ring: "aucun" },
        { text: "Léa" },
      );
      expect(isConvex(model.outline.outer), `${shape}`).toBe(true);
      expect(model.decor, `${shape}`).toEqual([]);
    }
    const pic = layoutBorne(
      { ...BORNE_DEFAULT, shape: "pic", ring: "aucun" },
      { text: "Léa" },
    );
    // Un triangle remplit la moitié de sa boîte ; une croix, le tiers ou moins ; le mark, des strates.
    const box = pic.widthMm * pic.depthMm;
    const area = Math.abs(analyzeFlat(pic).plateAreaMm2);
    expect(area / box).toBeGreaterThan(0.45);
    expect(area / box).toBeLessThan(0.6);
    // Symétrie par rapport à l'axe horizontal.
    const ys = pic.outline.outer.map((p) => p[1]);
    expect(Math.max(...ys)).toBeCloseTo(-Math.min(...ys), 6);
    // Trois sommets arrondis seulement : trois zones où le contour tourne de plus de 6° par sommet.
    const ring = pic.outline.outer;
    let corners = 0;
    let inCorner = false;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[(i + ring.length - 1) % ring.length];
      const b = ring[i];
      const c = ring[(i + 1) % ring.length];
      const turn = Math.abs(
        Math.atan2(
          (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]),
          (b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1]),
        ),
      );
      const sharp = turn > (6 * Math.PI) / 180;
      if (sharp && !inCorner) corners++;
      inCorner = sharp;
    }
    expect(corners).toBe(3);
  });

  it("la correction du trait propose la hauteur de lettres qui donne 0,8 mm", () => {
    // Le trait des lettres de 5 mm est déjà à 1,16 mm : rien à corriger, donc aucune anomalie.
    const stats = computeStats({ ...BORNE_DEFAULT, cap: 5 }, { text: "Léa" });
    expect(stats.printable.status).toBe("ok");
  });
});

describe("Relief : étiquette du sommet, massif, strates", () => {
  it("altitude fictive : 1800 + fnv1a(nom en minuscules, espaces fusionnés) mod 2600, déterministe", () => {
    expect(peakAltitude("Léa")).toBe(peakAltitude(" léa "));
    expect(peakAltitude("Léa")).toBe(peakAltitude("LÉA".toLowerCase()));
    expect(peakAltitude("Léa")).toBe(2566);
    for (const name of ["Léa", "Zoé", "Piz", "Mont Blanc", "Å", "a"]) {
      const alt = peakAltitude(name);
      expect(alt).toBeGreaterThanOrEqual(1800);
      expect(alt).toBeLessThan(1800 + 2600);
    }
    expect(peakAltitude("Léa")).not.toBe(peakAltitude("Léo"));
    // Normalisation Unicode : é précomposé et e + accent combinant sont le même nom.
    expect(peakAltitude("Léa")).toBe(peakAltitude("Léa"));
  });

  it("étiquette selon la langue : POINTE / PIZ / PIZZO / MOUNT, capitales, séparateur de milliers du jeu", () => {
    expect(peakLabel("Léa", "fr")).toBe("POINTE LÉA · 2 566 M");
    expect(peakLabel("Léa", "de")).toBe("PIZ LÉA · 2’566 M");
    expect(peakLabel("Léa", "it")).toBe("PIZZO LÉA · 2’566 M");
    expect(peakLabel("Léa", "en")).toBe("MOUNT LÉA · 2’566 M");
    expect(peakLabel("Léa")).toBe(peakLabel("Léa", "fr"));
    const parts = peakLabelParts("Léa", "fr");
    expect(parts).toEqual({ peak: "POINTE LÉA", altitude: "2 566 M" });
    // Toute l'étiquette est imprimable (dans le jeu de glyphes) dans les quatre langues.
    for (const locale of LOCALES) {
      for (const name of ["Léa", "Ödön", "Œuvre", "Łukasz", "ß"]) {
        const model = layoutRelief(RELIEF_DEFAULT, { peak: name }, locale);
        expect(
          model.issues.map((i) => i.code),
          `${locale} ${name}`,
        ).toEqual([]);
      }
    }
  });

  it("le préfixe n'est pas doublé quand le nom le porte déjà (casse et accents sans effet)", () => {
    // Le mot de préfixe de CHAQUE langue, tapé tel quel ou presque.
    expect(peakLabelParts("Pointe Zorgl", "fr").peak).toBe("POINTE ZORGL");
    expect(peakLabelParts("pointe zorgl", "fr").peak).toBe("POINTE ZORGL");
    expect(peakLabelParts("POINTÉ Zorgl", "fr").peak).toBe("POINTÉ ZORGL");
    expect(peakLabelParts("Piz Bernina", "de").peak).toBe("PIZ BERNINA");
    expect(peakLabelParts("pizzo Rotondo", "it").peak).toBe("PIZZO ROTONDO");
    expect(peakLabelParts("Mount Everest", "en").peak).toBe("MOUNT EVEREST");
    expect(peakLabel("Pointe Zorgl", "fr")).toBe(
      `POINTE ZORGL · ${peakLabelParts("Pointe Zorgl", "fr").altitude}`,
    );
    // Espaces superflus : le nom nettoyé commence bien par le mot.
    expect(peakLabelParts("  Pointe   Zorgl ", "fr").peak).toBe("POINTE ZORGL");
    // Trait d'union : « Pointe-Noire » est un nom qui commence par le mot.
    expect(peakLabelParts("Pointe-Noire", "fr").peak).toBe("POINTE-NOIRE");
    // Le mot seul : aucun doublon non plus.
    expect(peakLabelParts("Pointe", "fr").peak).toBe("POINTE");
    // L'altitude reste celle du nom saisi (déterministe, jamais celle d'un nom préfixé à part).
    expect(peakLabelParts("Pointe Zorgl", "fr").altitude).toBe(
      peakLabelParts("pointe  zorgl", "fr").altitude,
    );
  });

  it("le préfixe est ajouté quand le nom ne le porte pas (mot entier seulement, langue de la page)", () => {
    expect(peakLabelParts("Pointer", "fr").peak).toBe("POINTE POINTER");
    expect(peakLabelParts("Mountain", "en").peak).toBe("MOUNT MOUNTAIN");
    expect(peakLabelParts("Pizzaiolo", "it").peak).toBe("PIZZO PIZZAIOLO");
    // Le mot d'une autre langue n'est pas celui de la page : « Piz » sous /fr garde « Pointe ».
    expect(peakLabelParts("Piz Bernina", "fr").peak).toBe("POINTE PIZ BERNINA");
    expect(peakLabelParts("Pointe Zorgl", "de").peak).toBe("PIZ POINTE ZORGL");
    expect(peakLabelParts("Zorgl", "fr").peak).toBe("POINTE ZORGL");
    expect(startsWithPeakWord("Mount", "en")).toBe(true);
    expect(startsWithPeakWord("Mountain", "en")).toBe(false);
    expect(startsWithPeakWord("", "fr")).toBe(false);
  });

  it("l'étiquette gravée du Relief suit la même règle que le texte affiché", () => {
    // layoutLabel (gravure) et peakLabel (accueil, Studio) partagent peakLabelParts.
    for (const locale of LOCALES) {
      const word = peakLabelParts("x", locale).peak.split(" ")[0];
      const typed = `${word.charAt(0)}${word.slice(1).toLowerCase()} Zorgl`;
      const { lines } = layoutLabel(RELIEF_DEFAULT, { peak: typed }, locale);
      const engraved = lines.map((line) => line.text).join(" ");
      expect(engraved, locale).not.toContain(`${word} ${word}`);
      expect(engraved, locale).toContain(`${word} ZORGL`);
    }
  });

  it("une ligne quand elle tient à 3,6 mm au moins, deux sinon, `text-fit` au-delà ; capitale jamais au-dessus de 4,2 mm", () => {
    const short = layoutLabel(RELIEF_DEFAULT, { peak: "I" });
    expect(short.lines).toHaveLength(1);
    expect(short.lines[0].capMm).toBeLessThanOrEqual(4.2);
    const medium = layoutLabel(RELIEF_DEFAULT, { peak: "Léa" });
    expect(medium.lines.length).toBeGreaterThanOrEqual(1);
    const two = layoutLabel(RELIEF_DEFAULT, { peak: "Alpes" });
    expect(two.lines).toHaveLength(2);
    expect(two.lines[0].y).toBeGreaterThan(two.lines[1].y);
    expect(two.issues).toEqual([]);
    const zone = labelZone(RELIEF_DEFAULT);
    for (const line of [...short.lines, ...medium.lines, ...two.lines]) {
      const m = linePolygons(line, "export", font);
      const xs = m.flatMap((p) => p.outer.map((pt) => pt[0]));
      expect(Math.min(...xs)).toBeGreaterThanOrEqual(
        zone.cx - zone.width / 2 - 0.5,
      );
      expect(Math.max(...xs)).toBeLessThanOrEqual(
        zone.cx + zone.width / 2 + 0.5,
      );
    }
    const huge = layoutLabel(RELIEF_DEFAULT, { peak: "WWWWWWWWWWWW" });
    expect(huge.issues.map((i) => i.code)).toContain("text-fit");
    // Sans étiquette ou sans nom : aucune ligne, aucun souci.
    expect(
      layoutLabel({ ...RELIEF_DEFAULT, label: false }, { peak: "Léa" }),
    ).toEqual({
      lines: [],
      issues: [],
    });
    expect(layoutLabel(RELIEF_DEFAULT, {})).toEqual({ lines: [], issues: [] });
  });

  it("l'étiquette est en relief de 0,6 mm sur une zone plate : aucune strate dans la zone", () => {
    const grid = reliefGrid(RELIEF_DEFAULT, RELIEF_GRID.export);
    const zone = labelZone(RELIEF_DEFAULT);
    const { n, cell, values } = grid;
    let inZone = 0;
    let highest = 0;
    for (let j = 0; j < n; j++) {
      const y = (n / 2 - (j + 0.5)) * cell;
      for (let i = 0; i < n; i++) {
        const x = (i + 0.5 - n / 2) * cell;
        if (
          Math.abs(x - zone.cx) <= zone.width / 2 &&
          Math.abs(y - zone.cy) <= zone.height / 2
        ) {
          inZone++;
          highest = Math.max(highest, values[j * n + i]);
        }
      }
    }
    expect(inZone).toBeGreaterThan(100);
    // Sous le premier seuil des strates (lac 18 %) : la zone est plate.
    expect(highest).toBeLessThan(strataThresholds(RELIEF_DEFAULT)[0]);
  });

  it("strates emboîtées : chaque strate est plus petite que celle du dessous, la dernière est le sommet", () => {
    for (const config of RELIEF_PRESETS.map((p) => p.config)) {
      const model = layoutRelief(config, DEFAULT_TEXTS.relief);
      const analysis = analyzeRelief(model);
      expect(analysis.levelAreas).toHaveLength(config.levels);
      for (let k = 1; k < config.levels; k++) {
        expect(
          analysis.levelAreas[k],
          `${config.seed} strate ${k + 1}`,
        ).toBeLessThan(analysis.levelAreas[k - 1]);
      }
      // Toutes les strates existent (aucune ne disparaît sous le seuil d'îlot).
      expect(
        Math.min(...analysis.levelAreas),
        `${config.seed}`,
      ).toBeGreaterThan(5);
      const tops = strataTops(config.base, config.relief, config.levels);
      expect(model.tops).toEqual(tops);
      expect(model.heightMm).toBe(tops[config.levels]);
      expect(reliefLevels(config, RELIEF_GRID.display)).toHaveLength(
        config.levels,
      );
    }
  });

  it("le bord de 3 mm reste plat : aucune strate n'atteint le pourtour (rond et carré)", () => {
    for (const shape of ["rond", "carre"] as const) {
      const config: ReliefConfig = { ...RELIEF_DEFAULT, shape, lake: 0 };
      const R = config.size / 2;
      for (const polygons of reliefLevels(config, RELIEF_GRID.export)) {
        for (const polygon of polygons) {
          for (const [x, y] of polygon.outer) {
            const edge =
              shape === "rond"
                ? R - Math.hypot(x, y)
                : R - Math.max(Math.abs(x), Math.abs(y));
            // 3 mm moins une cellule de la carte (0,8 mm) : le contour est interpolé entre deux cellules.
            expect(edge, `${shape}`).toBeGreaterThan(2.5);
          }
        }
      }
    }
  });

  it("le même massif se dessine à l'identique : graine et carte déterministes", () => {
    const a = reliefLevels(RELIEF_DEFAULT, 128);
    const b = reliefLevels({ ...RELIEF_DEFAULT }, 128);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const c = reliefLevels({ ...RELIEF_DEFAULT, seed: 1292 }, 128);
    expect(JSON.stringify(c)).not.toBe(JSON.stringify(a));
  });

  it("le défaut : 100 × 100 × 6,2 mm, 31 couches, 3 changements, imprimable, sans CHF", () => {
    const stats = computeStats(RELIEF_DEFAULT, DEFAULT_TEXTS.relief);
    expect(stats.heightMm).toBe(6.2);
    expect(stats.widthMm).toBe(100);
    expect(stats.depthMm).toBe(100);
    expect(stats.layers).toBe(31);
    expect(stats.changes).toBe(3);
    expect(stats.purgeGrams).toBe(2.4);
    expect(stats.printable).toEqual({ status: "ok" });
    expect(stats.estimate).toBeNull();
    // Masse d'un sous-verre de 100 mm : quelques dizaines de grammes.
    expect(stats.grams).toBeGreaterThan(10);
    expect(stats.grams).toBeLessThan(40);
  });

  it("bandes du sous-verre calées sur les sommets de strates (défaut et préréglages)", () => {
    for (const { config } of RELIEF_PRESETS) {
      const tops = strataTops(config.base, config.relief, config.levels);
      for (const band of config.bands) {
        expect(tops, `${config.seed} ${band.toMm}`).toContain(band.toMm);
      }
      expect(config.bands.at(-1)!.toMm).toBe(tops[config.levels]);
      expect(config.bands.length).toBeGreaterThanOrEqual(2);
      expect(config.bands.length).toBeLessThanOrEqual(4);
    }
  });
});

describe("Gravure sans chevauchement : formes d'encre disjointes sur 200 configurations par objet", () => {
  function sample<C extends StudioConfig>(
    seed: number,
    object: StudioObjectId,
    draw: (rng: () => number) => C,
  ) {
    const rng = mulberry32(seed);
    const out: { config: C; texts: StudioTexts }[] = [];
    while (out.length < 200) {
      const config = draw(rng);
      const texts = randomTexts(rng, object);
      if (checkPrintability(config, texts).status === "error") continue;
      out.push({ config, texts });
    }
    return out;
  }

  it("Cartouche : jamais deux formes d'encre qui se touchent, toute l'encre dans la carte", () => {
    for (const { config, texts } of sample(31, "cartouche", randomCartouche)) {
      const model = layoutCartouche(config, texts);
      const ink = inkOf(model);
      expect(findOverlaps(ink), `${JSON.stringify({ config, texts })}`).toEqual(
        [],
      );
      for (const polygon of ink) {
        for (const [x, y] of polygon.outer) {
          expect(Math.abs(x)).toBeLessThan(42.5);
          expect(Math.abs(y)).toBeLessThan(27.5);
        }
      }
    }
  });

  it("Borne : jamais deux lettres qui se touchent, toute l'encre dans la plaque et hors du trou", () => {
    for (const { config, texts } of sample(32, "borne", randomBorne)) {
      const model = layoutBorne(config, texts);
      const glyphs = linesPolygons(model.lines, "export", font);
      const label = JSON.stringify({ config, texts });
      expect(findOverlaps(glyphs), `${label}`).toEqual([]);
      for (const glyph of glyphs) {
        for (const [x, y] of glyph.outer) {
          expect(inMatter(model.outline, x, y), `${label}`).toBe(true);
        }
        // Le trou d'anneau est à distance du texte.
        for (const hole of model.outline.holes ?? []) {
          expect(
            polygonGap(glyph, { outer: hole }, 1),
            `${label}`,
          ).toBeGreaterThanOrEqual(0.5);
        }
      }
      // Et il garde de la matière autour de lui.
      for (const hole of model.outline.holes ?? []) {
        expect(
          boundaryGap({ outer: hole }, { outer: model.outline.outer }, 2),
          `${label}`,
        ).toBeGreaterThanOrEqual(0.9);
      }
    }
  });

  it("Relief : les lettres de l'étiquette ne se touchent jamais", () => {
    for (const { config, texts } of sample(33, "relief", randomRelief)) {
      const locale = LOCALES[(config.seed + config.levels) % LOCALES.length];
      const model = layoutRelief(config, texts, locale);
      const glyphs = linesPolygons(model.lines, "export", font);
      expect(
        findOverlaps(glyphs),
        `${JSON.stringify({ config, texts })}`,
      ).toEqual([]);
    }
  });
});

describe("Statistiques des objets plats", () => {
  const cases: [StudioObjectId, StudioConfig, number][] = [
    ["cartouche", CARTOUCHE_DEFAULT, 0.015],
    ["borne", BORNE_DEFAULT, 0.015],
    ["relief", RELIEF_DEFAULT, 0.06],
  ];

  it("le volume analytique est celui du maillage d'export (aires exactes, épaisseurs des dalles)", () => {
    for (const [object, config, tolerance] of cases) {
      const texts = DEFAULT_TEXTS[object];
      const stats = computeStats(config, texts);
      const mesh = buildStudioMesh(config, texts, { lod: "export", font });
      const real = meshVolume(mesh) / 1000;
      expect(Math.abs(stats.volumeCm3 - real) / real, `${object}`).toBeLessThan(
        tolerance,
      );
    }
  });

  it("le volume analytique suit le maillage sur des configurations aléatoires (gravure comprise)", () => {
    const rng = mulberry32(4242);
    for (let i = 0; i < 40; i++) {
      const object = pick(rng, ["cartouche", "borne", "relief"] as const);
      const config =
        object === "cartouche"
          ? randomCartouche(rng)
          : object === "borne"
            ? randomBorne(rng)
            : randomRelief(rng);
      const texts = randomTexts(rng, object);
      if (checkPrintability(config, texts).status === "error") continue;
      const stats = computeStats(config, texts);
      const mesh = buildStudioMesh(config, texts, { lod: "export", font });
      const real = meshVolume(mesh) / 1000;
      expect(
        Math.abs(stats.volumeCm3 - real) / real,
        `${object} #${i} ${JSON.stringify(config)}`,
      ).toBeLessThan(object === "relief" ? 0.08 : 0.02);
      expect(stats.heightMm).toBeCloseTo(mesh.bbox[5], 4);
      expect(stats.grams).toBeGreaterThan(0);
      expect(stats.minutes).toBeGreaterThan(6);
    }
  });

  it("les objets épais (Relief, Borne) sont comptés en coque de 0,8 mm + remplissage 15 %, la Cartouche mince est pleine", () => {
    const card = computeStats(CARTOUCHE_DEFAULT, DEFAULT_TEXTS.cartouche);
    expect(card.grams).toBeCloseTo(card.volumeCm3 * 1.24 + card.purgeGrams, 0);
    const tag = computeStats(BORNE_DEFAULT, DEFAULT_TEXTS.borne);
    const full = tag.volumeCm3 * 1.24 + tag.purgeGrams;
    expect(tag.grams).toBeLessThan(full);
    expect(tag.grams).toBeGreaterThan(tag.purgeGrams);
  });

  it("un texte plus long ajoute de l'encre : masse, durée et volume croissent", () => {
    const short = computeStats(CARTOUCHE_DEFAULT, { name: "Léa" });
    const long = computeStats(CARTOUCHE_DEFAULT, DEFAULT_TEXTS.cartouche);
    expect(long.volumeCm3).toBeGreaterThan(short.volumeCm3);
    expect(long.grams).toBeGreaterThan(short.grams);
  });

  it("le nom est affiché sans CHF tant que le barème n'est pas validé", () => {
    for (const [object, config] of cases) {
      const stats = computeStats(config, DEFAULT_TEXTS[object]);
      expect(stats.estimate).toBeNull();
    }
  });

  it("budgets : statistiques ≤ 2 ms à froid pour Cartouche et Borne, ≤ 5 ms pour un nouveau massif ; maillage d'affichage de la Cartouche ≤ 25 ms", () => {
    const SLACK = 2; // marge ×2 contre la charge d'une CI qui lance tous les fichiers en parallèle
    let k = 0;
    const cardStats = measure(() =>
      computeStats(
        { ...CARTOUCHE_DEFAULT, thickness: 1.2 + 0.2 * (k++ % 7) },
        DEFAULT_TEXTS.cartouche,
      ),
    );
    const tagStats = measure(() =>
      computeStats(
        { ...BORNE_DEFAULT, cap: 5 + 0.5 * (k++ % 10) },
        DEFAULT_TEXTS.borne,
      ),
    );
    const massifStats = measure(() =>
      computeStats(
        { ...RELIEF_DEFAULT, seed: 100 + (k++ % 500) },
        DEFAULT_TEXTS.relief,
      ),
    );
    const display = measure(() =>
      buildStudioMesh(CARTOUCHE_DEFAULT, DEFAULT_TEXTS.cartouche, {
        lod: "display",
        font,
      }),
    );
    const displayGravure = measure(() =>
      buildStudioMesh(
        { ...CARTOUCHE_DEFAULT, mode: "gravure", layout: "cartouche" },
        DEFAULT_TEXTS.cartouche,
        { lod: "display", font },
      ),
    );
    console.log(
      `[perf] statistiques : cartouche ${cardStats.toFixed(3)} ms · borne ${tagStats.toFixed(3)} ms · massif neuf ${massifStats.toFixed(2)} ms ; cartouche display ${display.toFixed(1)} ms (gravure ${displayGravure.toFixed(1)} ms)`,
    );
    expect(cardStats).toBeLessThanOrEqual(2 * SLACK);
    expect(tagStats).toBeLessThanOrEqual(2 * SLACK);
    expect(massifStats).toBeLessThanOrEqual(5 * SLACK);
    expect(display).toBeLessThanOrEqual(25 * SLACK);
    expect(displayGravure).toBeLessThanOrEqual(25 * SLACK);
  });
});

describe("Statistiques par bande (éclaté) des objets plats", () => {
  const objects = ["cartouche", "relief", "borne"] as const;

  it("couches contiguës de la première à la dernière, changements et masses cohérents avec computeStats", () => {
    for (const object of objects) {
      for (const { id, config } of PRESETS[object]) {
        for (const texts of [DEFAULT_TEXTS[object], {}]) {
          const summary = bandStatsFor(config, texts);
          const stats = computeStats(config, texts);
          const label = `${object} ${id}`;
          expect(summary.changes, `${label}`).toBe(stats.changes);
          expect(summary.purgeGrams, `${label}`).toBe(stats.purgeGrams);
          expect(summary.bands[0].fromLayer, `${label}`).toBe(1);
          expect(summary.bands.at(-1)!.toLayer, `${label}`).toBe(stats.layers);
          summary.bands.forEach((band, k) => {
            expect(band.layers, `${label}`).toBeGreaterThan(0);
            const previousEnd = k > 0 ? summary.bands[k - 1].toLayer : 0;
            expect(band.fromLayer, `${label}`).toBe(previousEnd + 1);
          });
          const grams = summary.bands.reduce((sum, b) => sum + b.grams, 0);
          // Arrondis au dixième de gramme de chaque bande.
          expect(
            Math.abs(grams + summary.purgeGrams - stats.grams),
            `${label}`,
          ).toBeLessThan(0.1 * summary.bands.length + 0.06);
        }
      }
    }
  });

  it("Cartouche : relief = plaque puis encre ; gravure = encre puis plaque ; sans encre, une bande", () => {
    const relief = bandStatsFor(CARTOUCHE_DEFAULT, DEFAULT_TEXTS.cartouche);
    expect(relief.bands.map((b) => b.filament)).toEqual([
      "blanc-neve",
      "encre",
    ]);
    expect(relief.bands[0].toMm).toBe(1.6);
    expect(relief.bands[1].startsWithChange).toBe(true);
    const engraved = bandStatsFor(
      { ...CARTOUCHE_DEFAULT, mode: "gravure", depth: 0.6 },
      DEFAULT_TEXTS.cartouche,
    );
    expect(engraved.bands.map((b) => b.filament)).toEqual([
      "encre",
      "blanc-neve",
    ]);
    expect(engraved.bands[0].toMm).toBeCloseTo(1, 6);
    const empty = bandStatsFor({ ...CARTOUCHE_DEFAULT, layout: "centree" }, {});
    expect(empty.bands).toHaveLength(1);
    expect(empty.changes).toBe(0);
  });

  it("Lavaux : inchangé (même résultat que bandStats)", () => {
    expect(bandStatsFor(HERO_CONFIG)).toEqual(bandStats(HERO_CONFIG));
  });
});

describe("Garde-fous des objets plats", () => {
  it("caractère hors jeu : erreur `text-char` avec le caractère, le champ et la clé de message", () => {
    const printable = checkPrintability(CARTOUCHE_DEFAULT, {
      ...DEFAULT_TEXTS.cartouche,
      name: "Léa ✦",
    });
    expect(printable.status).toBe("error");
    if (printable.status === "ok") throw new Error("erreur attendue");
    const issue = printable.issues.find((i) => i.code === "text-char")!;
    expect(issue.char).toBe("✦");
    expect(issue.field).toBe("name");
    expect(ISSUE_MESSAGE_KEYS[issue.code]).toBe("guard.issue.textChar");
    expect(issueStrings(issue)).toEqual({ char: "✦" });
    expect(issueValues(issue)).toEqual({});
    // Dans les trois objets et dans le champ saisi.
    for (const [config, field] of [
      [BORNE_DEFAULT, "text"],
      [RELIEF_DEFAULT, "peak"],
    ] as const) {
      const p = checkPrintability(config, { [field]: "Ж" });
      expect(p.status, `${field}`).toBe("error");
      if (p.status === "ok") continue;
      expect(
        p.issues.some((i) => i.code === "text-char" && i.char === "Ж"),
      ).toBe(true);
    }
  });

  it("le ß saisi dans un nom est imprimable (aucune anomalie)", () => {
    expect(
      checkPrintability(CARTOUCHE_DEFAULT, {
        ...DEFAULT_TEXTS.cartouche,
        name: "Weiß",
      }).status,
    ).toBe("ok");
    expect(checkPrintability(BORNE_DEFAULT, { text: "Weiß" }).status).toBe(
      "ok",
    );
  });

  it("texte trop long : erreur `text-fit` avec la largeur nécessaire", () => {
    const p = checkPrintability(CARTOUCHE_DEFAULT, {
      name: "Wolfgang Amadeus Mozart Wolfgang",
    });
    expect(p.status).toBe("error");
    if (p.status === "ok") return;
    const fit = p.issues.find((i) => i.code === "text-fit")!;
    expect(fit.field).toBe("name");
    expect(ISSUE_MESSAGE_KEYS[fit.code]).toBe("guard.issue.textFit");
  });

  it("trait des lettres : < 0,8 mm avertit, < 0,6 mm bloque (le porte-nom propose la hauteur de lettres)", () => {
    const base: FlatModel = {
      object: "borne",
      mode: "relief",
      outline: {
        outer: [
          [0, 0],
          [10, 0],
          [10, 10],
          [0, 10],
        ],
      },
      lines: [],
      decor: [],
      plateMm: 4,
      inkMm: 0.8,
      widthMm: 10,
      depthMm: 10,
      plate: "encre",
      ink: "blanc-neve",
      issues: [{ code: "text-stroke", field: "text", value: 0.7 }],
    };
    const warn = checkFlatWith(
      base,
      () => ({ cap: 6 }) as Partial<StudioConfig>,
    );
    expect(warn.status).toBe("warn");
    if (warn.status === "ok") throw new Error("avertissement attendu");
    expect(warn.issues[0]).toMatchObject({
      code: "text-stroke",
      field: "text",
      value: 0.7,
      fix: { cap: 6 },
    });
    expect(issueValues(warn.issues[0])).toEqual({ value: 0.7 });
    const error = checkFlatWith({
      ...base,
      issues: [{ code: "text-stroke", field: "text", value: 0.55 }],
    });
    expect(error.status).toBe("error");
    // Aucun souci : imprimable.
    expect(checkFlatWith({ ...base, issues: [] })).toEqual({ status: "ok" });
  });

  it("plateau : une pièce de plus de 250 mm est une erreur `plate`", () => {
    const wide: FlatModel = {
      object: "borne",
      mode: "relief",
      outline: {
        outer: [
          [0, 0],
          [300, 0],
          [300, 10],
          [0, 10],
        ],
      },
      lines: [],
      decor: [],
      plateMm: 4,
      inkMm: 0.8,
      widthMm: 300,
      depthMm: 10,
      plate: "encre",
      ink: "blanc-neve",
      issues: [],
    };
    const p = checkFlatWith(wide);
    expect(p.status).toBe("error");
    if (p.status === "ok") return;
    expect(p.issues[0]).toMatchObject({ code: "plate", value: 300 });
  });

  it("les codes d'anomalie ont tous un message, et `near-vase-spirale` ne vise que le vase", () => {
    for (const config of [CARTOUCHE_DEFAULT, RELIEF_DEFAULT, BORNE_DEFAULT]) {
      const p = checkPrintability(config, { name: "✦", peak: "✦", text: "✦" });
      if (p.status === "ok") continue;
      for (const issue of p.issues) {
        expect(issue.code).not.toBe("near-vase-spirale");
        expect(ISSUE_MESSAGE_KEYS[issue.code]).toBeTruthy();
      }
    }
  });
});

describe("Préréglages des objets plats", () => {
  it("chaque préréglage est une configuration valide et stable (bornage, schéma), imprimable avec les textes d'exemple dans les quatre langues", () => {
    for (const object of ["cartouche", "relief", "borne"] as const) {
      expect(PRESETS[object].length).toBeGreaterThanOrEqual(4);
      for (const { id, config } of PRESETS[object]) {
        expect(config.object).toBe(object);
        expect(clampConfig(config), `${object} ${id}`).toEqual(config);
        expect(parseConfig(object, config).ok, `${object} ${id}`).toBe(true);
        for (const locale of LOCALES) {
          const p = checkPrintability(config, DEFAULT_TEXTS[object], locale);
          expect(p.status, `${object} ${id} ${locale}`).toBe("ok");
        }
        const stats = computeStats(config, DEFAULT_TEXTS[object]);
        expect(stats.grams, `${object} ${id}`).toBeGreaterThan(0);
        expect(stats.layers).toBeGreaterThan(5);
      }
    }
  });

  it("le premier préréglage de chaque objet est son défaut ; RELIEF_DEFAULT est le massif du brief", () => {
    expect(CARTOUCHE_PRESETS[0].config).toEqual(CARTOUCHE_DEFAULT);
    expect(RELIEF_PRESETS[0].config).toEqual(RELIEF_DEFAULT);
    expect(BORNE_PRESETS[0].config).toEqual(BORNE_DEFAULT);
    expect(RELIEF_DEFAULT).toMatchObject({
      shape: "rond",
      size: 100,
      base: 3,
      relief: 3.2,
      levels: 8,
      seed: 1291,
      lake: 18,
      label: true,
    });
    expect(RELIEF_DEFAULT.bands.map((b) => b.filament)).toEqual([
      "bleu-leman",
      "vert-lavaux",
      "gris-molasse",
      "blanc-neve",
    ]);
  });

  it("les préréglages se distinguent : pas deux fois la même configuration", () => {
    for (const object of ["cartouche", "relief", "borne"] as const) {
      const all = PRESETS[object].map((p) => JSON.stringify(p.config));
      expect(new Set(all).size).toBe(all.length);
    }
  });

  it("aucun préréglage ne porte de texte", () => {
    for (const object of ["cartouche", "relief", "borne"] as const) {
      for (const { config } of PRESETS[object]) {
        expect(Object.keys(config)).not.toContain("name");
        expect(Object.keys(config)).not.toContain("text");
        expect(Object.keys(config)).not.toContain("peak");
      }
    }
  });
});

describe("« Surprenez-moi » des objets plats", () => {
  const draws = [
    ["cartouche", surpriseCartouche, CARTOUCHE_PRESETS],
    ["relief", surpriseRelief, RELIEF_PRESETS],
    ["borne", surpriseBorne, BORNE_PRESETS],
  ] as const;

  it("300 tirages par objet : configuration stable, imprimable avec les textes d'exemple dans les quatre langues, déterministe", () => {
    for (const [object, draw, presets] of draws) {
      const seen = new Set<string>();
      let fallbacks = 0;
      for (let seed = 0; seed < 300; seed++) {
        const config = draw(seed);
        expect(config.object).toBe(object);
        expect(clampConfig(config), `${object} ${seed}`).toEqual(config);
        expect(JSON.stringify(draw(seed))).toBe(JSON.stringify(config));
        for (const locale of LOCALES) {
          expect(
            checkPrintability(config, DEFAULT_TEXTS[object], locale).status,
            `${object} ${seed} ${locale}`,
          ).toBe("ok");
        }
        seen.add(JSON.stringify(config));
        if (
          presets.some(
            (p) => JSON.stringify(p.config) === JSON.stringify(config),
          )
        ) {
          fallbacks++;
        }
      }
      // Des tirages variés, et presque jamais le préréglage de secours.
      expect(seen.size, `${object}`).toBeGreaterThan(200);
      expect(fallbacks, `${object}`).toBeLessThan(15);
    }
  });

  it("le texte reste lisible : plaque et encre contrastées ; le massif garde toutes ses strates", () => {
    for (let seed = 0; seed < 200; seed++) {
      for (const config of [surpriseCartouche(seed), surpriseBorne(seed)]) {
        const [a, b] =
          config.object === "cartouche"
            ? [config.plate, config.ink]
            : [(config as BorneConfig).base, (config as BorneConfig).ink];
        expect(a, `${config.object} ${seed}`).not.toBe(b);
      }
      const relief = surpriseRelief(seed);
      const areas = analyzeRelief(
        layoutRelief(relief, DEFAULT_TEXTS.relief),
      ).levelAreas;
      expect(Math.min(...areas), `relief ${seed}`).toBeGreaterThan(5);
    }
  });
});

describe("Groupes de triangles des objets plats (une couleur par bande)", () => {
  it("les groupes recouvrent tous les index, dans l'ordre des bandes, avec des normales unitaires", () => {
    for (const object of ["cartouche", "relief", "borne"] as const) {
      for (const { id, config } of PRESETS[object]) {
        const texts = DEFAULT_TEXTS[object];
        const mesh = buildStudioMesh(config, texts, { lod: "display", font });
        const bands = bandStatsFor(config, texts).bands;
        let start = 0;
        let lastBand = -1;
        for (const g of mesh.groups) {
          expect(g.start, `${object} ${id}`).toBe(start);
          expect(g.count % 3, `${object} ${id}`).toBe(0);
          expect(g.band, `${object} ${id}`).toBeGreaterThan(lastBand);
          expect(g.band, `${object} ${id}`).toBeLessThan(bands.length);
          start += g.count;
          lastBand = g.band;
        }
        expect(start, `${object} ${id}`).toBe(mesh.indices.length);
        for (let i = 0; i < mesh.normals.length; i += 3) {
          const len = Math.hypot(
            mesh.normals[i],
            mesh.normals[i + 1],
            mesh.normals[i + 2],
          );
          expect(Math.abs(len - 1), `${object} ${id}`).toBeLessThan(1e-4);
        }
      }
    }
  });

  it("éclaté de la Cartouche gravée : deux coques fermées (dalle basse et dalle percée), jamais dans l'export", () => {
    const config: CartoucheConfig = {
      ...CARTOUCHE_DEFAULT,
      mode: "gravure",
      depth: 0.6,
    };
    const split = buildStudioMesh(config, DEFAULT_TEXTS.cartouche, {
      lod: "display",
      font,
      separateBands: true,
    });
    const whole = buildStudioMesh(config, DEFAULT_TEXTS.cartouche, {
      lod: "export",
      font,
      separateBands: true,
    });
    // Les coques se touchent à la frontière de bande : le Stage les écarte de
    // 12 mm par groupe, on fait pareil avant de vérifier qu'elles sont fermées.
    const positions = split.positions.slice();
    for (const g of split.groups) {
      for (let i = g.start; i < g.start + g.count; i++) {
        positions[split.indices[i] * 3 + 2] =
          split.positions[split.indices[i] * 3 + 2] + g.band * 12;
      }
    }
    const spread = checkManifold({ ...split, positions });
    expect(spread.closed).toBe(true);
    expect(spread.components).toBeGreaterThan(1);
    expect(spread.componentVolumes.every((v) => v > 0)).toBe(true);
    expect(checkManifold(whole).components).toBe(1);
    expect(split.groups.map((g) => g.band)).toEqual([0, 1]);
  });
});

describe("Export STL des objets plats", () => {
  it("84 + 50 × n octets, en-tête « Swiss3Design Studio v1 <objet> <empreinte> », déterministe, sensible au texte", () => {
    for (const object of ["cartouche", "relief", "borne"] as const) {
      const config = PRESETS[object][0].config;
      const texts = DEFAULT_TEXTS[object];
      const a = exportStl(config, texts, { font });
      const b = exportStl(structuredClone(config), { ...texts }, { font });
      expect(a.bytes, `${object}`).toBe(84 + 50 * a.triangles);
      expect(a.buffer.byteLength).toBe(a.bytes);
      const header = new TextDecoder("ascii").decode(
        new Uint8Array(a.buffer).slice(0, 80),
      );
      expect(header.startsWith(`Swiss3Design Studio v1 ${object} `)).toBe(true);
      expect(header.startsWith("solid")).toBe(false);
      expect(a.hash).toBe(b.hash);
      expect(
        Buffer.from(a.buffer).equals(Buffer.from(b.buffer)),
        `${object}`,
      ).toBe(true);
      expect(a.fileName).toBe(`s3d-${object}-${a.hash}.stl`);
      const other = exportStl(
        config,
        { ...texts, name: "Autre", peak: "Autre", text: "Autre" },
        { font },
      );
      expect(other.hash, `${object}`).not.toBe(a.hash);
      // Volume du fichier : la Cartouche et la Borne pèsent quelques dizaines de Ko.
      expect(a.bytes).toBeLessThan(2_000_000);
    }
  });

  it("sans police chargée, un objet à texte refuse de se construire (jamais de lettres manquantes)", async () => {
    const { setGlyphFont, getGlyphFont } = await import("./text/glyphs");
    const saved = getGlyphFont();
    setGlyphFont(null);
    try {
      expect(() =>
        buildStudioMesh(CARTOUCHE_DEFAULT, DEFAULT_TEXTS.cartouche, {
          lod: "display",
        }),
      ).toThrow(/glyphes non chargés/);
      // Sans texte, pas besoin de glyphes pour la plaque seule d'un relief sans disque.
      expect(() =>
        buildStudioMesh(
          { ...CARTOUCHE_DEFAULT, layout: "centree" },
          {},
          { lod: "display" },
        ),
      ).not.toThrow();
    } finally {
      setGlyphFont(saved);
    }
  });
});

describe("Fermeture d'imports du générateur (budget du Worker de géométrie)", () => {
  /** Modules du dépôt atteints depuis `entry` par des imports statiques relatifs (hors `import type`). */
  function closure(entry: string): Map<string, string> {
    const files = new Map<string, string>();
    const visit = (file: string) => {
      if (files.has(file)) return;
      const source = readFileSync(file, "utf8");
      files.set(file, source);
      for (const match of source.matchAll(
        /^(?:import|export)\s+(?!type\b)[^;]*?\sfrom\s+"([^"]+)"/gm,
      )) {
        const spec = match[1];
        if (!spec.startsWith(".")) continue;
        visit(
          fileURLToPath(
            new URL(`${spec}.ts`, `file:///${file.replace(/\\/g, "/")}`),
          ),
        );
      }
    };
    visit(entry);
    return files;
  }

  const entry = (name: string) => fileURLToPath(new URL(name, import.meta.url));

  it("build.ts n'embarque ni zod, ni three, ni le JSON des glyphes, ni les utilitaires de test", () => {
    const files = closure(entry("./build.ts"));
    expect(files.size).toBeGreaterThan(20);
    const names = [...files.keys()].map((f) => f.replace(/\\/g, "/"));
    for (const [file, source] of files) {
      expect(source, `${file}`).not.toMatch(/from "(zod|three|gsap|lenis)/);
      expect(source, `${file}`).not.toMatch(
        /(?:from\s+|import\()"[^"]*\.json"/,
      );
    }
    expect(names.some((n) => n.endsWith("/schemas.ts"))).toBe(false);
    expect(names.some((n) => n.endsWith("/testing.ts"))).toBe(false);
    expect(names.some((n) => n.endsWith("/text/overlap.ts"))).toBe(false);
    expect(names.some((n) => n.endsWith("/ranges.ts"))).toBe(true);
  });

  it("stats.ts, guards.ts et poster-flat.ts (rendu serveur) n'embarquent pas zod non plus", () => {
    for (const name of [
      "./stats.ts",
      "./guards.ts",
      "./poster-flat.ts",
      "./band-stats.ts",
    ]) {
      const files = closure(entry(name));
      for (const [file, source] of files) {
        expect(source, `${name} → ${file}`).not.toMatch(/from "zod"/);
      }
    }
  });
});

describe("Sources du dépôt", () => {
  it("le JSON des glyphes n'est importé par aucun module du dépôt (règle d'or 10 : il reste dans public/)", () => {
    const here = fileURLToPath(new URL("./text/glyphs.ts", import.meta.url));
    const source = readFileSync(here, "utf8");
    // Le chargeur le récupère par fetch, jamais par import.
    expect(source).toMatch(/fetch/);
    expect(source).not.toMatch(/from ["'][^"']*s3d-relief-v1\.json["']/);
  });
});
