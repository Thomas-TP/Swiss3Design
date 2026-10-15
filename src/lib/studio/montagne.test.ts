// La Montagne (brief « Strates », §6.2 et §6.3.4, refonte du 10.10.2026) :
// carte d'altitude (déterminisme, plafond, bord plat, calotte), étiquette et
// tablier, bandes (le socle est la première), garde de hauteur, maillage lissé
// et en strates (coques fermées à chaque niveau de détail, éclaté), statistiques,
// codec d'URL. Les 200 configurations aléatoires et les préréglages sont dans
// manifold.test.ts et flat-objects.test.ts.
import { beforeAll, describe, expect, it } from "vitest";
import { bandStatsFor } from "./band-stats";
import { buildStudioMesh, exportStl } from "./build";
import { checkPrintability } from "./guards";
import { checkManifold, meshVolume } from "./kernel/mesh";
import { mulberry32 } from "./kernel/rng";
import { buildMontagne } from "./objects/montagne";
import {
  analyzeMontagne,
  APRON_MM,
  halfWidthAt,
  labelAltitude,
  layoutLabel,
  layoutMontagne,
  mountainField,
  mountainFootprint,
  mountainGrid,
  peakAltitude,
  peakLabel,
  peakLabelParts,
  plinthOutline,
  groupedAltitude,
  GRID_ACROSS,
} from "./objects/montagne-model";
import { montagneElevation } from "./poster-montagne";
import { montagneTopView } from "./poster-flat";
import { MONTAGNE_DEFAULT, MONTAGNE_PRESETS, montagneBands } from "./presets";
import {
  clampConfig,
  clampMontagne,
  MONTAGNE_RANGES,
  montagneHeightMax,
  montagneStrataTops,
  montagneTotal,
  normalizeMontagneBands,
  parseConfig,
  rescaleMontagneBands,
  withMontagneGeometry,
} from "./schemas";
import { computeStats } from "./stats";
import { loadTestFont, randomMontagne } from "./testing";
import { DEFAULT_TEXTS } from "./text/fields";
import { linesPolygons } from "./text/shapes";
import type { GlyphFont } from "./text/glyphs";
import type { MeshData, MontagneConfig } from "./types";
import {
  decodeConfig,
  decodeSearchParams,
  encodeConfig,
  encodeSearchParams,
  machineLine,
  toShortKeys,
} from "./url-state";

const D = MONTAGNE_DEFAULT;
const LOCALES = ["fr", "de", "it", "en"] as const;

let font: GlyphFont;
beforeAll(() => {
  font = loadTestFont();
});

/** Sous-maillage d'un groupe de triangles (une bande) : même sommets, index du groupe seulement. */
function bandMesh(mesh: MeshData, band: number): MeshData {
  const groups = mesh.groups.filter((g) => g.band === band);
  const count = groups.reduce((n, g) => n + g.count, 0);
  const indices = new Uint32Array(count);
  let o = 0;
  for (const g of groups) {
    indices.set(mesh.indices.subarray(g.start, g.start + g.count), o);
    o += g.count;
  }
  return {
    ...mesh,
    indices,
    groups: [{ start: 0, count, band }],
    triangles: count / 3,
  };
}

