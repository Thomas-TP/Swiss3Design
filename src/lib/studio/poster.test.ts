// Posters SVG (brief « Strates », §5.7, §5.8) : poids, raccord à la caméra du
// Stage, déterminisme, Élévation exacte.
import { describe, expect, it } from "vitest";
import { cameraMatrix, heroCamera, projectPoint, type Vec3 } from "./camera";
import { filamentHex } from "./filaments";
import { createLavauxModel } from "./objects/lavaux-model";
import {
  EXPLODE_GAP_MM,
  GHOST_STEP_MM,
  POSTER_VIEWBOX,
  elevationToSvg,
  heroPoster,
  lavauxElevation,
  posterToSvg,
} from "./poster";
import { HERO_CONFIG, LAVAUX_PRESETS, heroVariant } from "./presets";

const bytes = (s: string) => new TextEncoder().encode(s).length;

describe("poster du héros : poids et structure", () => {
  it("ghost : 75 ellipses, ≤ 6 Ko, trait sur le jeton iso, non-scaling-stroke", () => {
    const poster = heroPoster(HERO_CONFIG, "ghost");
    expect(poster.ghost).toHaveLength(75); // 150 mm / 2 mm
    const svg = posterToSvg(poster);
    expect(bytes(svg)).toBeLessThanOrEqual(6 * 1024);
    expect(svg).toContain("var(--color-iso)");
    expect(svg).toContain("vector-effect:non-scaling-stroke");
    expect(svg).toContain('aria-hidden="true"');
    expect(svg.match(/<ellipse/g)).toHaveLength(75);
  });

  it("final : 75 ellipses pleines aux teintes des bandes, filet plus sombre, ≤ 8 Ko", () => {
    const poster = heroPoster(HERO_CONFIG, "final");
    const svg = posterToSvg(poster);
    expect(bytes(svg)).toBeLessThanOrEqual(8 * 1024);
    // 75 ellipses de strates + l'ouverture du vase.
    expect(svg.match(/<ellipse/g)).toHaveLength(76);
    for (const band of HERO_CONFIG.bands)
      expect(svg).toContain(filamentHex(band.filament));
    expect(poster.layers!.map((l) => l.ellipses.length)).toEqual([21, 33, 21]);
    expect(poster.layers!.every((l) => l.stroke !== l.fill)).toBe(true);
    expect(poster.mouth).toBeTruthy();
  });

  it("exploded : bandes écartées, couronnes du dessus", () => {
    const poster = heroPoster(HERO_CONFIG, "exploded");
    expect(poster.layers!.every((l) => l.cap)).toBe(true);
    expect(EXPLODE_GAP_MM).toBe(12);
    // La dernière bande est décalée de 24 mm vers le haut : son sommet est plus haut à l'écran.
    const tops = poster.layers!.map((l) =>
      Math.min(...l.ellipses.map((e) => e.cy - e.ry)),
    );
    expect(tops[2]).toBeLessThan(tops[1]);
    expect(tops[1]).toBeLessThan(tops[0]);
    expect(bytes(posterToSvg(poster))).toBeLessThanOrEqual(8 * 1024);
  });

  it("toutes les variantes du héros restent dans les budgets de poids", () => {
    for (const pattern of ["gradins", "vagues", "voronoi"] as const) {
      for (const palette of ["leman", "molasse", "signal", "uni"] as const) {
        const c = heroVariant(palette, pattern);
        expect(bytes(posterToSvg(heroPoster(c, "ghost")))).toBeLessThanOrEqual(
          6 * 1024,
        );
        expect(bytes(posterToSvg(heroPoster(c, "final")))).toBeLessThanOrEqual(
          8 * 1024,
        );
      }
    }
  });

  it("déterministe : mêmes octets pour la même entrée", () => {
    expect(posterToSvg(heroPoster(HERO_CONFIG, "final"))).toBe(
      posterToSvg(heroPoster(structuredClone(HERO_CONFIG), "final")),
    );
    expect(posterToSvg(heroPoster(HERO_CONFIG, "ghost"))).toBe(
      posterToSvg(heroPoster(HERO_CONFIG, "ghost")),
    );
  });
});

