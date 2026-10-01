// Calculs purs de la scène `studio-object` (brief « Strates », §6.7), sans three
// ni DOM : testés sous Node (scene-math.test.ts). La scène ne fait que les appeler.
import { LAYER_MM, layerAt, layerTop } from "@/components/studio/layers";
import { simulatedSeconds } from "@/lib/studio/format";

export { LAYER_MM, layerAt, layerTop };

export const rad = (deg: number) => (deg * Math.PI) / 180;

/** Focale longue (§2.4) : le champ de vue vertical, en degrés. */
export const FOV_DEG = 20;
export const AZIMUTH_START = rad(-28);
/** Élévation de 22° au-dessus du plateau, comptée depuis le zénith. */
export const POLAR_START = rad(68);
/** Face : la caméra presque à hauteur du plateau (8° d'élévation). */
export const POLAR_FRONT = rad(82);
export const POLAR_MIN = rad(8);
export const POLAR_MAX = rad(94);
export const ZOOM_MIN = 0.6;
export const ZOOM_MAX = 2.4;
export const TURN_STEP = rad(15);
export const TILT_STEP = rad(4);
/** La pièce occupe 74 % de la hauteur de la vue et au plus 66 % de sa largeur. */
export const FILL_HEIGHT = 0.74;
export const FILL_WIDTH = 0.66;

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const clampPolar = (polar: number) => clamp(polar, POLAR_MIN, POLAR_MAX);
export const clampZoom = (zoom: number) => clamp(zoom, ZOOM_MIN, ZOOM_MAX);

/** Plus petit écart signé entre deux angles (rad), dans ]−π, π]. */
export function angleGap(from: number, to: number): number {
  const twoPi = Math.PI * 2;
  let gap = (to - from) % twoPi;
  if (gap > Math.PI) gap -= twoPi;
  if (gap <= -Math.PI) gap += twoPi;
  return gap;
}

/**
 * Distance de la caméra à la cible pour que la pièce (hauteur, rayon de
 * l'empreinte) tienne dans la vue, à son aspect, à la focale donnée.
 */
export function fitDistance(o: {
  height: number;
  radius: number;
  aspect: number;
  fovDeg?: number;
}): number {
  const tan = Math.tan(rad(o.fovDeg ?? FOV_DEG) / 2);
  const byHeight = o.height / FILL_HEIGHT / 2 / tan;
  const byWidth =
    (o.radius * 2) / FILL_WIDTH / 2 / (tan * Math.max(0.2, o.aspect));
  return Math.max(byHeight, byWidth);
}

/** Distance pour la vue de dessus : la boîte (largeur × profondeur) tient dans la vue. */
export function fitDistancePlan(o: {
  width: number;
  depth: number;
  aspect: number;
  fovDeg?: number;
}): number {
  const tan = Math.tan(rad(o.fovDeg ?? FOV_DEG) / 2);
  const aspect = Math.max(0.2, o.aspect);
  const byHeight = o.depth / FILL_HEIGHT / 2 / tan;
  const byWidth = o.width / FILL_WIDTH / 2 / (tan * aspect);
  return Math.max(byHeight, byWidth);
}

/** Hauteur de la pièce éclatée : `parts` coques écartées de `gap` mm. */
export function explodedHeight(
  heightMm: number,
  parts: number,
  gap: number,
): number {
  return heightMm + Math.max(0, parts - 1) * gap;
}

/** Décalage vertical (mm) de la coque `index` dans l'éclaté. */
export const explodeOffset = (index: number, gap: number) => index * gap;

export interface SimulationState {
  /** Hauteur imprimée (mm), quantifiée à la couche. */
  z: number;
  layer: number;
  done: boolean;
  /** 0 à 1 de la durée réelle. */
  fraction: number;
}

/**
 * Avancement de la simulation (vue « Couches », « Simuler ×1 ×10 ×100 ») :
 * `elapsedMs` de temps réel écoulés ; à ×N, l'impression avance N fois plus vite
 * que la durée réelle estimée (`printMinutes`, la même que la bande de mesure).
 */
export function simulationState(o: {
  elapsedMs: number;
  speed: 1 | 10 | 100;
  printMinutes: number;
  heightMm: number;
}): SimulationState {
  const total = Math.max(1, o.printMinutes * 60);
  const printed = (Math.max(0, o.elapsedMs) / 1000) * o.speed;
  const fraction = clamp(printed / total, 0, 1);
  const layers = Math.max(1, Math.ceil(o.heightMm / LAYER_MM - 1e-6));
  const layer = Math.min(layers, Math.floor(fraction * layers + 1e-9));
  const done = fraction >= 1;
  return {
    z: done ? o.heightMm : layerTop(layer, o.heightMm),
    layer: done ? layers : layer,
    done,
    fraction,
  };
}

/** Durée (s) que prend la simulation à cette vitesse : la même que celle annoncée au visiteur. */
export const simulationSeconds = simulatedSeconds;

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;

/** Front de la « réimpression » (mm) : de 0 à `heightMm` plus une marge, en 0 → 1. */
export function reprintFront(progress: number, heightMm: number): number {
  return easeInOut(clamp(progress, 0, 1)) * (heightMm + 2);
}

/** Front de la vague de couleur (mm) : même mécanique, une sortie plus douce. */
export function rippleFront(progress: number, heightMm: number): number {
  return easeOutCubic(clamp(progress, 0, 1)) * (heightMm + 2);
}

/** Vrai si seules les teintes des bandes diffèrent (même nombre, mêmes hauteurs). */
export function onlyColorsChanged(
  before: readonly { filament: string; toMm: number }[],
  after: readonly { filament: string; toMm: number }[],
): boolean {
  if (before.length !== after.length || before.length === 0) return false;
  let differs = false;
  for (let i = 0; i < before.length; i++) {
    if (Math.abs(before[i].toMm - after[i].toMm) > 1e-6) return false;
    if (before[i].filament !== after[i].filament) differs = true;
  }
  return differs;
}

/** Position d'une caméra en orbite autour de `target` (repère de three : Y vers le haut). */
export function orbitPosition(
  target: readonly [number, number, number],
  distance: number,
  azimuth: number,
  polar: number,
): [number, number, number] {
  return [
    target[0] + distance * Math.sin(polar) * Math.sin(azimuth),
    target[1] + distance * Math.cos(polar),
    target[2] + distance * Math.sin(polar) * Math.cos(azimuth),
  ];
}

/**
 * Faut-il construire en basse définition (`drag`) ? Un changement qui arrive
 * peu après le précédent, ou pendant qu'un calcul est en vol, est un glissé :
 * le maillage « display » ne part qu'au repos (150 ms). Un geste isolé (un
 * clic sur une pastille, la première frappe) va directement en « display ».
 */
export function isRapidChange(o: {
  sinceLastChangeMs: number;
  busy: boolean;
}): boolean {
  return o.busy || o.sinceLastChangeMs < 200;
}

/** Repos après lequel part le maillage « display » d'un glissé (ms). */
export const SETTLE_MS = 150;