describe("carte d'altitude : déterministe, bornée, plafonnée par une calotte", () => {
  it("même configuration, même carte, au bit près ; une autre graine change la montagne", () => {
    const a = mountainGrid(D, GRID_ACROSS.stats);
    const b = mountainGrid({ ...D }, GRID_ACROSS.stats);
    expect(Array.from(a.values)).toEqual(Array.from(b.values));
    const c = mountainGrid({ ...D, seed: D.seed + 1 }, GRID_ACROSS.stats);
    expect(Array.from(c.values)).not.toEqual(Array.from(a.values));
    // La hauteur, le socle, les couleurs ne changent pas la carte normalisée.
    const other: MontagneConfig = {
      ...D,
      height: 100,
      plinth: 6,
      style: "strates",
    };
    const e = mountainGrid(other, GRID_ACROSS.stats);
    expect(Array.from(e.values)).toEqual(Array.from(a.values));
  });

  it("le maximum vaut exactement 1 (la hauteur choisie) et le plateau du sommet fait au moins 1,5 mm de diamètre", () => {
    for (const form of ["pic", "massif", "arete"] as const) {
      for (const seed of [1, 777, 4040, 9123]) {
        const config = { ...D, form, seed };
        const field = mountainField(config);
        // Échantillonnage fin autour du sommet : la calotte (valeur 1) est d'un seul tenant et couvre ≥ π × 0,75² mm².
        const cell = 0.1;
        let max = 0;
        let area = 0;
        for (let j = -60; j <= 60; j++) {
          for (let i = -60; i <= 60; i++) {
            const v = field.at(
              field.peak.x + i * cell,
              field.peak.y + j * cell,
            );
            if (v > max) max = v;
            if (v >= 1) area += cell * cell;
          }
        }
        expect(max, `${form} ${seed}`).toBe(1);
        expect(area, `${form} ${seed} calotte`).toBeGreaterThanOrEqual(
          Math.PI * 0.75 ** 2 * 0.85,
        );
      }
    }
  });

  it("la carte est nulle sur au moins 3 mm tout autour du socle (rond, carré, hexagone, avec et sans étiquette)", () => {
    for (const shape of ["rond", "carre", "hexagone"] as const) {
      for (const label of [true, false]) {
        for (const size of [60, 90, 120]) {
          const config: MontagneConfig = clampMontagne({
            ...D,
            shape,
            size,
            label,
            height: 40,
          });
          const field = mountainField(config);
          const ring = plinthOutline(config, "export");
          // Marge : chaque point du contour est à ≥ 3 mm de la montagne (la carte y est nulle dans un disque de 3 mm).
          for (const [x, y] of ring) {
            for (let k = 0; k < 8; k++) {
              const a = (k * Math.PI) / 4;
              // On regarde vers l'intérieur : (x, y) → centre, à 0..2,9 mm.
              const len = Math.hypot(x, y) || 1;
              for (const d of [0, 1.5, 2.9]) {
                const px = x - (x / len) * d + Math.cos(a) * 0.05;
                const py = y - (y / len) * d + Math.sin(a) * 0.05;
                expect(
                  field.at(px, py),
                  `${shape} ${size} ${label} (${px.toFixed(1)}, ${py.toFixed(1)})`,
                ).toBe(0);
              }
            }
          }
        }
      }
    }
  });

  it("la montagne tient dans l'emprise : carte nulle hors du disque, plus haute que la moitié près du centre pour le pic", () => {
    const field = mountainField(D);
    const fp = field.footprint;
    expect(field.at(fp.cx + fp.radius + 0.01, fp.cy)).toBe(0);
    expect(field.at(fp.cx, fp.cy - fp.radius - 0.01)).toBe(0);
    expect(field.at(field.peak.x, field.peak.y)).toBe(1);
  });
});

