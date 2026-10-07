// Scène `print-hero` (brief « Strates », §5.3) : le vase « Lavaux » du héros de
// l'accueil, imprimé couche par couche sur son plateau, et le même vase éclaté
// du chapitre 01 (props.mode). Une instance par vue ; le matériau d'impression
// (materials/print-material.ts) est partagé avec le Studio.
//
// Ce que la scène sait faire, tout cela sans GSAP (la chorégraphie n'anime que
// les propriétés du contrôleur) :
//  - hauteur imprimée quantifiée à la couche (`progress`), liseré chaud de la
//    buse, flash à chaque changement de filament (320 ms) ;
//  - au-dessus de la coupe, la silhouette pleine et très discrète de la forme
//    finale (jamais un trait) : elle naît avec les premières couches (12 mm),
//    jamais avant que l'impression ne commence, et suit la hauteur imprimée ;
//  - vague de couleur (`ripple`, 0,9 s, front continu) quand la palette change ;
//  - réimpression (`reprint`, 1,2 s) quand le motif change : l'ancien maillage
//    garde le dessus, le nouveau « sort » du plateau, la buse suit le front ;
//  - bascule en vue de plan (`tilt`) : la caméra monte à 90° et le champ se
//    resserre (fov 20° → 12°), les teintes deviennent des aplats hypsométriques ;
//  - éclaté (`explode`) : une coque fermée par bande, écartées de 12 mm.
// Les maillages viennent des générateurs purs de src/lib/studio (jamais d'un
// calcul de forme ici) ; les trois motifs sont générés au repos après la
// première frame.
import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DirectionalLight,
  ExtrudeGeometry,
  FrontSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  Shape,
  SRGBColorSpace,
  Vector3,
  BoxGeometry,
} from "three";
import { READOUT_INTERVAL_MS } from "@/components/home/contract";
import type { PrintHeroProps } from "@/components/home/stage-props";
import type { HeroPatternKey } from "@/components/home/hero-data";
import {
  cameraEye,
  heroCamera,
  heroCameraFor,
  toThreeWorld,
  type CameraSpec,
} from "@/lib/studio/camera";
import { filamentHex } from "@/lib/studio/filaments";
import {
  PLATE_GRID_MM,
  PLATE_MM,
  PLATE_RADIUS_MM,
  PLATE_THICKNESS_MM,
} from "@/lib/studio/poster";
import { buildLavaux } from "@/lib/studio/objects/lavaux";
import {
  bandIndexAt,
  createLavauxModel,
  type LavauxModel,
} from "@/lib/studio/objects/lavaux-model";
import type {
  FilamentId,
  LavauxConfig,
  LavauxPattern,
  MeshData,
} from "@/lib/studio/types";
import { meshToGeometry } from "../geometry";
import {
  createPrintMaterial,
  quantizeToLayer,
  type PrintBand,
  type PrintMaterial,
} from "../materials/print-material";
import type { StageContext, StageScene, StageTheme } from "../types";

export interface PrintHeroController {
  /** 0–1 : hauteur imprimée = quantize(progress × h, 0,2 mm). */
  progress: number;
  /** 0 = élévation à 22°, 1 = vue de plan (fov 12°, mode carte). */
  tilt: number;
  /** 0–1 : écartement des bandes (12 mm au plus), mode « éclaté ». */
  explode: number;
  /** Silhouette discrète de la forme finale au-dessus de la coupe (1 = permise). */
  ghost: 0 | 1;
  /** Vague de couleur vers la palette donnée (une teinte par bande), 0,9 s. */
  ripple(palette: readonly FilamentId[]): void;
  /** Réimpression depuis le plateau avec le motif donné, 1,2 s. */
  reprint(pattern: LavauxPattern): void;
  /** Couche courante (≤ 10 Hz). */
  onLayer?: (layer: number, zMm: number, band: number) => void;
}

const RIPPLE_S = 0.9;
const REPRINT_S = 1.2;
const FLASH_S = 0.32;
const PARK_S = 0.8;
const NOZZLE_RATE = 2.4; // rad/s pendant l'impression
const EXPLODE_GAP_MM = 12;
// Plateau : 120 mm au lieu des 180 mm du brief (constantes partagées avec le
// poster SSR, src/lib/studio/poster.ts : même contour, même quadrillage). À 78 %
// de la hauteur de la vue (fov 20°, azimut −28°), la boîte 4:5 ne montre que
// ≈ 168 mm de large : un plateau de 180 mm serait coupé net par le bord de la
// vue. 120 mm tient entier (carré tourné de 28° : 162 mm de large), et le
// grillage garde 10 mm.
const PARK = { x: 50, lift: 10 } as const;
// Silhouette de la forme finale : elle apparaît sur les 12 premiers millimètres
// imprimés (60 couches, ≈ 0,7 s d'intro) et s'efface en 0,25 s si la
// réimpression la rend caduque. Opacité de pleine silhouette : « presque
// transparente », un cran plus marquée sur fond sombre où l'encre est claire.
const GHOST_RISE_MM = 12;
const GHOST_GATE_RATE = 12;
const GHOST_ALPHA = { light: 0.075, dark: 0.1 } as const;
// L'ombre de contact grandit avec le premier centimètre imprimé : un plateau nu
// n'a pas d'ombre (et le poster SSR du plateau n'en dessine pas).
const SHADOW_RISE_MM = 15;
const ABOVE_ALL_MM = 1e6;
const PLAN = { fov: 12, elevation: 89.5, fraction: 0.6 } as const;
const RAD = Math.PI / 180;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

