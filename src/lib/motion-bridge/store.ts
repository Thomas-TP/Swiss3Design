// Store externe minimal du pont motion (brief « Strates », §4.5) : un objet
// d'état partagé entre le DOM (hooks, useSyncExternalStore) et le côté lourd
// (runtime, Stage), plus le registre des vues du Stage. Aucune dépendance :
// importable par un composant serveur (qui ne lit que l'état serveur) comme
// par src/motion/**. Le côté lourd importe ce module, jamais l'inverse.
//
// Un singleton de module, pas un contexte React : le runtime et le Stage vivent
// dans des chunks chargés par next/dynamic, hors de l'arbre qui les rend, et
// l'état (capacité, déclassement, perte de contexte) doit survivre aux
// navigations client entre pages vitrine.
import { useSyncExternalStore } from "react";
import { readReducedMotion, subscribeMotionPreference } from "./motion-pref";
import type { MotionBridgeState, StageViewDescriptor } from "./types";

// État servi au rendu serveur et pendant l'hydratation : tout le monde est en
// C0 (posters). Figé : un composant qui le muterait casserait l'hydratation.
const SERVER_STATE: MotionBridgeState = Object.freeze({
  capability: 0,
  reduced: false,
  runtimeReady: false,
  stageReady: false,
  contextLost: false,
  navPending: false,
  velocity: 0,
  scroll: null,
  stage: null,
  studio: null,
});

let state: MotionBridgeState | null = null;
const listeners = new Set<() => void>();
let stopPreference: (() => void) | null = null;

const isBrowser = () => typeof window !== "undefined";

// Côté client, l'état naît au premier accès : `reduced` part de data-motion,
// posé sur <html> avant le paint par le script anti-FOUC du layout.
function current(): MotionBridgeState {
  if (!isBrowser()) return SERVER_STATE;
  state ??= { ...SERVER_STATE, reduced: readReducedMotion() };
  return state;
}

function emit(set: Set<() => void>) {
  // Copie : un écouteur qui se désabonne pendant l'émission n'en saute aucun.
  for (const listener of Array.from(set)) listener();
}

function set(patch: Partial<MotionBridgeState>) {
  const prev = current();
  if (prev === SERVER_STATE) return; // serveur : état figé
  let changed = false;
  for (const key of Object.keys(patch) as (keyof MotionBridgeState)[])
    if (!Object.is(prev[key], patch[key])) {
      changed = true;
      break;
    }
  if (!changed) return;
  state = { ...prev, ...patch };
  emit(listeners);
}

function subscribe(listener: () => void): () => void {
  // L'état naît au plus tard ici : un changement survenu ensuite est émis,
  // même si l'abonné n'a encore rien lu.
  current();
  listeners.add(listener);
  // La préférence (interrupteur du footer, réglage du système, autre onglet)
  // n'est suivie que tant que quelqu'un écoute.
  if (isBrowser() && !stopPreference)
    stopPreference = subscribeMotionPreference(() =>
      set({ reduced: readReducedMotion() }),
    );
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && stopPreference) {
      stopPreference();
      stopPreference = null;
    }
  };
}

// ── Registre des vues ────────────────────────────────────────────────────────

const views = new Map<string, StageViewDescriptor>();
const viewListeners = new Set<() => void>();
let viewList: StageViewDescriptor[] = [];
const readyViews = new Set<string>();
const readyListeners = new Set<() => void>();

function refreshViewList() {
  // Tri stable par priorité croissante : l'ordre de rendu du Stage. Un nouveau
  // tableau à chaque changement (et seulement alors) : list() peut servir de
  // snapshot à useSyncExternalStore.
  viewList = Array.from(views.values()).sort(
    (a, b) => (a.priority ?? 0) - (b.priority ?? 0),
  );
  emit(viewListeners);
}

function setViewReady(id: string, ready: boolean) {
  if (ready === readyViews.has(id)) return;
  if (ready) readyViews.add(id);
  else readyViews.delete(id);
  emit(readyListeners);
}

export const motionBridge = {
  get: current,
  set,
  subscribe,
  views: {
    /** Enregistre (ou remplace, même id : double effet du StrictMode) une vue. */
    register(view: StageViewDescriptor) {
      views.set(view.id, view);
      refreshViewList();
    },
    /** Remplace les props (instantané immuable) ; n'émet que si l'objet change. */
    update(id: string, props: unknown) {
      const view = views.get(id);
      if (!view || Object.is(view.props, props)) return;
      views.set(id, { ...view, props });
      refreshViewList();
    },
    unregister(id: string) {
      if (!views.delete(id)) return;
      setViewReady(id, false);
      refreshViewList();
    },
    list(): StageViewDescriptor[] {
      return viewList;
    },
    get(id: string): StageViewDescriptor | undefined {
      return views.get(id);
    },
    /** N'émet que sur ajout, retrait ou changement de props. */
    subscribe(listener: () => void): () => void {
      viewListeners.add(listener);
      return () => viewListeners.delete(listener);
    },
    // « Prête » = le Stage a rendu sa première frame (poster effacé). Canal
    // séparé : un changement d'état prêt ne doit pas relancer le Stage.
    isReady(id: string): boolean {
      return readyViews.has(id);
    },
    setReady: setViewReady,
    subscribeReady(listener: () => void): () => void {
      readyListeners.add(listener);
      return () => readyListeners.delete(listener);
    },
  },
};

/**
 * Lit une tranche de l'état du pont. `select` doit renvoyer une valeur stable
 * (primitive ou référence déjà présente dans l'état), sinon React boucle.
 * Pendant l'hydratation, l'état serveur (C0) est servi : le rendu SSR ne doit
 * jamais dépendre de ce hook (le premier paint passe par les variantes CSS
 * motion-on / motion-off).
 */
export function useMotionBridge<T>(select: (s: MotionBridgeState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => select(current()),
    () => select(SERVER_STATE),
  );
}

/** Nombre de vues enregistrées (SiteShell : le Stage n'est chargé que s'il y en a). */
export function useStageViewCount(): number {
  return useSyncExternalStore(
    motionBridge.views.subscribe,
    () => viewList.length,
    () => 0,
  );
}

/** Réservé aux tests : remet le pont dans son état initial. */
export function resetMotionBridgeForTests() {
  state = null;
  listeners.clear();
  stopPreference?.();
  stopPreference = null;
  views.clear();
  viewList = [];
  viewListeners.clear();
  readyViews.clear();
  readyListeners.clear();
}