describe("emprise et tablier de l'étiquette", () => {
  it("sans étiquette la montagne est centrée ; avec, elle est repoussée vers l'arrière de 19,5 mm de tablier", () => {
    const off = mountainFootprint({ size: 90, label: false });
    expect(off).toEqual({ cx: 0, cy: 0, radius: 42 });
    const on = mountainFootprint({ size: 90, label: true });
    expect(APRON_MM).toBe(19.5);
    // Son front est à 19,5 mm du bord avant, son dos à 3 mm du bord arrière.
    expect(on.cy - on.radius).toBeCloseTo(-45 + APRON_MM, 6);
    expect(on.cy + on.radius).toBeCloseTo(45 - 3, 6);
    expect(on.cx).toBe(0);
  });

  it("l'étiquette est en relief de 0,8 mm sur le tablier : devant le pied de la montagne et dans le socle, pour chaque forme", () => {
    for (const shape of ["rond", "carre", "hexagone"] as const) {
      const config = clampMontagne({ ...D, shape, size: 100 });
      const model = layoutMontagne(config, { peak: "Léa" }, "fr");
      expect(model.issues, `${shape}`).toEqual([]);
      expect(model.lines.length).toBeGreaterThanOrEqual(1);
      const front = model.footprint.cy - model.footprint.radius;
      const outline = plinthOutline(config, "export");
      for (const polygon of linesPolygons(model.lines, "export", font)) {
        for (const [x, y] of polygon.outer) {
          // Devant le pied de la montagne.
          expect(y, `${shape}`).toBeLessThan(front);
          // Dans le socle, à plus de 1,5 mm du bord (corde moins marge).
          expect(Math.abs(x), `${shape}`).toBeLessThanOrEqual(
            halfWidthAt(config, y) - 1.5,
          );
          expect(y).toBeGreaterThan(-config.size / 2 + 4);
        }
      }
      expect(outline.length).toBeGreaterThan(3);
    }
  });

  it("une ligne quand elle tient à 3,6 mm au moins, deux sinon (nom puis altitude), `text-fit` au-delà ; capitale jamais au-dessus de 4,2 mm", () => {
    const short = layoutLabel(D, { peak: "Léa" });
    expect(short.lines).toHaveLength(1);
    expect(short.lines[0].capMm).toBeLessThanOrEqual(4.2);
    const two = layoutLabel({ ...D, size: 80 }, { peak: "Dent Blanche" });
    expect(two.lines).toHaveLength(2);
    expect(two.lines[0].y).toBeGreaterThan(two.lines[1].y);
    expect(two.lines[0].text).toBe("DENT BLANCHE");
    expect(two.lines[1].text).toMatch(/ M$/);
    expect(two.issues).toEqual([]);
    expect(two.lines[0].capMm).toBe(two.lines[1].capMm);
    const huge = layoutLabel({ ...D, size: 60 }, { peak: "WWWWWWWWWWWWWWWW" });
    expect(huge.issues.map((i) => i.code)).toContain("text-fit");
    // Sans étiquette ou sans nom : aucune ligne, aucun souci.
    expect(layoutLabel({ ...D, label: false }, { peak: "Léa" })).toEqual({
      lines: [],
      issues: [],
    });
    expect(layoutLabel(D, {})).toEqual({ lines: [], issues: [] });
  });

  it("la montagne ne change pas quand le texte change : l'emprise ne dépend que de la base et de l'étiquette", () => {
    const a = mountainField({ ...D });
    const b = layoutMontagne(D, { peak: "x" }).footprint;
    const c = layoutMontagne(D, { peak: "Une très longue Pointe" }).footprint;
    expect(b).toEqual(c);
    expect(a.footprint).toEqual(b);
  });
});

describe("altitude de l'étiquette : fictive ou saisie, sans préfixe automatique", () => {
  it("fictive : 1800 + fnv1a(nom en minuscules, espaces fusionnés) mod 2600, déterministe", () => {
    expect(peakAltitude("Léa")).toBe(2566);
    expect(peakAltitude("Léa")).toBe(peakAltitude(" léa "));
    for (const name of ["Léa", "Zoé", "Dent Blanche", "Å", "a"]) {
      const alt = peakAltitude(name);
      expect(alt).toBeGreaterThanOrEqual(1800);
      expect(alt).toBeLessThan(1800 + 2600);
    }
    expect(peakAltitude("Léa")).not.toBe(peakAltitude("Léo"));
  });

  it("saisie : 0 à 8 848 m, arrondie et bornée ; la fictive ne dépend pas de l'altitude saisie", () => {
    const typed = { ...D, altMode: "saisie" as const };
    expect(labelAltitude({ ...typed, altitude: 4357 }, "Léa")).toBe(4357);
    expect(labelAltitude({ ...typed, altitude: 0 }, "Léa")).toBe(0);
    expect(labelAltitude({ ...typed, altitude: 99999 }, "Léa")).toBe(8848);
    expect(labelAltitude({ ...typed, altitude: -5 }, "Léa")).toBe(0);
    expect(labelAltitude({ ...D, altitude: 4357 }, "Léa")).toBe(2566);
  });

  it("écriture : milliers groupés par langue (espace insécable, apostrophe suisse), jamais de zéro de tête", () => {
    expect(groupedAltitude(4357, "fr")).toBe("4 357");
    expect(groupedAltitude(4357, "de")).toBe("4’357");
    expect(groupedAltitude(8848, "it")).toBe("8’848");
    expect(groupedAltitude(450, "fr")).toBe("450");
    expect(groupedAltitude(45, "en")).toBe("45");
    expect(groupedAltitude(0, "fr")).toBe("0");
    expect(groupedAltitude(1005, "en")).toBe("1’005");
  });

  it("l'étiquette est NOM · ALTITUDE en capitales : aucun mot de préfixe n'est ajouté ni doublé", () => {
    expect(peakLabel("Léa", "fr")).toBe("LÉA · 2 566 M");
    expect(peakLabel("Pointe Léa", "fr")).toBe(
      "POINTE LÉA · 3 071 M".replace(
        "3 071",
        groupedAltitude(peakAltitude("Pointe Léa"), "fr"),
      ),
    );
    expect(peakLabel("Mont Blanc", "en")).toBe(
      `MONT BLANC · ${groupedAltitude(peakAltitude("Mont Blanc"), "en")} M`,
    );
    expect(peakLabelParts("Dent Blanche", "de", 4357)).toEqual({
      peak: "DENT BLANCHE",
      altitude: "4’357 M",
    });
    expect(peakLabel("Léa")).toBe(peakLabel("Léa", "fr"));
    // Imprimable (dans le jeu de glyphes) dans les quatre langues.
    for (const locale of LOCALES) {
      for (const name of ["Léa", "Ödön", "Œuvre", "Łukasz", "Weiß"]) {
        const model = layoutMontagne(D, { peak: name }, locale);
        expect(
          model.issues.map((i) => i.code),
          `${locale} ${name}`,
        ).toEqual([]);
      }
    }
  });
});