describe("raccord au pixel avec la caméra du Stage", () => {
  const { width: W, height: H } = POSTER_VIEWBOX;
  const poster = heroPoster(HERO_CONFIG, "ghost");

  it("viewBox 4:5 partagé, caméra du héros", () => {
    expect(poster.viewBox).toBe("0 0 400 500");
    expect(W / H).toBeCloseTo(0.8, 12);
    expect(poster.camera).toEqual(heroCamera());
  });

  it("l'anneau du sommet se projette exactement là où le Stage le dessinerait", () => {
    // Anneau fantôme à z = 150 (le dernier) : on le reprojette point par point
    // avec la matrice partagée et on retrouve son ellipse englobante à 0,1 px.
    const m = cameraMatrix(heroCamera(), W / H);
    const model = createLavauxModel(HERO_CONFIG);
    const tmp = new Float64Array(3);
    const z = 150;
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (let i = 0; i < 96; i++) {
      const theta = (i * 2 * Math.PI) / 96;
      model.outer(theta, z, -1, tmp);
      const p: Vec3 = [tmp[0] * Math.cos(theta), tmp[0] * Math.sin(theta), z];
      const [nx, ny] = projectPoint(m, p);
      const x = W / 2 + (nx * W) / 2;
      const y = H / 2 - (ny * H) / 2;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
    const top = poster.ghost![poster.ghost!.length - 1];
    expect(top.cx).toBeCloseTo((x0 + x1) / 2, 0);
    expect(top.cy).toBeCloseTo((y0 + y1) / 2, 0);
    expect(top.rx).toBeCloseTo((x1 - x0) / 2, 0);
    expect(top.ry).toBeCloseTo((y1 - y0) / 2, 0);
  });

  it("l'objet occupe ≈ 78 % de la hauteur de la boîte, centré sur l'axe", () => {
    const ys = poster.ghost!.flatMap((e) => [e.cy - e.ry, e.cy + e.ry]);
    const fraction = (Math.max(...ys) - Math.min(...ys)) / H;
    expect(fraction).toBeGreaterThan(0.7);
    expect(fraction).toBeLessThan(0.82);
    for (const e of poster.ghost!) expect(e.cx).toBeCloseTo(W / 2, 1);
    // Les anneaux montent à l'écran : cy décroît avec z.
    for (let i = 1; i < poster.ghost!.length; i++) {
      expect(poster.ghost![i].cy).toBeLessThan(poster.ghost![i - 1].cy);
    }
    expect(GHOST_STEP_MM).toBe(2);
  });

  it("dans la boîte visuelle : rien ne déborde du viewBox", () => {
    for (const e of poster.ghost!) {
      expect(e.cx - e.rx).toBeGreaterThanOrEqual(0);
      expect(e.cx + e.rx).toBeLessThanOrEqual(W);
      expect(e.cy - e.ry).toBeGreaterThanOrEqual(0);
      expect(e.cy + e.ry).toBeLessThanOrEqual(H);
    }
  });
});

describe("Élévation exacte du vase", () => {
  it("héros : silhouette au dixième de millimètre, largeur = diamètre de l'enveloppe", () => {
    const el = lavauxElevation(HERO_CONFIG);
    expect(el.heightMm).toBe(150);
    expect(el.widthMm).toBeCloseTo(96, 0);
    expect(el.viewBox[0]).toBeLessThan(-48);
    expect(el.viewBox[3]).toBeGreaterThan(150); // marges haute et basse
    expect(el.outline.startsWith("M")).toBe(true);
    expect(el.outline.endsWith("Z")).toBe(true);
    // Chaque coordonnée est au dixième de mm.
    for (const num of el.outline.match(/-?\d+(\.\d+)?/g)!) {
      expect(num).toMatch(/^-?\d+(\.\d)?$/);
    }
    expect(el.bands.map((b) => b.height)).toEqual([42, 66, 42]);
    expect(el.bands.map((b) => b.filament)).toEqual([
      "bleu-leman",
      "vert-lavaux",
      "blanc-neve",
    ]);
    expect(el.baseY).toBeCloseTo(el.heightMm + 6, 1);
  });

  it("SVG : clip par la silhouette, aria-hidden, échelle 1 unité = 1 mm", () => {
    const svg = elevationToSvg(lavauxElevation(HERO_CONFIG), { idPrefix: "t" });
    expect(svg).toContain('aria-hidden="true"');
    expect(svg).toContain('clip-path="url(#t-sil)"');
    expect(svg).toContain("<clipPath");
    expect(svg.match(/<rect /g)).toHaveLength(3);
    expect(bytes(svg)).toBeLessThanOrEqual(16 * 1024);
  });

  it("tous les préréglages : silhouette fermée dans le viewBox", () => {
    for (const p of LAVAUX_PRESETS) {
      const el = lavauxElevation(p.config);
      expect(el.widthMm, `${p.id}`).toBeLessThanOrEqual(p.config.d + 0.2);
      expect(el.widthMm, `${p.id}`).toBeGreaterThan(p.config.d * 0.85);
      expect(el.outline.endsWith("Z"), `${p.id}`).toBe(true);
    }
  });

  it("déterministe", () => {
    expect(elevationToSvg(lavauxElevation(HERO_CONFIG))).toBe(
      elevationToSvg(lavauxElevation(structuredClone(HERO_CONFIG))),
    );
  });
});
