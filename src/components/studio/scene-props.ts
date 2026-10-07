// Contrat léger entre l'interface du Studio (DOM, src/components/studio) et la
// scène `studio-object` du Stage (côté lourd, atteinte seulement par le Stage).
// Ce fichier n'importe rien de three : le DOM et la scène le lisent tous les
// deux (brief « Strates », §4.1, §4.5, §9.2).
//
// Le contrat figé du brief, `StudioObjectViewProps` (config, textes, vue, coupe,
// éclaté, simulation, autorotation), suffit à l'accueil : WP-HOME n'en passe pas
// d'autre. Le Studio y AJOUTE des champs facultatifs (ajouts permis, ruptures
// interdites) : la langue (étiquette du sous-verre), un compteur de
// « réimpression », la durée réelle d'impression (simulation) et des rappels
// d'état que la scène appelle à 10 Hz au plus. Sans eux, la scène fonctionne.
import type { StudioObjectViewProps } from "@/lib/motion-bridge/types";

export type StudioLocale = "fr" | "de" | "it" | "en";

export type StudioSceneState = "building" | "ready" | "error";

export interface StudioSceneStatus {
  state: StudioSceneState;
  /** Triangles du maillage affiché (0 tant qu'aucun n'est arrivé). */
  triangles: number;
  /** Durée du dernier calcul du Worker (ms). */
  ms: number;
  /** Niveau de détail du maillage affiché (`fine` : celui du fichier d'impression, au repos). */
  lod?: "drag" | "display" | "fine";
  /** Message technique (console, jamais affiché tel quel). */
  message?: string;
}

/** Avancement de la simulation d'impression (vue « Couches »). */
export interface StudioSimulation {
  /** Hauteur imprimée (mm), quantifiée à la couche. */
  z: number;
  /** Couche courante, numérotée depuis 1. */
  layer: number;
  done: boolean;
}

/** Position d'une bande dans la vue (px CSS, repère de l'élément de la vue). */
export interface StudioBandAnchor {
  x: number;
  y: number;
}

export interface StudioSceneProps extends StudioObjectViewProps {
  /** Langue de l'étiquette du sous-verre (« POINTE » / « PIZ » / « PIZZO » / « MOUNT »). */
  locale?: StudioLocale;
  /**
   * Compteur : chaque incrément rejoue la « réimpression » (front qui monte de
   * l'ancien maillage vers le nouveau). Changé par l'interface à chaque
   * changement de motif, de profil ou de préréglage, jamais à un glissé.
   */
  reprint?: number;
  /** Durée réelle d'impression (minutes) : base de la simulation. */
  printMinutes?: number;
  /**
   * La vue 2D exacte (Élévation) recouvre la 3D : la scène garde son état mais
   * ne dessine plus rien (aucun coût GPU derrière un dessin opaque).
   */
  hidden?: boolean;
  /**
   * Hauteur (px CSS) du haut de la vue que des commandes DOM recouvrent (mobile,
   * rangée des vues) : la scène cadre l'objet dans ce qui reste dessous, au lieu
   * de le laisser passer derrière elles. 0 par défaut (bureau, accueil).
   */
  insetTop?: number;
  onStatus?: (status: StudioSceneStatus) => void;
  onSimulate?: (simulation: StudioSimulation) => void;
  /** Éclaté : position de chaque bande, pour les étiquettes DOM. */
  onAnchors?: (anchors: StudioBandAnchor[]) => void;
}

/** Événement DOM des boutons de la vue vers la scène (sur l'élément de la vue). */
export const STUDIO_VIEW_EVENT = "s3d-studio-view";

export type StudioViewCommand =
  | { type: "turn"; step: -1 | 1 }
  | { type: "zoom"; step: -1 | 1 }
  | { type: "front" }
  | { type: "reset" }
  | { type: "retry" };

export function sendViewCommand(
  from: Element | null,
  command: StudioViewCommand,
): void {
  const view = from?.closest("[data-stage-view]");
  view?.dispatchEvent(
    new CustomEvent<StudioViewCommand>(STUDIO_VIEW_EVENT, { detail: command }),
  );
}

/** Écartement des bandes de l'éclaté (mm) : celui du poster du héros (§6.4). */
export const EXPLODE_GAP = 12;
