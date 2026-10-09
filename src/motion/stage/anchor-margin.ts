// Marge du canvas ancré au document (brief « Strates », §4.4) : combien de
// pixels de canvas déborde la fenêtre, et de quel côté.
//
// Le canvas ancré fait la fenêtre plus une marge au-dessus et au-dessous
// (stage-root.tsx). Quand le compositeur défile seul (clavier, Pages, barre de
// défilement, tactile), le fil principal ne recale le canvas qu'à sa frame
// suivante : entre-temps le DOM a avancé d'au moins un pas de défilement, et
// plus si le fil principal est occupé (une tâche longue, un décodage d'image). Ce
// retard mange la marge du côté où l'on va ; le côté d'où l'on vient ne perd
// rien (mesuré, measures-wp99-canvas.md : −2 à −10 px). La moitié de la marge ne
// sert donc à rien en défilement continu.
//
// Deux réglages en découlent, pour que le canvas coûte moins de pixels sans que
// la marge utile baisse :
//   - une marge de base plus petite à la souris qu'au doigt (inertie du lancer) ;
//   - l'ANTICIPATION : le canvas est décalé dans le sens du défilement
//     (`anchorLead`) de la distance que le défilement parcourt en
//     ANCHOR_LEAD_SECONDS à sa vitesse actuelle, sans jamais manger plus de
//     1 − ANCHOR_TRAIL_KEEP de la marge côté arrière. La marge côté avant monte
//     ainsi à (2 − ANCHOR_TRAIL_KEEP) fois la marge de base dès que l'on défile
//     vite, soit de quoi absorber un fil principal bloqué ANCHOR_LEAD_SECONDS de
//     plus que sa marge de base ; à l'arrêt, ou en défilement lent, elle reste
//     symétrique. Le décalage ne change que quand le défilement change : le
//     canvas n'est jamais déplacé sans être redessiné dans la même tâche (loop.ts).

/** Marge de base (fraction de la fenêtre, de chaque côté) d'un appareil à pointeur précis seul. */
export const ANCHOR_MARGIN_FINE = 0.3;
/** Marge de base dès qu'un pointeur grossier (doigt) est présent : inertie du lancer. */
export const ANCHOR_MARGIN_COARSE = 0.5;
/** Anticipation : durée (s) de défilement, à la vitesse actuelle, que le côté avant couvre en plus. */
export const ANCHOR_LEAD_SECONDS = 0.1;
/** Part de la marge toujours gardée côté arrière : un demi-tour brutal ne trouve jamais le bord. */
export const ANCHOR_TRAIL_KEEP = 0.2;
/** Intervalle minimal (ms) entre deux mesures de vitesse : deux appels dans la même frame ne comptent pas double. */
const MIN_INTERVAL_MS = 4;

/** Un doigt est-il parmi les pointeurs de l'appareil (écran tactile, même d'un portable) ? */
export function hasCoarsePointer(): boolean {
  try {
    return window.matchMedia("(any-pointer: coarse)").matches;
  } catch {
    return false;
  }
}

/** Marge de base du canvas ancré, en fraction de la hauteur de la fenêtre, de chaque côté. */
export function anchorMargin(coarsePointer: boolean): number {
  return coarsePointer ? ANCHOR_MARGIN_COARSE : ANCHOR_MARGIN_FINE;
}

/** Hauteur du canvas ancré, en fenêtres : la fenêtre et ses deux marges de base. */
export function anchorCanvasViewports(margin: number): number {
  return 1 + 2 * margin;
}

/**
 * Décalage d'anticipation (px) : dans le sens du défilement (positif vers le
 * bas), proportionnel à sa vitesse (px/s), borné pour garder ANCHOR_TRAIL_KEEP
 * de la marge côté arrière. `margin` : la marge de base, en px.
 */
export function anchorLead(velocity: number, margin: number): number {
  const room = margin * (1 - ANCHOR_TRAIL_KEEP);
  const lead = velocity * ANCHOR_LEAD_SECONDS;
  if (!Number.isFinite(lead)) return 0;
  return Math.max(-room, Math.min(room, lead));
}

/**
 * Mémoire de l'anticipation : la vitesse se mesure d'un défilement au suivant
 * (pas d'une frame sans défilement), donc le décalage ne change que quand le
 * défilement change et le canvas ne bouge, sans être redessiné, que par un
 * changement de taille ou de mode, comme avant.
 */
export function createAnchorLead() {
  let lastScrollY = Number.NaN;
  let lastAt = 0;
  let lead = 0;
  return {
    /**
     * Décalage à appliquer pour ce défilement (px, signé). `margin` : marge de
     * base en px ; `nowMs` : horloge de performance.now().
     */
    update(scrollY: number, margin: number, nowMs: number): number {
      if (scrollY !== lastScrollY) {
        if (Number.isNaN(lastScrollY)) lead = 0;
        else {
          const dt = Math.max(MIN_INTERVAL_MS, nowMs - lastAt);
          lead = anchorLead(((scrollY - lastScrollY) / dt) * 1000, margin);
        }
        lastScrollY = scrollY;
        lastAt = nowMs;
      }
      return lead;
    },
    /** Retour à la symétrie (changement de mode, de taille). */
    reset() {
      lastScrollY = Number.NaN;
      lead = 0;
    },
  };
}