describe("bandes : le socle est la première, verrouillée au dessus du socle", () => {
  it("la première frontière est toujours le dessus du socle, la dernière le sommet, 2 à 4 bandes", () => {
    const rng = mulberry32(2026);
    for (let i = 0; i < 300; i++) {
      const config = randomMontagne(rng);
      expect(config.bands[0].toMm, `#${i}`).toBe(config.plinth);
      expect(config.bands.at(-1)!.toMm, `#${i}`).toBe(
        montagneTotal(config.plinth, config.height),
      );
      expect(config.bands.length).toBeGreaterThanOrEqual(2);
      expect(config.bands.length).toBeLessThanOrEqual(4);
      const thicknesses = config.bands
        .slice(1, -1)
        .map((band, k) => band.toMm - config.bands[k].toMm);
      expect(Math.min(...thicknesses, 99)).toBeGreaterThanOrEqual(2 - 1e-9);
      // Point fixe du bornage.
      expect(clampConfig(config), `#${i}`).toEqual(config);
    }
  });

  it("avec l'étiquette, la bande 1 finit au dessus du socle : l'étiquette (0,8 mm au-dessus) sort dans la teinte de la bande 2", () => {
    const stats = bandStatsFor(D, DEFAULT_TEXTS.montagne);
    expect(stats.bands[0].toMm).toBe(D.plinth);
    const mesh = buildStudioMesh(D, DEFAULT_TEXTS.montagne, {
      lod: "export",
      font,
    });
    // Aucun triangle de la bande 0 au-dessus du socle : la matière au-dessus appartient aux bandes suivantes.
    const band0 = bandMesh(mesh, 0);
    expect(band0.bbox).toBeDefined();
    let maxZ = 0;
    for (let i = 0; i < band0.indices.length; i++)
      maxZ = Math.max(maxZ, mesh.positions[band0.indices[i] * 3 + 2]);
    expect(maxZ).toBeCloseTo(D.plinth, 4);
    // L'étiquette est dans la bande 1 : des triangles de la bande 1 à moins de 0,8 mm du socle.
    const band1 = bandMesh(mesh, 1);
    let labelled = 0;
    for (let i = 0; i < band1.indices.length; i += 3) {
      const z = mesh.positions[band1.indices[i] * 3 + 2];
      if (z > D.plinth + 0.7 && z < D.plinth + 0.85) labelled++;
    }
    expect(labelled).toBeGreaterThan(20);
  });

  it("changer la base, le socle ou la hauteur garde les frontières à la même place relative", () => {
    const next = withMontagneGeometry(D, { height: 100 });
    expect(next.height).toBe(100);
    expect(next.bands[0].toMm).toBe(D.plinth);
    expect(next.bands.at(-1)!.toMm).toBe(105);
    // 40 % et 75 % de la montagne restent à 40 % et 75 %.
    expect((next.bands[1].toMm - D.plinth) / 100).toBeCloseTo(0.4, 1);
    expect((next.bands[2].toMm - D.plinth) / 100).toBeCloseTo(0.75, 1);
    const thicker = withMontagneGeometry(D, { plinth: 7 });
    expect(thicker.bands[0].toMm).toBe(7);
    expect(thicker.bands.at(-1)!.toMm).toBe(82);
    expect(clampConfig(thicker)).toEqual(thicker);
    expect(
      rescaleMontagneBands(
        D.bands,
        { plinth: 5, height: 75 },
        { plinth: 5, height: 75 },
      ),
    ).toEqual(D.bands);
  });

  it("une liste trop courte est complétée, une frontière trop proche écartée (2 mm), un lien décodé ramené", () => {
    expect(normalizeMontagneBands([], 5, 75)).toEqual([
      { filament: "encre", toMm: 5 },
      { filament: "blanc-neve", toMm: 80 },
    ]);
    const squeezed = normalizeMontagneBands(
      [
        { filament: "encre", toMm: 12 },
        { filament: "vert-foret", toMm: 5.4 },
        { filament: "blanc-neve", toMm: 5.6 },
        { filament: "gris-molasse", toMm: 80 },
      ],
      5,
      75,
    );
    expect(squeezed.map((b) => b.toMm)).toEqual([5, 7, 9, 80]);
    expect(
      montagneBands(
        ["encre", "vert-foret", "gris-molasse", "blanc-neve"],
        5,
        75,
      ),
    ).toEqual(D.bands);
    expect(montagneStrataTops(5, 75, 24)).toHaveLength(25);
    expect(montagneStrataTops(5, 75, 24).at(-1)).toBe(80);
  });
});

