// Contrats du pont entre le DOM (léger, SSR) et le côté lourd (src/motion/**,
// atteint seulement par src/gates/**). Brief de refonte « Strates », §4.5 et
// §9.2 : ces types sont FIGÉS, les ajouts sont permis, les ruptures non. Ce
// fichier n'importe rien de three, gsap ni lenis, même en type : il est lu par
// les composants serveur et par le test de frontière (src/gates/boundary.test.ts).
import type { StudioConfig, StudioTexts } from "@/lib/studio/types";

/**
 * Palier d'appareil (brief §3.6) : 0 = posters seulement (et tout le monde
 * côté serveur), 1 = mobile ou machine modeste, 2 = complet.
 */
export type Capability = 0 | 1 | 2;

/** Les quatre scènes v1 du Stage (brief §4.4) ; chaque package remplace son stub. */
export type SceneId =
  | "print-hero"
  | "contour-field"
  | "studio-object"
  | "product-viewer";

export interface StageViewDescriptor<P = unknown> {
  /** useId() du composant hôte. */
  id: string;
  scene: SceneId;
  /** Conteneur transparent qui couvre toute sa section (règle de composition, §4.4). */
  element: HTMLElement;
  /** Instantané immuable : on remplace l'objet, on ne le mute jamais. */
  props: P;
  /** « tone » : la vue peint elle-même le fond (--paper calculé sur sa section). */
  clear: "transparent" | "tone";
  /** true si la vue vit dans une section pinnée ou transformée : rectangle relu par frame. */
  liveRect?: boolean;
  /** C1 seulement : figée en image au repos (vues qui défilent avec la page). */
  bakeWhenIdle?: boolean;
  /** Orbite, pointeur : la scène écoute elle-même les événements de `element`. */
  interactive?: boolean;
  /** Ordre de rendu (croissant). */
  priority?: number;
}

/** Défilement piloté par Lenis (runtime), null sans runtime ou en mouvement réduit. */
export interface BridgeScroll {
  to(
    target: number | string | HTMLElement,
    o?: { offset?: number; immediate?: boolean },
  ): void;
  /** Arrête (true) ou relance (false) Lenis : tiroirs, dialogues. */
  lock(on: boolean): void;
}

/** Service de vignettes du Stage (« Mes créations », pièce jointe du devis). */
export interface BridgeStage {
  bake(
    scene: SceneId,
    props: unknown,
    size: { width: number; height: number },
  ): Promise<Blob>;
}

/** Export STL du Studio (§9.2), fourni par le moteur de WP-STUDIO quand il est chargé. */
export interface BridgeStudio {
  exportStl(
    config: StudioConfig,
    texts: StudioTexts,
    name: string,
  ): Promise<{ blob: Blob; triangles: number; bytes: number }>;
}

export interface MotionBridgeState {
  /** 0 côté serveur et avant la détection (après l'hydratation, tier.ts). */
  capability: Capability;
  /** Préférence de mouvement réduit (data-motion sur <html>). */
  reduced: boolean;
  runtimeReady: boolean;
  stageReady: boolean;
  /** Perte du contexte WebGL : posters jusqu'à la fin de la session. */
  contextLost: boolean;
  /** Navigation en attente du serveur (buse rouge du header). */
  navPending: boolean;
  /** Vitesse de défilement lissée, px/frame, écrite par le runtime. */
  velocity: number;
  scroll: BridgeScroll | null;
  stage: BridgeStage | null;
  studio: BridgeStudio | null;
}

/**
 * Contrat de vue « objet Studio » (§9.2) : permet à l'accueil (WP-HOME)
 * d'afficher un objet du Studio sans attendre WP-STUDIO. Tant que la scène
 * `studio-object` est un stub, le poster SSR reste visible.
 */
export interface StudioObjectViewProps {
  config: StudioConfig;
  /** Jamais dans l'URL ; tout élément DOM qui les affiche porte .ph-mask. */
  texts: StudioTexts;
  view: "orbit" | "plan";
  /** Hauteur de coupe en mm ; null = objet entier. */
  cutZ: number | null;
  exploded: boolean;
  simulate?: { speed: 1 | 10 | 100; startedAt: number } | null;
  autoRotate?: boolean;
}
