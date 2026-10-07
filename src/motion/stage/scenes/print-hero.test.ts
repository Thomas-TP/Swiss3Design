import { PerspectiveCamera, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { cameraEye, heroCamera, toThreeWorld } from "@/lib/studio/camera";
import {
  PLATE_MM,
  PLATE_RADIUS_MM,
  PLATE_THICKNESS_MM,
  heroPoster,
} from "@/lib/studio/poster";
import { HERO_CONFIG } from "@/lib/studio/presets";
import {
  bandOfCut,
  cameraAt,
  easeBuse,
  easeVague,
  expandBands,
  ghostRise,
} from "./print-hero";

// La logique pure de la scène du héros (la partie WebGL se vérifie dans le
// navigateur) : vague de couleur, frontières de bande, bascule en plan,
// montée de la silhouette, raccord du plateau du poster.
describe("print-hero · logique pure", () => {
  it("la vague de couleur glisse (aucun palier), monotone, de 0 à 1", () => {
    let previous = -1;
    let largest = 0;
    for (let i = 0; i <= 300; i++) {
      const value = easeVague(i / 300);
      expect(value).toBeGreaterThanOrEqual(previous - 1e-12);
      if (i > 0) largest = Math.max(largest, value - previous);
      previous = value;
    }
    expect(easeVague(0)).toBe(0);
    expect(easeVague(1)).toBeCloseTo(1, 12);
    // Un pas de 1/300 du temps ne fait jamais avancer le front de plus de 1 % :
    // l'ancienne quantification en 30 paliers sautait de 3,3 % d'un coup.
    expect(largest).toBeLessThan(0.011);
  });

  it("la réimpression s'adoucit aux deux bouts", () => {
    expect(easeBuse(0)).toBe(0);
    expect(easeBuse(1)).toBe(1);
    expect(easeBuse(0.5)).toBe(0.5);
    expect(easeBuse(0.1)).toBeLessThan(0.1);
    expect(easeBuse(0.9)).toBeGreaterThan(0.9);
  });

  it("« Uni » répète sa teinte sur les trois frontières", () => {
    const bands = expandBands(["blanc-neve"], [42, 108, 150]);
    expect(bands.map((b) => b.topMm)).toEqual([42, 108, 150]);
    expect(new Set(bands.map((b) => b.color)).size).toBe(1);
    const leman = expandBands(
      ["bleu-leman", "vert-lavaux", "blanc-neve"],
      [42, 108, 150],
    );
    expect(new Set(leman.map((b) => b.color)).size).toBe(3);
  });

  it("une frontière appartient à la bande du dessous, la couche suivante à celle du dessus", () => {
    const bounds = [42, 108, 150];
    expect(bandOfCut(0, bounds)).toBe(0);
    expect(bandOfCut(42, bounds)).toBe(0); // couche 210 : dernière de la bande 1
    expect(bandOfCut(42.2, bounds)).toBe(1); // couche 211 : changement de filament
    expect(bandOfCut(108, bounds)).toBe(1);
    expect(bandOfCut(108.2, bounds)).toBe(2);
    expect(bandOfCut(150, bounds)).toBe(2);
  });

  it("la silhouette de la forme finale naît avec les premières couches, jamais avant", () => {
    // Rien avant la première couche : le poster du plateau n'en montre aucune.
    expect(ghostRise(0)).toBe(0);
    expect(ghostRise(-1)).toBe(0);
    // Pleine à 12 mm (60 couches), et continue : aucun saut.
    expect(ghostRise(12)).toBe(1);
    expect(ghostRise(150)).toBe(1);
    let previous = 0;
    for (let z = 0; z <= 12; z += 0.2) {
      const value = ghostRise(z);
      expect(value).toBeGreaterThanOrEqual(previous);
      expect(value - previous).toBeLessThan(0.06); // une couche : ≤ 6 % de la montée
      previous = value;
    }
  });

  it("le plateau du poster SSR tombe sur celui de la scène, au dixième de pixel", () => {
    // Même caméra, même projection : la première frame WebGL se superpose au
    // poster (« raccord au pixel », §5.7). On projette le contour du plateau de
    // la scène avec three, tel que print-hero le fait, et on le compare aux
    // sommets du chemin du poster.
    const W = 541;
    const H = 676;
    const spec = heroCamera();
    const camera = new PerspectiveCamera(spec.fovDeg, W / H, 20, 3000);
    const eye = toThreeWorld(cameraEye(spec));
    const target = toThreeWorld(spec.target);
    camera.position.set(eye[0], eye[1], eye[2]);
    camera.lookAt(new Vector3(target[0], target[1], target[2]));
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();
    const poster = heroPoster(HERO_CONFIG, "plate");
    const scale = W / poster.width;
    const half = PLATE_MM / 2;
    const r = PLATE_RADIUS_MM;
    const corners = [
      [half - r, -half + r, -90],
      [half - r, half - r, 0],
      [-half + r, half - r, 90],
      [-half + r, -half + r, 180],
    ];
    const pairs = (d: string) => {
      const v = (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
      return Array.from({ length: v.length / 2 }, (_, i) => [
        v[2 * i],
        v[2 * i + 1],
      ]);
    };
    // Dessus (y = 0 en monde three) puis épaisseur (−1 mm) ; axes du modèle (x, y) → three (x, −y).
    for (const [path, y] of [
      [poster.plate!.top, 0],
      [poster.plate!.base, -PLATE_THICKNESS_MM],
    ] as const) {
      const drawn = pairs(path);
      expect(drawn).toHaveLength(36);
      let k = 0;
      for (const [cx, cy, start] of corners)
        for (let i = 0; i <= 8; i++) {
          const a = ((start + (i * 90) / 8) * Math.PI) / 180;
          const p = new Vector3(
            cx + r * Math.cos(a),
            y,
            -(cy + r * Math.sin(a)),
          ).project(camera);
          const px = ((p.x + 1) / 2) * W;
          const py = ((1 - p.y) / 2) * H;
          expect(Math.abs(px - drawn[k][0] * scale)).toBeLessThan(0.5);
          expect(Math.abs(py - drawn[k][1] * scale)).toBeLessThan(0.5);
          k++;
        }
    }
    // Quadrillage : les extrémités de la ligne centrale (x = 0).
    const grid = pairs(poster.plate!.grid);
    const [gx0, gy0] = grid[24]; // ligne x = 0 : 6e des 13 lignes, 4 points par ligne
    const a = new Vector3(0, 0.02, half).project(camera);
    expect(Math.abs(((a.x + 1) / 2) * W - gx0 * scale)).toBeLessThan(0.3);
    expect(Math.abs(((1 - a.y) / 2) * H - gy0 * scale)).toBeLessThan(0.3);
  });

  it("la bascule va de la caméra du héros à la vue de plan, fov 20° → 12°", () => {
    const base = heroCamera();
    const start = cameraAt(0, base, 96);
    expect(start.fovDeg).toBe(20);
    expect(start.elevationDeg).toBe(22);
    expect(start.azimuthDeg).toBe(-28);
    expect(start.distance).toBeCloseTo(base.distance, 9);
    const end = cameraAt(1, base, 96);
    expect(end.fovDeg).toBe(12);
    expect(end.elevationDeg).toBeGreaterThan(89);
    expect(end.elevationDeg).toBeLessThan(90);
    // À mi-chemin, entre les deux (le mouvement est continu).
    const mid = cameraAt(0.5, base, 96);
    expect(mid.fovDeg).toBeCloseTo(16, 9);
    expect(mid.elevationDeg).toBeGreaterThan(start.elevationDeg);
    expect(mid.elevationDeg).toBeLessThan(end.elevationDeg);
  });
});
