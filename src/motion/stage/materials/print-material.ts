// Matériau d'impression (brief « Strates », §5.4, annexe A) : un
// MeshPhysicalMaterial de PLA mat (rugosité 0,52, sheen 0,25) dont le shader
// sait « imprimer » : coupe à la hauteur imprimée, bandes de couleur par
// altitude, vague de couleur, réimpression, liseré chaud de la buse, lignes
// fantômes au-dessus de la coupe, mode carte (courbes maîtresses) et lignes de
// couche en relief. Partagé par `print-hero` (accueil) et `studio-object`
// (Studio) ; jamais appliqué au Vase spirale de Ian (CC BY-ND : ni coupe, ni
// shader d'impression, §1.5).
//
// Une instance par vue (ses uniforms lui sont propres), un seul programme GPU
// pour toutes grâce à customProgramCacheKey. Les couleurs passent en
// THREE.Color : three convertit le sRGB des jetons en linéaire.
import {
  Color,
  DoubleSide,
  MeshPhysicalMaterial,
  Vector3,
  type Side,
} from "three";
import {
  PRINT_COLOR,
  PRINT_EMISSIVE,
  PRINT_HEAD,
  PRINT_NORMAL,
  PRINT_VERTEX_BEGIN,
  PRINT_VERTEX_HEAD,
} from "../glsl/print";

export const PRINT_PROGRAM_KEY = "s3d-print-v1";
/** Hauteur de couche des objets du Studio (mm). */
export const LAYER_HEIGHT_MM = 0.2;
const MAX_BANDS = 4;

export interface PrintUniforms {
  uCutZ: { value: number };
  uHeight: { value: number };
  uLayerH: { value: number };
  uLayerRelief: { value: number };
  uBandTop: { value: number[] };
  uBandCount: { value: number };
  uBandColor: { value: Color[] };
  uBandColorFrom: { value: Color[] };
  uRippleZ: { value: number };
  uRippleActive: { value: number };
  uReprintZ: { value: number };
  uReprintSide: { value: number };
  uReprintActive: { value: number };
  uHot: { value: number };
  uFlash: { value: number };
  uHotColor: { value: Color };
  uGhost: { value: number };
  uGhostStep: { value: number };
  uGhostColor: { value: Color };
  uIsoMode: { value: number };
  uIsoIndexColor: { value: Color };
  uUpView: { value: Vector3 };
}

export interface PrintBand {
  /** Haut de la bande (mm) ; la dernière finit à la hauteur totale. */
  topMm: number;
  /** Couleur CSS (hex du filament). */
  color: string;
}

export interface PrintMaterialOptions {
  heightMm: number;
  bands?: PrintBand[];
  /** Couleur des lignes fantômes : jeton --iso. */
  ghostColor?: string;
  /** Courbe maîtresse du mode carte : jeton --iso-index. */
  isoIndexColor?: string;
  /** Liseré chaud de la buse : rouge de la marque. */
  hotColor?: string;
  /**
   * DoubleSide par défaut : les objets imprimés (vase du héros, objets du
   * Studio) sont des coques creuses, avec une paroi extérieure et une paroi
   * intérieure (attribut `side`), et la coupe laisse voir l'intérieur. Les lignes
   * fantômes (`uGhost`) restent sur la paroi extérieure, vue des deux côtés ; seuls
   * le Studio et le cube d'essai les allument. Le héros de l'accueil ne les
   * allume pas : sa silhouette au-dessus de la coupe est un matériau à part,
   * plein et discret (print-hero.ts, FrontSide).
   */
  side?: Side;
}

export interface PrintMaterial {
  material: MeshPhysicalMaterial;
  uniforms: PrintUniforms;
  /** Remplace les bandes (1 à 4) ; `from` : teintes de départ de la vague. */
  setBands(bands: PrintBand[], from?: PrintBand[]): void;
  /** Hauteur imprimée (mm), quantifiée à la couche. */
  setCut(zMm: number): void;
  setTheme(theme: { iso: string; isoIndex: string }): void;
  dispose(): void;
}

