// Contrats du Stage, côté lourd uniquement (brief « Strates », §4.5) : FIGÉS,
// ajouts permis, ruptures interdites. Chaque scène (print-hero, contour-field,
// studio-object, product-viewer) implémente StageScene ; le Stage lui prête
// le renderer unique, l'environnement partagé et un rectangle par frame.
import type { Texture, WebGLRenderer } from "three";
import type {
  Capability,
  StageViewDescriptor,
} from "@/lib/motion-bridge/types";

export interface StageTheme {
  dark: boolean;
  /** Couleurs CSS résolues sur <html> (--paper, --ink, --iso, --iso-index). */
  paper: string;
  ink: string;
  iso: string;
  isoIndex: string;
}

export interface StageContext {
  renderer: WebGLRenderer;
  /** RoomEnvironment préfiltré (PMREM), partagé par toutes les scènes. */
  envMap: Texture;
  /** Peut baisser en cours de route (déclassement) : relire à chaque frame. */
  capability: Capability;
  /** Mouvement réduit : états finaux, rendu à la demande seulement. */
  reduced: boolean;
  /**
   * Remplacé par un nouvel objet à chaque changement de thème : une scène
   * compare la référence pour savoir s'il faut recolorer.
   */
  theme: StageTheme;
  /**
   * Demande une frame (ajout au contrat) : maillage reçu du Worker, propriété
   * de contrôleur animée par GSAP… Sans appel ni `render() === true`, le
   * Stage ne redessine pas la vue.
   */
  invalidate(): void;
}

export interface ViewFrame {
  /** Rectangle de la vue dans la fenêtre, px CSS. */
  rect: DOMRectReadOnly;
  dpr: number;
  /** Secondes. */
  time: number;
  /** Secondes depuis la frame précédente de cette vue (0 à la première). */
  dt: number;
  /**
   * Position, dans le document, du haut du canvas (px CSS) : le défilement de
   * la fenêtre quand le canvas est fixe, ce défilement moins le décalage du
   * canvas quand il est ancré au document. `rect` étant relatif au canvas,
   * `rect.top + scrollY` est toujours la position de la vue dans la page.
   */
  scrollY: number;
  /** px/frame lissée (runtime) ; 0 sans runtime. */
  velocity: number;
}

export interface StageScene<P, C = unknown> {
  mount(ctx: StageContext, view: StageViewDescriptor<P>): Promise<void> | void;
  update(props: P): void;
  /**
   * Viewport, scissor et fond sont déjà posés par le Stage : la scène règle
   * sa caméra sur `frame.rect` et appelle ctx.renderer.render(). Renvoie true
   * pour être rendue à la frame suivante (animation en cours).
   */
  render(ctx: StageContext, frame: ViewFrame): boolean;
  /** Propriétés animables par GSAP (chorégraphies), via controllers.ts. */
  controller?: C;
  /**
   * Ajout au contrat : true tant que la scène ne sait pas remplacer le poster
   * SSR (stubs de WP-00 en production). Le Stage ne la rend pas et ne pose
   * jamais data-stage-ready : le poster reste visible.
   */
  holdPoster?: boolean;
  dispose(): void;
}

export type SceneModule<P, C = unknown> = {
  default: (ctx: StageContext) => StageScene<P, C>;
};