describe("garde de hauteur : au plus 1,6 fois la base", () => {
  it("le bornage ramène la hauteur sous 1,6 × la base (60 mm : 96 mm ; 75 mm et plus : 120 mm)", () => {
    expect(montagneHeightMax(60)).toBe(96);
    expect(montagneHeightMax(75)).toBe(120);
    expect(montagneHeightMax(120)).toBe(120);
    const tall = clampMontagne({ ...D, size: 60, height: 120 });
    expect(tall.height).toBe(96);
    expect(tall.bands.at(-1)!.toMm).toBe(101);
    expect(clampMontagne({ ...D, size: 90, height: 120 }).height).toBe(120);
  });

  it("une configuration qui passerait le bornage est signalée « à vérifier » (too-tall) avec sa correction", () => {
    const tall: MontagneConfig = { ...D, size: 60, height: 110, label: false };
    const p = checkPrintability(tall);
    expect(p.status).toBe("warn");
    if (p.status === "ok") return;
    const issue = p.issues.find((i) => i.code === "too-tall")!;
    expect(issue.value).toBe(96);
    expect(issue.fix).toMatchObject({ height: 96 });
    expect(clampConfig({ ...tall, ...issue.fix } as MontagneConfig)).toEqual({
      ...tall,
      ...issue.fix,
    });
    expect(checkPrintability(D, DEFAULT_TEXTS.montagne)).toEqual({
      status: "ok",
    });
  });

  it("un texte qui ne tient pas est une erreur `text-fit` (petite base, nom long)", () => {
    const p = checkPrintability(
      { ...D, size: 60 },
      { peak: "WWWWWWWWWWWWWWWW" },
    );
    expect(p.status).toBe("error");
  });
});

