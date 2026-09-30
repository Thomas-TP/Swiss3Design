// Caméra et projection pures (brief « Strates », §5.3, §5.7) : mêmes
// conventions que three (Matrix4.lookAt / makePerspective), sans importer
// three (règle d'or 11) : on vérifie les propriétés géométriques que le Stage
// et les posters doivent partager.
import { describe, expect, it } from "vitest";
import {
  HERO_VIEW,
  cameraEye,
  cameraMatrix,
  heroCamera,
  heroCameraFor,
  lavauxOutline,
  mat4Identity,
  mat4LookAt,
  mat4Multiply,
  mat4Perspective,
  projectPoint,
  toThreeWorld,
  verticalExtent,
  type CameraSpec,
  type Vec3,
} from "./camera";
import { HERO_CONFIG, heroVariant } from "./presets";

const RAD = Math.PI / 180;

describe("matrices", () => {
  it("lookAt : l'œil va à l'origine, la cible à −distance sur Z, le haut reste en haut", () => {
    const eye: Vec3 = [120, -300, 240];
    const target: Vec3 = [0, 0, 75];
    const view = mat4LookAt(eye, target, [0, 0, 1]);
    const [ex, ey, ez] = projectPoint(mat4Multiply(mat4Identity(), view), eye);
    void ex;
    void ey;
    void ez;
    const apply = (p: Vec3): Vec3 => [
      view[0] * p[0] + view[4] * p[1] + view[8] * p[2] + view[12],
      view[1] * p[0] + view[5] * p[1] + view[9] * p[2] + view[13],
      view[2] * p[0] + view[6] * p[1] + view[10] * p[2] + view[14],
    ];
    const atEye = apply(eye);
    expect(Math.hypot(...atEye)).toBeLessThan(1e-9);
    const atTarget = apply(target);
    expect(atTarget[0]).toBeCloseTo(0, 9);
    expect(atTarget[1]).toBeCloseTo(0, 9);
    expect(atTarget[2]).toBeCloseTo(-Math.hypot(120, 300, 165), 9);
    // Un point plus haut que la cible est au-dessus dans l'écran (y > 0).
    expect(apply([0, 0, 200])[1]).toBeGreaterThan(0);
  });

  it("perspective : un point au bord du champ vertical tombe à NDC y = ±1", () => {
    const m = mat4Perspective(20, 1.25, 1, 1000);
    const d = 100;
    const half = d * Math.tan(10 * RAD);
    const [x, y] = projectPoint(m, [0, half, -d]);
    expect(x).toBeCloseTo(0, 12);
    expect(y).toBeCloseTo(1, 12);
    // Le champ horizontal suit l'aspect (largeur = 1,25 × hauteur).
    expect(projectPoint(m, [half * 1.25, 0, -d])[0]).toBeCloseTo(1, 12);
  });

  it("produit de matrices : l'identité est neutre, l'ordre compte", () => {
    const a = mat4Perspective(30, 1, 1, 100);
    const b = mat4LookAt([0, -10, 5], [0, 0, 0], [0, 0, 1]);
    expect(Array.from(mat4Multiply(mat4Identity(), a))).toEqual(Array.from(a));
    expect(Array.from(mat4Multiply(a, mat4Identity()))).toEqual(Array.from(a));
    expect(Array.from(mat4Multiply(a, b))).not.toEqual(
      Array.from(mat4Multiply(b, a)),
    );
  });
});

describe("caméra d'orbite", () => {
  const spec: CameraSpec = {
    fovDeg: 20,
    azimuthDeg: -28,
    elevationDeg: 22,
    distance: 500,
    target: [0, 0, 75],
  };

  it("l'œil est à la distance voulue, à l'élévation voulue, côté azimut", () => {
    const eye = cameraEye(spec);
    const rel: Vec3 = [eye[0] - 0, eye[1] - 0, eye[2] - 75];
    expect(Math.hypot(...rel)).toBeCloseTo(500, 9);
    expect(Math.asin(rel[2] / 500) / RAD).toBeCloseTo(22, 9);
    // Azimut −28° depuis +Z du monde three vers +X : l'œil est à gauche (x < 0) et devant (y < 0 en Z haut).
    expect(rel[0]).toBeLessThan(0);
    expect(rel[1]).toBeLessThan(0);
  });

  it("toThreeWorld : rotation de −90° autour de X (Z haut → Y haut)", () => {
    expect(toThreeWorld([1, 2, 3])).toEqual([1, 3, -2]);
    // L'œil dans le monde three a la même élévation et le même azimut.
    const w = toThreeWorld(cameraEye({ ...spec, target: [0, 0, 0] }));
    expect(Math.asin(w[1] / 500) / RAD).toBeCloseTo(22, 9);
    expect(Math.atan2(w[0], w[2]) / RAD).toBeCloseTo(-28, 9);
  });

  it("la cible projette au centre de l'écran", () => {
    const [x, y] = projectPoint(cameraMatrix(spec, 0.8), spec.target);
    expect(x).toBeCloseTo(0, 9);
    expect(y).toBeCloseTo(0, 9);
  });
});

describe("caméra du héros", () => {
  const spec = heroCamera();

  it("fov 20°, élévation 22°, azimut −28°", () => {
    expect(spec.fovDeg).toBe(20);
    expect(spec.elevationDeg).toBe(22);
    expect(spec.azimuthDeg).toBe(-28);
    expect(HERO_VIEW.fraction).toBe(0.78);
  });

  it("l'objet occupe 78 % de la hauteur de la vue, centré verticalement", () => {
    const [lo, hi] = verticalExtent(spec, lavauxOutline(HERO_CONFIG));
    // NDC : toute la hauteur vaut 2.
    expect((hi - lo) / 2).toBeCloseTo(0.78, 6);
    expect((hi + lo) / 2).toBeCloseTo(0, 6);
  });

  it("calculée une fois, déterministe, et la cible est sur l'axe du vase", () => {
    expect(heroCamera()).toBe(spec);
    expect(heroCameraFor(HERO_CONFIG)).toEqual(spec);
    expect(spec.target[0]).toBe(0);
    expect(spec.target[1]).toBe(0);
    expect(spec.target[2]).toBeGreaterThan(60);
    expect(spec.target[2]).toBeLessThan(90);
  });

  it("un autre vase est recadré à la même part de hauteur", () => {
    const tall = heroVariant("leman", "vagues");
    const other = {
      ...tall,
      h: 200,
      bands: [{ filament: "encre", toMm: 200 }],
    } as typeof tall;
    const c = heroCameraFor(other);
    const [lo, hi] = verticalExtent(c, lavauxOutline(other));
    expect((hi - lo) / 2).toBeCloseTo(0.78, 6);
    expect(c.distance).toBeGreaterThan(spec.distance);
  });
});
