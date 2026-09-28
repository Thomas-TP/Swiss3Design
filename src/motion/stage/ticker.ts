// Point de rencontre entre le runtime (GSAP + Lenis) et le Stage (three), sans
// qu'aucun des deux n'importe l'autre (brief « Strates », §4.3, §4.4) :
//   - l'horloge : quand le runtime est chargé, le Stage rend sur gsap.ticker,
//     dans la même frame que Lenis et ScrollTrigger (aucun décalage entre le
//     DOM et le canvas au défilement) ; sinon il retombe sur
//     requestAnimationFrame, à la demande. Le Stage n'importe jamais gsap :
//     en mouvement réduit, il vit sans le chunk du runtime.
//   - la mise en page : le runtime signale chaque ScrollTrigger.refresh() pour
//     que le Stage recalcule le cache des rectangles de ses vues.
// Modules du même runtime webpack : une seule instance, quel que soit le
// chunk qui les charge en premier.

/** Rappel de frame ; `nowMs` sur l'horloge de performance.now(). */
export type FrameCallback = (nowMs: number) => void;

export interface FrameDriver {
  add(cb: FrameCallback): void;
  remove(cb: FrameCallback): void;
}

let driver: FrameDriver | null = null;
const driverListeners = new Set<() => void>();
const layoutListeners = new Set<() => void>();

/** Le runtime installe (ou retire, null) son horloge. */
export function setFrameDriver(next: FrameDriver | null) {
  if (driver === next) return;
  driver = next;
  for (const listener of Array.from(driverListeners)) listener();
}

export function getFrameDriver(): FrameDriver | null {
  return driver;
}

export function onFrameDriverChange(cb: () => void): () => void {
  driverListeners.add(cb);
  return () => driverListeners.delete(cb);
}

/** Le runtime signale un recalcul de mise en page (ScrollTrigger.refresh). */
export function notifyLayout() {
  for (const listener of Array.from(layoutListeners)) listener();
}

export function onLayout(cb: () => void): () => void {
  layoutListeners.add(cb);
  return () => layoutListeners.delete(cb);
}
