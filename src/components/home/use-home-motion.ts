import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from "react";
import { motionBridge, useMotionBridge } from "@/lib/motion-bridge/store";
import { detectCapability, webglLostInSession } from "@/lib/motion-bridge/tier";
import type {
  Capability,
  SceneId,
  StageViewDescriptor,
} from "@/lib/motion-bridge/types";
import { useReducedMotionPreference } from "@/lib/motion-bridge/use-reduced-motion";

// Ce que les composants de l'accueil savent du mouvement, sans jamais toucher
// un moteur : la capacité détectée (C0 à C2), la préférence de mouvement réduit,
// et l'inscription de leurs vues dans le pont. Tout est léger (le pont et le
// détecteur de palier n'importent ni three ni gsap).

const IDLE_TIMEOUT_MS = 1200;

function whenIdle(run: () => void): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const handle = window.requestIdleCallback(run, {
      timeout: IDLE_TIMEOUT_MS,
    });
    return () => window.cancelIdleCallback(handle);
  }
  const handle = window.setTimeout(run, 200);
  return () => window.clearTimeout(handle);
}

/**
 * Capacité de l'appareil (§3.6), `null` tant qu'elle n'est pas détectée : le
 * serveur et l'hydratation ne savent rien, tout le monde voit les posters (C0).
 * `detectCapability()` est mémorisée et tenue à jour par le Stage (déclassement,
 * perte de contexte) ; s'abonner à la capacité du pont suffit à relire après
 * une baisse. Le pont ne dit pas « détecté » : un C0 réel ne change jamais de
 * valeur, d'où ce déclencheur propre (même moment de calme que la SiteShell).
 */
export function useDetectedCapability(): Capability | null {
  const [settled, setSettled] = useState(false);
  useMotionBridge((state) => state.capability);
  useEffect(() => whenIdle(() => setSettled(true)), []);
  if (!settled) return null;
  return webglLostInSession() ? 0 : detectCapability();
}

export interface HomeMotion {
  /** Mouvement réduit demandé (préférence du système ou interrupteur du footer). */
  reduced: boolean;
  /** `null` avant détection. */
  capability: Capability | null;
  /**
   * Le poster « final » remplace le poster « dessin » : mouvement réduit, ou
   * appareil sans WebGL (C0) une fois la détection faite. Faux avant : le
   * serveur et la première peinture montrent le dessin, puis le dessin devient
   * matière (fondu de 240 ms, en 2D).
   */
  staticPoster: boolean;
}

export function useHomeMotion(): HomeMotion {
  const reduced = useReducedMotionPreference();
  const capability = useDetectedCapability();
  return {
    reduced,
    capability,
    staticPoster: reduced || capability === 0,
  };
}

type ViewOptions = Pick<
  StageViewDescriptor,
  "clear" | "liveRect" | "bakeWhenIdle" | "interactive" | "priority"
>;

/**
 * Inscrit un élément comme vue du Stage tant que `enabled` est vrai. Comme
 * useStageView (src/lib/motion-bridge/use-stage-view.ts), mais avec un
 * interrupteur : en mouvement réduit le héros, le champ et l'éclaté ne se
 * déclarent pas du tout (le Stage, qui se charge dès qu'une vue existe, ne
 * télécharge alors jamais three pour eux). Renvoie `ready` : le Stage a rendu
 * la première frame (le poster s'efface), faux dès que la vue est libérée.
 */
export function useHomeView<P>(
  ref: RefObject<HTMLElement | null>,
  scene: SceneId,
  props: P,
  options: Partial<ViewOptions> & { enabled: boolean },
): boolean {
  const id = useId();
  const {
    enabled,
    clear = "transparent",
    liveRect = false,
    bakeWhenIdle = false,
    interactive = false,
    priority = 0,
  } = options;
  // Dernières props : (ré)inscription sans dépendre d'elles, les changements
  // passent par views.update (instantané immuable, n'émet que si l'objet change).
  const propsRef = useRef(props);
  useEffect(() => {
    propsRef.current = props;
  }, [props]);

  useEffect(() => {
    const element = ref.current;
    if (!enabled || !element) return;
    motionBridge.views.register({
      id,
      scene,
      element,
      props: propsRef.current,
      clear,
      liveRect,
      bakeWhenIdle,
      interactive,
      priority,
    });
    return () => motionBridge.views.unregister(id);
  }, [
    enabled,
    id,
    ref,
    scene,
    clear,
    liveRect,
    bakeWhenIdle,
    interactive,
    priority,
  ]);

  useEffect(() => {
    if (enabled) motionBridge.views.update(id, props);
  }, [enabled, id, props]);

  return useSyncExternalStore(
    motionBridge.views.subscribeReady,
    () => motionBridge.views.isReady(id),
    () => false,
  );
}