/** Hauteur quantifiée à la couche (0,2 mm) : la coupe avance par couches entières. */
export function quantizeToLayer(zMm: number, layer = LAYER_HEIGHT_MM): number {
  return Math.round(zMm / layer) * layer;
}

const upAxis = new Vector3(0, 0, 1);
// Front de vague « au-dessus de tout » : fini, certains GPU calculent mal l'infini.
const ABOVE_ALL_MM = 1e6;

export function createPrintMaterial(
  options: PrintMaterialOptions,
): PrintMaterial {
  const bandColors = () =>
    Array.from({ length: MAX_BANDS }, () => new Color(0xffffff));
  const uniforms: PrintUniforms = {
    uCutZ: { value: options.heightMm },
    uHeight: { value: options.heightMm },
    uLayerH: { value: LAYER_HEIGHT_MM },
    uLayerRelief: { value: 0.25 },
    uBandTop: { value: [options.heightMm, options.heightMm, options.heightMm] },
    uBandCount: { value: 1 },
    uBandColor: { value: bandColors() },
    uBandColorFrom: { value: bandColors() },
    // Front de vague au sommet : les teintes actuelles partout.
    uRippleZ: { value: ABOVE_ALL_MM },
    uRippleActive: { value: 0 },
    uReprintZ: { value: 0 },
    uReprintSide: { value: 0 },
    uReprintActive: { value: 0 },
    uHot: { value: 0 },
    uFlash: { value: 0 },
    uHotColor: { value: new Color(options.hotColor ?? "#e5231c") },
    uGhost: { value: 0 },
    uGhostStep: { value: 2 },
    uGhostColor: { value: new Color(options.ghostColor ?? "#c9c1b2") },
    uIsoMode: { value: 0 },
    uIsoIndexColor: { value: new Color(options.isoIndexColor ?? "#9c7650") },
    uUpView: { value: new Vector3(0, 1, 0) },
  };

  const material = new MeshPhysicalMaterial({
    name: "S3DPrint",
    color: 0xffffff,
    roughness: 0.52,
    metalness: 0,
    sheen: 0.25,
    sheenRoughness: 0.8,
    // Sans couleur, le sheen (noir par défaut dans three) serait sans effet.
    sheenColor: new Color(0xffffff),
    side: options.side ?? DoubleSide,
  });

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${PRINT_VERTEX_HEAD}`)
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>\n${PRINT_VERTEX_BEGIN}`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${PRINT_HEAD}`)
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>\n${PRINT_COLOR}`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>\n${PRINT_NORMAL}`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>\n${PRINT_EMISSIVE}`,
      );
  };
  material.customProgramCacheKey = () => PRINT_PROGRAM_KEY;
  // modelViewMatrix est à jour ici (après onBeforeRender de l'objet).
  material.onBeforeRender = (_renderer, _scene, _camera, _geometry, object) => {
    uniforms.uUpView.value
      .copy(upAxis)
      .transformDirection(object.modelViewMatrix);
  };

  function writeBands(target: Color[], bands: PrintBand[]) {
    for (let i = 0; i < MAX_BANDS; i++) {
      const band = bands[Math.min(i, bands.length - 1)];
      target[i].set(band ? band.color : 0xffffff);
    }
  }

  const api: PrintMaterial = {
    material,
    uniforms,
    setBands(bands, from) {
      const list = bands.slice(0, MAX_BANDS);
      if (list.length === 0) return;
      uniforms.uBandCount.value = list.length;
      for (let i = 0; i < 3; i++)
        uniforms.uBandTop.value[i] = list[i]?.topMm ?? uniforms.uHeight.value;
      writeBands(uniforms.uBandColor.value, list);
      writeBands(uniforms.uBandColorFrom.value, from ?? list);
    },
    setCut(zMm) {
      uniforms.uCutZ.value = quantizeToLayer(
        Math.min(Math.max(zMm, 0), uniforms.uHeight.value),
        uniforms.uLayerH.value,
      );
    },
    setTheme(theme) {
      uniforms.uGhostColor.value.set(theme.iso);
      uniforms.uIsoIndexColor.value.set(theme.isoIndex);
    },
    dispose() {
      material.dispose();
    },
  };
  if (options.bands?.length) api.setBands(options.bands);
  return api;
}