/**
 * Ease de la vague de couleur : continue (entrée et sortie douces), monotone.
 * Le brief la voulait quantifiée en 30 paliers (`pas(30)`) ; le propriétaire a
 * décidé le 01.10.2026 qu'aucune animation du site n'avance par paliers : le
 * front de la vague glisse, il ne saute plus de 5 mm toutes les 30 ms.
 */
export function easeVague(p: number): number {
  const t = clamp01(p);
  return t * t * (3 - 2 * t);
}

/** Ease `s3d.buse` de la réimpression : entrée et sortie douces. */
export function easeBuse(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/** Une bande par frontière : « Uni » (un seul filament) répète sa teinte sur les trois. */
export function expandBands(
  filaments: readonly FilamentId[],
  boundaries: readonly number[],
): PrintBand[] {
  return boundaries.map((topMm, k) => ({
    topMm,
    color: filamentHex(filaments[Math.min(k, filaments.length - 1)]),
  }));
}

/** Indice de bande d'une hauteur imprimée : le nombre de frontières strictement sous elle. */
export function bandOfCut(
  cutMm: number,
  boundaries: readonly number[],
): number {
  let band = 0;
  for (let k = 0; k < boundaries.length - 1; k++)
    if (cutMm > boundaries[k] + 1e-9) band = k + 1;
  return band;
}

/**
 * Caméra à un instant de la bascule : de l'élévation 22° (fov 20°) à la vue de
 * plan (fov 12°, 89,5° pour garder un « haut » défini). La distance du plan est
 * celle qui donne au vase `PLAN.fraction` de la hauteur de la vue.
 */
export function cameraAt(
  tilt: number,
  base: CameraSpec,
  diameterMm: number,
): CameraSpec {
  const fov = lerp(base.fovDeg, PLAN.fov, tilt);
  const planDistance =
    diameterMm / PLAN.fraction / (2 * Math.tan((PLAN.fov / 2) * RAD));
  return {
    fovDeg: fov,
    azimuthDeg: lerp(base.azimuthDeg, 0, tilt),
    elevationDeg: lerp(base.elevationDeg, PLAN.elevation, tilt),
    distance: lerp(base.distance, planDistance, tilt),
    target: base.target,
  };
}

/** Montée en douceur (0 → 1) de la silhouette avec les premiers millimètres imprimés. */
export function ghostRise(cutMm: number): number {
  const t = clamp01(cutMm / GHOST_RISE_MM);
  return t * t * (3 - 2 * t);
}

/**
 * Silhouette pleine de la forme finale, au-dessus de la coupe : un aplat de la
 * teinte de l'encre du thème, d'une opacité de quelques pour cent, sans trait ni
 * anneau (l'ouverture du col se remplit comme le reste). Deux matériaux de base de
 * three, étendus au lieu du matériau d'impression (qui sert aussi le Studio) :
 *  - `depth` pose la profondeur seule (colorWrite à false, décalée d'un cran) ;
 *  - `fill` dessine la couleur uniquement là où il touche cette profondeur : une
 *    seule couche de matière à l'écran, sans les surimpressions sombres aux
 *    gradins où deux parois se chevauchent.
 * Les deux partagent les mêmes uniforms (coupe, opacité) et le même programme.
 */
function createGhostMaterials() {
  const uniforms = {
    uGhostCut: { value: 0 },
    uGhostAlpha: { value: 0 },
  };
  const make = (visible: boolean) => {
    const material = new MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      side: FrontSide,
      depthWrite: !visible,
      colorWrite: visible,
      toneMapped: false,
      polygonOffset: !visible,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          `#include <common>
varying float vGhostZ;`,
        )
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
vGhostZ = position.z;`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
uniform float uGhostCut, uGhostAlpha;
varying float vGhostZ;`,
        )
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
if (vGhostZ <= uGhostCut + 1e-4) discard;
diffuseColor.a *= uGhostAlpha;`,
        );
    };
    material.customProgramCacheKey = () => "s3d-print-ghost-v2";
    return material;
  };
  return { fill: make(true), depth: make(false), uniforms };
}

/**
 * Tête d'impression : bloc de chauffe mat, buse conique, deux ailettes, et un
 * seul détail rouge de la marque (le liseré du bloc). Origine à la pointe de la
 * buse, Y vers le haut ; 9,5 mm de large pour ≈ 14 mm de haut. Aucune lueur : le
 * liseré chaud du front d'impression, sur le vase, suffit.
 */
function createPrintHead(): {
  group: Group;
  materials: MeshStandardMaterial[];
  disposables: { dispose(): void }[];
} {
  const group = new Group();
  const materials: MeshStandardMaterial[] = [];
  const disposables: { dispose(): void }[] = [];
  const matte = (color: number, metalness = 0, roughness = 0.82) => {
    const material = new MeshStandardMaterial({ color, metalness, roughness });
    materials.push(material);
    disposables.push(material);
    return material;
  };
  const metal = matte(0x8f8b84, 0.25, 0.7);
  const graphite = matte(0x35312c);
  const red = matte(0xe5231c, 0, 0.6);
  const add = (
    geometry: BufferGeometry,
    material: MeshStandardMaterial,
    y: number,
  ) => {
    const mesh = new Mesh(geometry, material);
    mesh.position.y = y;
    group.add(mesh);
    disposables.push(geometry);
  };
  // Buse : cône Ø 4,2 → 0,8 mm sur 2,8 mm.
  add(new CylinderGeometry(2.1, 0.4, 2.8, 32), metal, 1.4);
  // Écrou hexagonal, puis bloc de chauffe graphite et son liseré rouge.
  add(new CylinderGeometry(3, 3, 1.4, 6), metal, 2.8 + 0.7);
  add(new BoxGeometry(9.5, 6.4, 8.2), graphite, 4.2 + 3.2);
  add(new BoxGeometry(9.7, 1, 8.4), red, 4.2 + 1.5);
  // Col, puis deux ailettes de refroidissement.
  add(new CylinderGeometry(1.5, 1.5, 1.4, 24), metal, 10.6 + 0.7);
  add(new CylinderGeometry(4, 4, 0.5, 32), metal, 12 + 0.25);
  add(new CylinderGeometry(4, 4, 0.5, 32), metal, 13.4 + 0.25);
  return { group, materials, disposables };
}

function roundedPlate(size: number, radius: number, depth: number) {
  const s = size / 2;
  const r = radius;
  const shape = new Shape();
  shape.moveTo(-s + r, -s);
  shape.lineTo(s - r, -s);
  shape.absarc(s - r, -s + r, r, -Math.PI / 2, 0, false);
  shape.lineTo(s, s - r);
  shape.absarc(s - r, s - r, r, 0, Math.PI / 2, false);
  shape.lineTo(-s + r, s);
  shape.absarc(-s + r, s - r, r, Math.PI / 2, Math.PI, false);
  shape.lineTo(-s, -s + r);
  shape.absarc(-s + r, -s + r, r, Math.PI, Math.PI * 1.5, false);
  const geometry = new ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
    curveSegments: 8,
  });
  // Extrusion le long de +Z → +Y ; le dessus du plateau est à y = 0.
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, -depth, 0);
  return geometry;
}

function canvasTexture(
  size: number,
  draw: (g: CanvasRenderingContext2D) => void,
) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const g = canvas.getContext("2d")!;
  draw(g);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return { canvas, texture };
}

/** Une coque par bande, qui partage les tampons du maillage (éclaté). */
function bandGeometries(mesh: MeshData): BufferGeometry[] {
  const base = meshToGeometry(mesh);
  return [...mesh.groups]
    .sort((a, b) => a.band - b.band)
    .map((group) => {
      const part = new BufferGeometry();
      for (const [name, attribute] of Object.entries(base.attributes))
        part.setAttribute(name, attribute);
      part.setIndex(
        new BufferAttribute(
          mesh.indices.subarray(group.start, group.start + group.count),
          1,
        ),
      );
      part.boundingBox = base.boundingBox;
      part.boundingSphere = base.boundingSphere;
      return part;
    });
}

const create = (
  ctx: StageContext,
): StageScene<PrintHeroProps, PrintHeroController> => {
  const scene = new Scene();
  scene.environment = ctx.envMap;
  scene.environmentIntensity = 0.6;
  // Lumière du nord-ouest (convention d'estompage suisse : en haut à gauche).
  const sun = new DirectionalLight(0xffffff, 1.6);
  sun.position.set(-1, 1.4, 0.8).normalize().multiplyScalar(400);
  scene.add(sun);

  const camera = new PerspectiveCamera(20, 1, 20, 3000);
  const root = new Group();
  scene.add(root);
  // Z vers le haut du générateur → Y vers le haut de three : −90° autour de X.
  const object = new Group();
  object.rotation.x = -Math.PI / 2;
  root.add(object);

  let props!: PrintHeroProps;
  let mode: PrintHeroProps["mode"] = "hero";
  let theme: StageTheme | null = null;
  let tier: 1 | 2 = 2;
  let height = 150;
  let boundaries: number[] = [];
  let filaments: FilamentId[] = [];
  let bandsNow: PrintBand[] = [];
  let baseCamera: CameraSpec = heroCamera();
  let cameraTilt = Number.NaN;
  let disposed = false;

  // ── Valeurs animées par la chorégraphie ───────────────────────────────────
  let progress = 0;
  let tilt = 0;
  let explode = 1;
  let ghost: 0 | 1 = 1;
  const controller: PrintHeroController = {
    get progress() {
      return progress;
    },
    set progress(value) {
      progress = clamp01(value);
      ctx.invalidate();
    },
    get tilt() {
      return tilt;
    },
    set tilt(value) {
      tilt = clamp01(value);
      ctx.invalidate();
    },
    get explode() {
      return explode;
    },
    set explode(value) {
      explode = clamp01(value);
      ctx.invalidate();
    },
    get ghost() {
      return ghost;
    },
    set ghost(value) {
      ghost = value;
      ctx.invalidate();
    },
    ripple: (palette) => startRipple(palette),
    reprint: (pattern) => startReprint(pattern),
  };

  // ── Matériaux et objets ──────────────────────────────────────────────────
  const materials: PrintMaterial[] = [];
  const track = (material: PrintMaterial) => {
    materials.push(material);
    return material;
  };
  const geometries = new Set<BufferGeometry>();
  const textures: CanvasTexture[] = [];
  const disposables: { dispose(): void }[] = [];

  // Hero : plateau, maillage courant et entrant (réimpression), silhouette, buse.
  let vase: Mesh | null = null;
  let vaseNext: Mesh | null = null;
  let vaseMaterial: PrintMaterial | null = null;
  let nextMaterial: PrintMaterial | null = null;
  let ghostMeshes: Mesh[] = [];
  let ghostFill: MeshBasicMaterial | null = null;
  let ghostUniforms:
    | ReturnType<typeof createGhostMaterials>["uniforms"]
    | null = null;
  let ghostGate = 1;
  let nozzle: Group | null = null;
  let headMaterials: MeshStandardMaterial[] = [];
  let plate: Group | null = null;
  let plateMaterials: (MeshBasicMaterial | MeshStandardMaterial)[] = [];
  let drawGrid: ((t: StageTheme) => void) | null = null;
  const heroGeometry = new Map<HeroPatternKey, BufferGeometry>();
  const models = new Map<HeroPatternKey, LavauxModel>();
  let pattern: HeroPatternKey = "gradins";

  // Éclaté : une coque par bande.
  let shells: { mesh: Mesh; material: PrintMaterial }[] = [];
  let shellsKey = "";

  // Animations temporelles.
  let rippleT = -1;
  let rippleFrom: PrintBand[] = [];
  let reprintT = -1;
  let reprintPattern: HeroPatternKey | null = null;
  let flash = 0;
  let park = 0;
  let nozzleTheta = 0;
  let omega = 0;
  let lastCut = -1;
  let lastMoveAt = -10;
  let lastBand = 0;
  let lastLayer = -1;
  let lastEmitAt = -10;
  let idleHandle = 0;

  const tmp = new Float64Array(3);
  const radiusAt = (theta: number, z: number) => {
    const model = models.get(reprintPattern ?? pattern);
    if (!model) return 0;
    model.outer(theta, Math.min(Math.max(z, 0.01), height - 0.01), 1, tmp);
    return tmp[0];
  };

  function configFor(key: HeroPatternKey): LavauxConfig {
    return {
      ...props.config,
      pattern: props.patterns[key],
      bands: [...props.bands3],
    };
  }

  function modelFor(key: HeroPatternKey): LavauxModel {
    let model = models.get(key);
    if (!model) {
      model = createLavauxModel(configFor(key));
      models.set(key, model);
    }
    return model;
  }

  function geometryFor(key: HeroPatternKey): BufferGeometry {
    let geometry = heroGeometry.get(key);
    if (!geometry) {
      geometry = meshToGeometry(
        buildLavaux(configFor(key), { lod: "display", tier }),
      );
      heroGeometry.set(key, geometry);
      geometries.add(geometry);
    }
    return geometry;
  }

  // ── Thème ────────────────────────────────────────────────────────────────
  function applyTheme(next: StageTheme) {
    theme = next;
    for (const material of materials) material.setTheme(next);
    drawGrid?.(next);
    const surface = new Color(next.paper).lerp(
      new Color(0xffffff),
      next.dark ? 0.06 : 0.45,
    );
    for (const material of plateMaterials)
      if (material instanceof MeshStandardMaterial)
        material.color.copy(surface);
  }

  // ── Construction ─────────────────────────────────────────────────────────
  function buildHero() {
    height = props.config.h;
    boundaries = props.bands3.map((band) => band.toMm);
    filaments = props.config.bands.map((band) => band.filament);
    bandsNow = expandBands(filaments, boundaries);
    pattern = props.pattern;
    models.set(pattern, modelFor(pattern));

    // Le matériau d'impression ne dessine que le déjà imprimé : le reste est la
    // silhouette (uGhost reste à 0, plus de lignes fantômes).
    vaseMaterial = track(
      createPrintMaterial({ heightMm: height, bands: bandsNow }),
    );
    nextMaterial = track(
      createPrintMaterial({ heightMm: height, bands: bandsNow }),
    );
    vase = new Mesh(geometryFor(pattern), vaseMaterial.material);
    vaseNext = new Mesh(geometryFor(pattern), nextMaterial.material);
    vaseNext.visible = false;
    object.add(vase, vaseNext);

    // Silhouette : après tout le reste (transparente), sur la même géométrie.
    // La profondeur d'abord (ordre 9), la couleur ensuite (ordre 10).
    const ghost3d = createGhostMaterials();
    ghostUniforms = ghost3d.uniforms;
    ghostFill = ghost3d.fill;
    ghostMeshes = [ghost3d.depth, ghost3d.fill].map((material, k) => {
      const mesh = new Mesh(geometryFor(pattern), material);
      mesh.renderOrder = 9 + k;
      mesh.visible = false;
      object.add(mesh);
      return mesh;
    });
    disposables.push(ghost3d.fill, ghost3d.depth);

    // Plateau : carré arrondi 180 × 180 × 1 mm, quadrillage tous les 10 mm,
    // ombre de contact précalculée (dégradé radial).
    plate = new Group();
    root.add(plate);
    const plateGeometry = roundedPlate(
      PLATE_MM,
      PLATE_RADIUS_MM,
      PLATE_THICKNESS_MM,
    );
    const plateSurface = new MeshStandardMaterial({ roughness: 0.9 });
    plate.add(new Mesh(plateGeometry, plateSurface));
    const grid = canvasTexture(512, () => {});
    // Le plateau est vu à 22° : sans filtrage anisotrope, les mips lissent les
    // traits au tiers de leur finesse et le quadrillage paraît 2 à 3 fois plus
    // épais que le trait de 1 px du poster SSR (même couleur, même pas).
    grid.texture.anisotropy = Math.min(
      8,
      ctx.renderer.capabilities.getMaxAnisotropy(),
    );
    drawGrid = (t) => {
      const g = grid.canvas.getContext("2d")!;
      const cell = grid.canvas.width / (PLATE_MM / PLATE_GRID_MM);
      g.clearRect(0, 0, grid.canvas.width, grid.canvas.height);
      g.strokeStyle = t.iso;
      g.lineWidth = 1.5;
      g.beginPath();
      for (let i = 0; i <= PLATE_MM / PLATE_GRID_MM; i++) {
        const p = Math.min(grid.canvas.width - 1, Math.round(i * cell));
        g.moveTo(p, 0);
        g.lineTo(p, grid.canvas.height);
        g.moveTo(0, p);
        g.lineTo(grid.canvas.width, p);
      }
      g.stroke();
      grid.texture.needsUpdate = true;
    };
    const gridMaterial = new MeshBasicMaterial({
      map: grid.texture,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    const gridPlane = new Mesh(
      new PlaneGeometry(PLATE_MM, PLATE_MM),
      gridMaterial,
    );
    gridPlane.rotation.x = -Math.PI / 2;
    gridPlane.position.y = 0.02;
    plate.add(gridPlane);
    const shadow = canvasTexture(128, (g) => {
      const radial = g.createRadialGradient(64, 64, 6, 64, 64, 64);
      radial.addColorStop(0, "rgba(0,0,0,0.55)");
      radial.addColorStop(0.55, "rgba(0,0,0,0.22)");
      radial.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = radial;
      g.fillRect(0, 0, 128, 128);
    });
    const shadowMaterial = new MeshBasicMaterial({
      map: shadow.texture,
      transparent: true,
      depthWrite: false,
      opacity: 0.5,
      toneMapped: false,
    });
    const shadowPlane = new Mesh(new PlaneGeometry(110, 110), shadowMaterial);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = 0.04;
    plate.add(shadowPlane);
    plateMaterials = [plateSurface, gridMaterial, shadowMaterial];
    textures.push(grid.texture, shadow.texture);
    disposables.push(
      plateGeometry,
      plateSurface,
      gridMaterial,
      shadowMaterial,
      gridPlane.geometry,
      shadowPlane.geometry,
    );

    // Tête d'impression : un bloc de chauffe et une buse, sans lueur.
    const head = createPrintHead();
    nozzle = head.group;
    headMaterials = head.materials;
    root.add(nozzle);
    disposables.push(...head.disposables);
  }

  function buildShells() {
    const config = props.config;
    const key = `${config.pattern.kind}:${config.bands.map((b) => `${b.filament}@${b.toMm}`).join("|")}`;
    if (key === shellsKey) return;
    shellsKey = key;
    for (const shell of shells) {
      object.remove(shell.mesh);
      shell.mesh.geometry.dispose();
      shell.material.dispose();
      materials.splice(materials.indexOf(shell.material), 1);
    }
    height = config.h;
    filaments = config.bands.map((band) => band.filament);
    bandsNow = expandBands(filaments, boundaries);
    const mesh = buildLavaux(config, {
      lod: "display",
      tier,
      separateBands: config.bands.length > 1,
    });
    const parts =
      config.bands.length > 1 ? bandGeometries(mesh) : [meshToGeometry(mesh)];
    shells = parts.map((geometry, k) => {
      const material = track(
        createPrintMaterial({
          heightMm: height,
          bands: [{ topMm: height, color: filamentHex(filaments[k]) }],
        }),
      );
      if (theme) material.setTheme(theme);
      const part = new Mesh(geometry, material.material);
      object.add(part);
      return { mesh: part, material };
    });
    const gap = (z: number) =>
      bandIndexAt(config.bands, z - 1e-6) * EXPLODE_GAP_MM;
    baseCamera = heroCameraFor(
      config,
      gap,
      height + (config.bands.length - 1) * EXPLODE_GAP_MM,
    );
    cameraTilt = Number.NaN;
  }

  // ── Vague et réimpression ────────────────────────────────────────────────
  function setRipple(zMm: number, active: boolean) {
    for (const material of materials) {
      material.uniforms.uRippleZ.value = zMm;
      material.uniforms.uRippleActive.value = active ? 1 : 0;
    }
  }

  // Éclaté : chaque coque n'a qu'une teinte, celle de sa bande.
  const shellBand = (bands: PrintBand[], k: number): PrintBand[] => [
    { topMm: height, color: bands[Math.min(k, bands.length - 1)].color },
  ];

  function finishRipple() {
    rippleT = -1;
    setRipple(ABOVE_ALL_MM, false);
    if (mode === "hero")
      for (const material of materials) material.setBands(bandsNow, bandsNow);
    else
      shells.forEach((shell, k) =>
        shell.material.setBands(shellBand(bandsNow, k), shellBand(bandsNow, k)),
      );
  }

  function startRipple(palette: readonly FilamentId[]) {
    if (rippleT >= 0) finishRipple();
    const next = expandBands(palette, boundaries);
    rippleFrom = bandsNow;
    bandsNow = next;
    filaments = [...palette];
    if (mode === "hero")
      for (const material of materials) material.setBands(next, rippleFrom);
    else
      shells.forEach((shell, k) =>
        shell.material.setBands(shellBand(next, k), shellBand(rippleFrom, k)),
      );
    rippleT = 0;
    setRipple(0, true);
    ctx.invalidate();
  }

  function startReprint(next: LavauxPattern) {
    const key = (Object.keys(props.patterns) as HeroPatternKey[]).find(
      (k) => props.patterns[k].kind === next.kind,
    );
    if (!key || mode !== "hero" || !vase || !vaseNext) return;
    if (reprintT >= 0) finishReprint();
    if (key === pattern) return;
    reprintPattern = key;
    modelFor(key);
    vaseNext.geometry = geometryFor(key);
    vaseNext.visible = true;
    vaseMaterial!.uniforms.uReprintSide.value = 1;
    nextMaterial!.uniforms.uReprintSide.value = -1;
    reprintT = 0;
    ctx.invalidate();
  }

  function finishReprint() {
    if (!vase || !vaseNext || !reprintPattern) return;
    vase.geometry = geometryFor(reprintPattern);
    vaseNext.visible = false;
    pattern = reprintPattern;
    reprintPattern = null;
    reprintT = -1;
    for (const material of [vaseMaterial!, nextMaterial!]) {
      material.uniforms.uReprintSide.value = 0;
      material.uniforms.uReprintActive.value = 0;
    }
  }

  // ── Caméra ───────────────────────────────────────────────────────────────
  function placeCamera(rect: DOMRectReadOnly) {
    camera.aspect = rect.width / Math.max(1, rect.height);
    if (tilt !== cameraTilt) {
      cameraTilt = tilt;
      const spec =
        mode === "hero"
          ? cameraAt(tilt, baseCamera, props.config.d)
          : baseCamera;
      const eye = toThreeWorld(cameraEye(spec));
      const target = toThreeWorld(spec.target);
      camera.fov = spec.fovDeg;
      camera.position.set(eye[0], eye[1], eye[2]);
      camera.lookAt(new Vector3(target[0], target[1], target[2]));
    }
    camera.updateProjectionMatrix();
  }

  function applyScene() {
    if (mode === "exploded") {
      shells.forEach((shell, k) => {
        shell.mesh.position.z = k * EXPLODE_GAP_MM * explode;
        shell.material.uniforms.uCutZ.value = height;
        shell.material.uniforms.uIsoMode.value = 0;
      });
    }
  }

  // ── Scène ────────────────────────────────────────────────────────────────
  return {
    controller,
    mount(_ctx, view) {
      props = view.props;
      mode = props.mode;
      tier = ctx.capability === 2 ? 2 : 1;
      if (mode === "hero") {
        ghost = 1;
        explode = 0;
        buildHero();
      } else {
        ghost = 0;
        explode = 1;
        height = props.config.h;
        boundaries = props.bands3.map((band) => band.toMm);
        buildShells();
      }
      applyTheme(ctx.theme);
    },

    update(next) {
      const before = props;
      props = next;
      if (next.mode !== mode) return;
      if (mode === "exploded") {
        // Même palette, autre structure (une seule bande, un autre motif) :
        // une nouvelle coque, construite au repos pour ne pas peser sur le geste.
        if (
          next.config.pattern.kind !== before.config.pattern.kind ||
          next.config.bands.length !== before.config.bands.length
        ) {
          window.clearTimeout(idleHandle);
          idleHandle = window.setTimeout(() => {
            if (disposed) return;
            buildShells();
            applyTheme(ctx.theme);
            ctx.invalidate();
          }, 120);
        } else if (next.palette !== before.palette)
          startRipple(next.config.bands.map((band) => band.filament));
        return;
      }
      if (next.palette !== before.palette)
        startRipple(next.config.bands.map((band) => band.filament));
      if (next.pattern !== before.pattern) startReprint(next.config.pattern);
    },

    render(c, frame) {
      if (c.theme !== theme) applyTheme(c.theme);
      const dt = Math.min(frame.dt, 0.1);
      let busy = false;

      // Vague de couleur.
      if (rippleT >= 0) {
        rippleT += dt / RIPPLE_S;
        if (rippleT >= 1) finishRipple();
        else {
          setRipple(easeVague(rippleT) * (height + 1), true);
          busy = true;
        }
      }

      if (mode === "exploded") {
        applyScene();
        placeCamera(frame.rect);
        c.renderer.render(scene, camera);
        return busy;
      }

      // Réimpression : l'ancien maillage garde le dessus, le nouveau le dessous.
      let front = -1;
      if (reprintT >= 0) {
        reprintT += dt / REPRINT_S;
        if (reprintT >= 1) {
          finishReprint();
          busy = true;
        } else {
          front = easeBuse(reprintT) * (height + 1);
          for (const material of [vaseMaterial!, nextMaterial!]) {
            material.uniforms.uReprintZ.value = front;
            material.uniforms.uReprintActive.value = 1;
          }
          busy = true;
        }
      }

      const cut = quantizeToLayer(progress * height);
      const printing = cut > 0 && cut < height - 1e-6;
      // Plateau nu tant qu'aucune couche n'est posée : le pied du vase est à
      // z = 0 et le matériau garde ce qui est sous la coupe, il apparaîtrait
      // sinon en disque dès la première frame (le poster, lui, n'a que le plateau).
      vase!.visible = cut > 1e-6;
      if (Math.abs(cut - lastCut) > 1e-6 || front >= 0) lastMoveAt = frame.time;
      const moving = frame.time - lastMoveAt < 0.25 && (printing || front >= 0);

      // Flash du liseré chaud au franchissement d'une frontière de bande, en imprimant.
      const band = bandOfCut(cut, boundaries);
      if (
        lastCut >= 0 &&
        cut > lastCut &&
        band > lastBand &&
        filaments[band] !== filaments[band - 1]
      )
        flash = 1;
      lastBand = band;
      lastCut = cut;
      if (flash > 0) {
        flash = Math.max(0, flash - dt / FLASH_S);
        busy ||= flash > 0;
      }

      // Compteur (≤ 10 Hz).
      const layer = Math.round(cut / 0.2);
      if (
        controller.onLayer &&
        layer !== lastLayer &&
        (frame.time - lastEmitAt) * 1000 >= READOUT_INTERVAL_MS
      ) {
        lastLayer = layer;
        lastEmitAt = frame.time;
        controller.onLayer(layer, cut, band);
      }

      // Matériaux.
      const hot = printing || front >= 0 ? 1 : 0;
      for (const material of [vaseMaterial!, nextMaterial!]) {
        material.setCut(cut);
        material.uniforms.uHot.value = hot;
        material.uniforms.uFlash.value = flash;
        material.uniforms.uIsoMode.value = tilt;
      }

      // Silhouette de la forme finale : montée avec les premiers millimètres
      // imprimés (donc jamais avant le début de l'impression), éteinte pendant
      // une réimpression (l'ancien motif n'est plus la forme finale) et quand
      // tout est imprimé. Des fondus continus, aucune apparition d'un coup.
      const gateTarget = ghost && front < 0 ? 1 : 0;
      ghostGate +=
        (gateTarget - ghostGate) * (1 - Math.exp(-dt * GHOST_GATE_RATE));
      if (Math.abs(ghostGate - gateTarget) < 0.005) ghostGate = gateTarget;
      else busy = true;
      const ghostAlpha =
        ghostRise(cut) *
        ghostGate *
        (theme?.dark ? GHOST_ALPHA.dark : GHOST_ALPHA.light);
      ghostUniforms!.uGhostCut.value = cut;
      ghostUniforms!.uGhostAlpha.value = ghostAlpha;
      const ghostShown = ghostAlpha > 0.001 && cut < height - 1e-6;
      for (const mesh of ghostMeshes) {
        mesh.geometry = vase!.geometry;
        mesh.visible = ghostShown;
      }
      ghostFill!.color.set(theme?.ink ?? "#1a1614");

      // Buse : suit le front d'impression, tourne pendant l'impression, se
      // lève de 10 mm et se range à droite en fin d'impression.
      const target = moving ? NOZZLE_RATE : 0;
      omega += (target - omega) * (1 - Math.exp(-dt * (target ? 20 : 5)));
      if (omega < 0.02 && !target) omega = 0;
      nozzleTheta += omega * dt;
      busy ||= omega > 0;
      const done = progress >= 1 - 1e-6 && front < 0;
      park = clamp01(
        park + ((done ? 1 : 0) - park) * Math.min(1, dt / (PARK_S / 4)),
      );
      if (Math.abs(park - (done ? 1 : 0)) > 0.002) busy = true;
      else park = done ? 1 : 0;
      const z = front >= 0 ? Math.min(front, height) : cut;
      const r = radiusAt(nozzleTheta, z) + 0.6;
      const parked = park;
      nozzle!.position.set(
        lerp(r * Math.cos(nozzleTheta), PARK.x, parked),
        lerp(z + 0.25, height + PARK.lift, parked),
        lerp(-r * Math.sin(nozzleTheta), 0, parked),
      );

      // Bascule en vue de plan : plateau et tête s'effacent en fondu (jamais
      // d'un coup), le vase seul devient la carte. L'ombre de contact grandit
      // avec la matière : pas d'ombre sous un plateau nu.
      const fade = 1 - clamp01((tilt - 0.05) / 0.45);
      plate!.visible = fade > 0.01;
      const [surface, grid, shadow] = plateMaterials;
      surface.transparent = fade < 1;
      surface.opacity = fade;
      grid.opacity = fade;
      const shadowRise = clamp01(cut / SHADOW_RISE_MM);
      shadow.opacity =
        0.5 * fade * shadowRise * shadowRise * (3 - 2 * shadowRise);
      nozzle!.visible = fade > 0.01;
      for (const material of headMaterials) {
        material.transparent = fade < 1;
        material.opacity = fade;
      }

      placeCamera(frame.rect);
      c.renderer.render(scene, camera);

      // Maillages des deux autres motifs : au repos, après la première frame.
      if (!idleHandle && "requestIdleCallback" in window) {
        idleHandle = window.requestIdleCallback(
          () => {
            if (disposed) return;
            for (const key of Object.keys(props.patterns) as HeroPatternKey[])
              geometryFor(key);
          },
          { timeout: 3000 },
        );
      }
      return busy;
    },

    dispose() {
      disposed = true;
      window.clearTimeout(idleHandle);
      if ("cancelIdleCallback" in window) window.cancelIdleCallback(idleHandle);
      for (const geometry of geometries) geometry.dispose();
      for (const shell of shells) shell.mesh.geometry.dispose();
      for (const material of materials) material.dispose();
      for (const texture of textures) texture.dispose();
      for (const item of disposables) item.dispose();
      scene.clear();
    },
  };
};

export default create;