describe("maillage : lissé et en strates, coques fermées à chaque niveau de détail", () => {
  const configs: [string, MontagneConfig][] = [
    ["lissé rond", D],
    ["lissé carré", { ...D, shape: "carre", size: 80, form: "massif" }],
    [
      "lissé hexagone",
      { ...D, shape: "hexagone", form: "arete", label: false },
    ],
    ["strates rond", { ...D, style: "strates", levels: 30 }],
    [
      "strates hexagone",
      { ...D, style: "strates", shape: "hexagone", levels: 8 },
    ],
  ];

  it("drag, display (C1 et C2) et export : coques fermées et orientées, hauteur totale = socle + montagne", () => {
    for (const [name, config] of configs) {
      for (const [lod, tier] of [
        ["drag", 2],
        ["display", 1],
        ["display", 2],
        ["export", 2],
      ] as const) {
        const mesh = buildMontagne(config, DEFAULT_TEXTS.montagne, {
          lod,
          tier,
          font,
        });
        const report = checkManifold(mesh);
        const label = `${name} ${lod}${tier}`;
        expect(report.closed, `${label} ${JSON.stringify(report)}`).toBe(true);
        expect(report.degenerateTriangles, `${label}`).toBe(0);
        expect(report.orientationErrors, `${label}`).toBe(0);
        expect(
          Math.min(...report.componentVolumes),
          `${label}`,
        ).toBeGreaterThan(0);
        expect(mesh.bbox[2], `${label}`).toBeCloseTo(0, 6);
        // Le sommet atteint la hauteur choisie ; à basse définition la calotte (1,5 mm) peut tomber entre deux nœuds de la grille.
        const total = montagneTotal(config.plinth, config.height);
        expect(mesh.bbox[5], `${label}`).toBeLessThanOrEqual(total + 1e-4);
        expect(mesh.bbox[5], `${label}`).toBeGreaterThanOrEqual(
          total - (lod === "export" || config.style === "strates" ? 1e-4 : 0.5),
        );
      }
    }
  });

  it("budgets de triangles : drag ≤ 8 k, C1 ≤ 20 k, C2 ≤ 40 k, export ≤ 100 k (lissé, 120 mm de base)", () => {
    const wide: MontagneConfig = clampMontagne({
      ...D,
      size: 120,
      label: false,
      form: "massif",
    });
    const tris = (lod: "drag" | "display" | "export", tier: 1 | 2 = 2) =>
      buildMontagne(wide, undefined, { lod, tier }).triangles;
    expect(tris("drag")).toBeLessThanOrEqual(8_000);
    expect(tris("display", 1)).toBeLessThanOrEqual(20_000);
    expect(tris("display", 2)).toBeLessThanOrEqual(40_000);
    expect(tris("export")).toBeLessThanOrEqual(100_000);
    expect(tris("export")).toBeGreaterThan(tris("display", 2));
    // Un STL d'export reste sous le plafond de 200 k triangles et de quelques Mo.
    const stl = exportStl(wide, {}, { locale: "fr" });
    expect(stl.triangles).toBeLessThanOrEqual(200_000);
    expect(stl.bytes).toBe(84 + 50 * stl.triangles);
  });

  it("déterministe : même configuration, même maillage, octet pour octet", () => {
    const a = buildMontagne(D, DEFAULT_TEXTS.montagne, {
      lod: "display",
      font,
    });
    const b = buildMontagne({ ...D }, DEFAULT_TEXTS.montagne, {
      lod: "display",
      font,
    });
    expect(
      Buffer.from(a.positions.buffer).equals(Buffer.from(b.positions.buffer)),
    ).toBe(true);
    expect(Array.from(a.indices.subarray(0, 3000))).toEqual(
      Array.from(b.indices.subarray(0, 3000)),
    );
  });

  it("le volume du maillage est celui des statistiques (à 0,5 % près en lissé, 3 % en strates)", () => {
    for (const [name, config] of configs) {
      const mesh = buildStudioMesh(config, DEFAULT_TEXTS.montagne, {
        lod: "export",
        font,
      });
      const real = meshVolume(mesh) / 1000;
      const stats = computeStats(config, DEFAULT_TEXTS.montagne);
      const tolerance = config.style === "lisse" ? 0.005 : 0.03;
      expect(Math.abs(stats.volumeCm3 - real) / real, `${name}`).toBeLessThan(
        tolerance,
      );
    }
  });

  it("éclaté d'affichage : une coque fermée par bande (lissé et strates), le socle est la bande 0", () => {
    for (const config of [D, { ...D, style: "strates" as const, levels: 16 }]) {
      const mesh = buildStudioMesh(config, DEFAULT_TEXTS.montagne, {
        lod: "display",
        tier: 1,
        separateBands: true,
        font,
      });
      const bands = new Set(mesh.groups.map((g) => g.band));
      expect([...bands].sort()).toEqual([0, 1, 2, 3]);
      for (const band of bands) {
        const report = checkManifold(bandMesh(mesh, band));
        expect(
          report.closed,
          `${config.style} bande ${band} ${JSON.stringify(report)}`,
        ).toBe(true);
        expect(report.degenerateTriangles, `bande ${band}`).toBe(0);
      }
    }
  });

  it("l'export n'est jamais éclaté : `separateBands` y est ignoré", () => {
    const flat = buildMontagne(D, undefined, { lod: "export" });
    const spread = buildMontagne(D, undefined, {
      lod: "export",
      separateBands: true,
    });
    expect(spread.triangles).toBe(flat.triangles);
  });

  it("aucun surplomb : chaque triangle du dessus de la montagne lissée regarde vers le haut", () => {
    const mesh = buildMontagne({ ...D, label: false }, undefined, {
      lod: "export",
    });
    const p = mesh.positions;
    let down = 0;
    for (let t = 0; t < mesh.triangles; t++) {
      const a = mesh.indices[t * 3] * 3;
      const b = mesh.indices[t * 3 + 1] * 3;
      const c = mesh.indices[t * 3 + 2] * 3;
      const nz =
        (p[b] - p[a]) * (p[c + 1] - p[a + 1]) -
        (p[b + 1] - p[a + 1]) * (p[c] - p[a]);
      const z = (p[a + 2] + p[b + 2] + p[c + 2]) / 3;
      // Les faces du dessous (z = socle ou 0) regardent vers le bas ; au-dessus du socle, jamais.
      if (nz < -1e-9 && z > D.plinth + 0.01) down++;
    }
    expect(down).toBe(0);
  });
});

