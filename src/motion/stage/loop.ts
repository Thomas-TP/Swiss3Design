// Boucle du Stage (brief « Strates », §4.4) : rendu à la demande, sur l'horloge
// du runtime quand il est là (gsap.ticker, même frame que Lenis), sinon sur
// requestAnimationFrame. En pause quand l'onglet est masqué.
//
// Deux régimes :
//   - horloge du runtime : tant qu'une vue est visible (`setWatching(true)`),
//     la boucle est appelée à chaque frame et `onFrame` décide lui-même, pour
//     presque rien (comparaison de scrollY), s'il y a lieu de dessiner. Ainsi
//     la toute première frame d'un défilement Lenis est déjà synchrone ;
//   - requestAnimationFrame : une frame n'est demandée que sur invalidate()
//     (props, thème, défilement natif signalé par l'événement scroll) ou si la
//     frame précédente en redemande une.
import {
  getCanvasAnchor,
  getFrameDriver,
  onFrameDriverChange,
  type FrameDriver,
} from "./ticker";

export interface StageLoop {
  /** Demande une frame. */
  invalidate(): void;
  /** Vues visibles ou non : sur l'horloge du runtime, reste branché tant que true. */
  setWatching(on: boolean): void;
  dispose(): void;
}

/** `onFrame` renvoie true pour être rappelée à la frame suivante. */
export function createLoop(onFrame: (nowMs: number) => boolean): StageLoop {
  let requested = true;
  let watching = false;
  let disposed = false;
  let raf = 0;
  let driver: FrameDriver | null = null;
  let onDriver = false;

  const hidden = () =>
    typeof document !== "undefined" && document.visibilityState === "hidden";

  const run = (now: number) => {
    requested = false;
    // Canvas ancré au document (C1) : calé sur le défilement de CETTE frame
    // avant le dessin, dans la même tâche, donc dans le même commit que lui.
    // Le défilement est relu ici comme onFrame le relit (même tâche, même
    // valeur) ; si onFrame ne dessine pas, rien n'a bougé depuis le dernier
    // dessin et le recalage ne change rien.
    getCanvasAnchor()?.follow(window.scrollY);
    if (onFrame(now)) requested = true;
  };

  const tickDriver = (now: number) => {
    run(now);
    if (!requested && !watching) detachDriver();
  };

  const tickRaf = (now: number) => {
    raf = 0;
    run(now);
    schedule();
  };

  function detachDriver() {
    if (driver && onDriver) driver.remove(tickDriver);
    onDriver = false;
  }

  function schedule() {
    if (disposed || hidden()) return;
    if (driver) {
      if (!onDriver && (requested || watching)) {
        driver.add(tickDriver);
        onDriver = true;
      }
      return;
    }
    if (!raf && requested) raf = requestAnimationFrame(tickRaf);
  }

  function switchDriver(next: FrameDriver | null) {
    detachDriver();
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    driver = next;
    requested = true;
    schedule();
  }

  const stopDriverWatch = onFrameDriverChange(() =>
    switchDriver(getFrameDriver()),
  );
  const onVisibility = () => {
    if (hidden()) {
      detachDriver();
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    } else {
      requested = true;
      schedule();
    }
  };
  document.addEventListener("visibilitychange", onVisibility);
  switchDriver(getFrameDriver());

  return {
    invalidate() {
      requested = true;
      schedule();
    },
    setWatching(on) {
      if (watching === on) return;
      watching = on;
      if (on) schedule();
      else if (!requested) detachDriver();
    },
    dispose() {
      disposed = true;
      stopDriverWatch();
      document.removeEventListener("visibilitychange", onVisibility);
      detachDriver();
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    },
  };
}
