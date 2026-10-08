// Point de rencontre entre le runtime (GSAP + Lenis) et le Stage (three), sans
// qu'aucun des deux n'importe l'autre (brief « Strates », §4.3, §4.4) :
//   - l'horloge : quand le runtime est chargé, le Stage rend sur gsap.ticker,
//     dans la même frame que Lenis et ScrollTrigger (aucun décalage entre le
//     DOM et le canvas au défilement) ; sinon il retombe sur
//     requestAnimationFrame, à la demande. Le Stage n'importe jamais gsap :
//     en mouvement réduit, il vit sans le chunk du runtime.
//   - la mise en page : le runtime signale chaque ScrollTrigger.refresh() pour
//     que le Stage recalcule le cache des rectangles de ses vues.
//   - le canvas ancré au document (C1 et C2, R16) : stage-root.tsx l'installe, la
//     boucle (loop.ts) le cale avant chaque frame, le tracker (view-tracker.ts)
//     en tient compte dans les rectangles qu'il rend. Le Stage lui-même
//     (stage.ts) n'en sait rien : il croit dessiner dans une fenêtre.
// Modules du même runtime webpack : une seule instance, quel que soit le
// chunk qui les charge en premier.

/** Rappel de frame ; `nowMs` sur l'horloge de performance.now(). */
export type FrameCallback = (nowMs: number) => void;

export interface FrameDriver {
  add(cb: FrameCallback): void;
  remove(cb: FrameCallback): void;
}

/**
 * Canvas ancré au document plutôt que fixe dans la fenêtre (paliers C1 et C2,
 * retour R16). Un canvas `fixed` ne bouge pas avec la page : quand le
 * défilement est natif (tactile, clavier, barre de défilement), le
 * compositeur déplace le DOM sans attendre le fil principal, et le canvas
 * montre alors l'objet là où la page se trouvait une ou deux frames plus tôt
 * (mesuré : jusqu'à 15 px d'écart au clavier). Ancré au document, il défile
 * avec le DOM, côté compositeur, et reste collé à son conteneur ; chaque
 * frame le recale sur la position du fil principal, dans la même tâche que le
 * dessin, donc dans le même commit.
 */
export interface CanvasAnchor {
  /**
   * Une vue « live » est proche de la fenêtre (collante, épinglée : elle bouge
   * dans la fenêtre sans que le document la porte). Le canvas redevient alors
   * fixe : ancré, il défilerait à contresens d'un élément collant. Faux dès
   * qu'aucune vue « live » n'est plus proche : retour à l'ancrage.
   */
  setLive(live: boolean): void;
  /** Cale le canvas sur le document pour la frame qui va être dessinée. */
  follow(scrollY: number): void;
  /**
   * Décalage vertical (px CSS) entre le haut de la fenêtre et le haut du
   * canvas, valable après follow() : un rectangle de la fenêtre se dessine à
   * `top + offsetY()` dans le canvas.
   */
  offsetY(): number;
}

let driver: FrameDriver | null = null;
let anchor: CanvasAnchor | null = null;
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

/**
 * Place le haut du canvas ancré dans le document pour un défilement donné :
 * `margin` px au-dessus du haut de la fenêtre, arrondi au pixel physique (un
 * décalage fractionnaire rééchantillonne le canvas et le rend flou). `offset`
 * est ce qui sépare alors le haut de la fenêtre du haut du canvas (`margin` à
 * un demi-pixel physique près) : un rectangle de la fenêtre se dessine à
 * `top + offset`.
 */
export function anchorPlacement(
  scrollY: number,
  margin: number,
  dpr: number,
): { top: number; offset: number } {
  const ratio = dpr > 0 ? dpr : 1;
  const top = Math.round((scrollY - margin) * ratio) / ratio;
  return { top, offset: scrollY - top };
}

/** stage-root.tsx installe (ou retire, null) le canvas ancré au document. */
export function setCanvasAnchor(next: CanvasAnchor | null) {
  anchor = next;
}

export function getCanvasAnchor(): CanvasAnchor | null {
  return anchor;
}

/** Le runtime signale un recalcul de mise en page (ScrollTrigger.refresh). */
export function notifyLayout() {
  for (const listener of Array.from(layoutListeners)) listener();
}

export function onLayout(cb: () => void): () => void {
  layoutListeners.add(cb);
  return () => layoutListeners.delete(cb);
}