describe("statistiques et vues exactes", () => {
  it("le défaut : 90 × 90 × 80 mm, 400 couches, 3 changements, imprimable, sans CHF, quelques dizaines de grammes", () => {
    const stats = computeStats(D, DEFAULT_TEXTS.montagne);
    expect(stats.widthMm).toBe(90);
    expect(stats.depthMm).toBe(90);
    expect(stats.heightMm).toBe(80);
    expect(stats.layers).toBe(400);
    expect(stats.changes).toBe(3);
    expect(stats.purgeGrams).toBe(2.4);
    expect(stats.printable).toEqual({ status: "ok" });
    expect(stats.grams).toBeGreaterThan(20);
    expect(stats.grams).toBeLessThan(90);
    expect(stats.minutes).toBeGreaterThan(30);
  });

  it("l'hexagone est mesuré hors tout : 90 entre côtés plats, ≈ 103,9 entre sommets", () => {
    const stats = computeStats(
      { ...D, shape: "hexagone" },
      DEFAULT_TEXTS.montagne,
    );
    expect(stats.depthMm).toBe(90);
    expect(stats.widthMm).toBeGreaterThan(102);
    expect(stats.widthMm).toBeLessThan(104.2);
  });

  it("plus haute, plus de grammes ; l'étiquette ajoute de la matière", () => {
    const low = computeStats(
      { ...D, height: 40, bands: normalizeMontagneBands(D.bands, 5, 40) },
      DEFAULT_TEXTS.montagne,
    );
    const high = computeStats(D, DEFAULT_TEXTS.montagne);
    expect(high.grams).toBeGreaterThan(low.grams);
    const without = computeStats({ ...D, label: false }, {});
    expect(without.heightMm).toBe(high.heightMm);
  });

  it("la somme des masses par bande plus la purge est la masse des statistiques", () => {
    for (const config of [D, ...MONTAGNE_PRESETS.map((p) => p.config)]) {
      const summary = bandStatsFor(config, DEFAULT_TEXTS.montagne);
      const stats = computeStats(config, DEFAULT_TEXTS.montagne);
      const grams = summary.bands.reduce((sum, b) => sum + b.grams, 0);
      expect(Math.abs(grams + summary.purgeGrams - stats.grams)).toBeLessThan(
        0.1 * summary.bands.length + 0.06,
      );
      expect(summary.bands.at(-1)!.toLayer).toBe(stats.layers);
    }
  });

  it("l'analyse : volumes par bande positifs, pied de la montagne dans le socle", () => {
    const a = analyzeMontagne(layoutMontagne(D, DEFAULT_TEXTS.montagne));
    expect(a.bandVolumesMm3).toHaveLength(4);
    for (const v of a.bandVolumesMm3) expect(v).toBeGreaterThan(0);
    expect(a.footMm2).toBeGreaterThan(1000);
    expect(a.footMm2).toBeLessThan(a.plinthMm2);
  });

  it("l'élévation : silhouette exacte, bandes jusqu'au sommet, une ligne de couche toutes les 10 couches", () => {
    const e = montagneElevation(D);
    expect(e.heightMm).toBe(80);
    expect(e.widthMm).toBe(90);
    expect(e.bands).toHaveLength(4);
    expect(e.bands.map((b) => b.filament)).toEqual(
      D.bands.map((b) => b.filament),
    );
    expect(e.outline.startsWith("M")).toBe(true);
    expect(e.courses).toHaveLength(39);
    expect(e.viewBox[3]).toBeCloseTo(80 + 12, 6);
    // Strates : la silhouette est un escalier, toujours aussi haute.
    const s = montagneElevation({ ...D, style: "strates" });
    expect(s.heightMm).toBe(80);
  });

  it("le plan : le socle puis une courbe de niveau tous les 2 mm ; en strates, un contour par strate", () => {
    const smooth = montagneTopView(D, undefined, { label: false });
    expect(smooth.layers[0].role).toBe("plate");
    expect(smooth.layers.length).toBeGreaterThan(20);
    const stepped = montagneTopView(
      { ...D, style: "strates", levels: 12 },
      undefined,
      {
        label: false,
      },
    );
    expect(stepped.layers).toHaveLength(1 + 12);
  });
});

describe("schémas, URL et agents", () => {
  it("aller-retour du fragment et des paramètres GET, altitude saisie comprise ; aucun texte dans le lien", () => {
    const configs = [
      D,
      { ...D, altMode: "saisie" as const, altitude: 4357 },
      {
        ...D,
        style: "strates" as const,
        levels: 31,
        shape: "hexagone" as const,
      },
      ...MONTAGNE_PRESETS.map((p) => p.config),
    ];
    for (const config of configs) {
      const value = encodeConfig(config);
      expect(decodeConfig("montagne", value, D)).toEqual({ ok: true, config });
      const get = decodeSearchParams(
        "montagne",
        new URLSearchParams(encodeSearchParams(config)),
        D,
      );
      expect(get).toMatchObject({ ok: true, config });
      expect(Object.keys(toShortKeys(config)).sort()).toEqual(
        [
          "sh",
          "s",
          "pl",
          "h",
          "f",
          "st",
          "sd",
          "sy",
          "lv",
          "bd",
          "lb",
          "am",
          "al",
        ].sort(),
      );
      expect(machineLine(config)).not.toMatch(/peak|Léa/);
      expect(value.length).toBeLessThanOrEqual(600);
    }
  });

  it("une hauteur sans `bd` entraîne les bandes du défaut ; une clé inconnue ou un texte est refusé", () => {
    const decoded = decodeSearchParams("montagne", { h: "100", pl: "6" }, D);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok || decoded.config.object !== "montagne") return;
    expect(decoded.config.bands[0].toMm).toBe(6);
    expect(decoded.config.bands.at(-1)!.toMm).toBe(106);
    expect(decodeSearchParams("montagne", { peak: "Léa" }, D)).toMatchObject({
      ok: false,
      error: "text-key",
    });
    expect(parseConfig("montagne", { ...D, extra: 1 }).ok).toBe(false);
  });

  it("les plages sont celles du cahier des charges", () => {
    const R = MONTAGNE_RANGES;
    expect([R.size.min, R.size.max, R.size.default]).toEqual([60, 120, 90]);
    expect([R.plinth.min, R.plinth.max, R.plinth.default]).toEqual([4, 8, 5]);
    expect([R.height.min, R.height.max, R.height.default]).toEqual([
      30, 120, 75,
    ]);
    expect([R.levels.min, R.levels.max]).toEqual([8, 40]);
    expect([R.altitude.min, R.altitude.max]).toEqual([0, 8848]);
    expect(D).toMatchObject({
      shape: "rond",
      form: "pic",
      style: "lisse",
      label: true,
      altMode: "fictive",
    });
  });
});
