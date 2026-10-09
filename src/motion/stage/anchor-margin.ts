// Marge du canvas ancrÃ© au document (brief Â« Strates Â», Â§4.4) : combien de
// pixels de canvas dÃ©borde la fenÃªtre, et de quel cÃ´tÃ©.
//
// Le canvas ancrÃ© fait la fenÃªtre plus une marge au-dessus et au-dessous
// (stage-root.tsx). Quand le compositeur dÃ©file seul (clavier, Pages, barre de
// dÃ©filement, tactile), le fil principal ne recale le canvas qu'Ã  sa frame
// suivante : entre-temps le DOM a avancÃ© d'au moins un pas de dÃ©filement, et
// plus si le fil principal est occupÃ© (une tÃ¢che longue, un dÃ©codage d'image). Ce
// retard mange la marge du cÃ´tÃ© oÃ¹ l'on va ; le cÃ´tÃ© d'oÃ¹ l'on vient ne perd
// rien (mesurÃ©, measures-wp99-canvas.md : âˆ’2 Ã  âˆ’10 px). La moitiÃ© de la marge ne
// sert donc Ã  rien en dÃ©filement continu.
//
// Deux rÃ©glages en dÃ©coulent, pour que le canvas coÃ»te moins de pixels sans que
// la marge utile baisse :
//   - une marge de base plus petite Ã  la souris qu'au doigt (inertie du lancer) ;
//   - l'ANTICIPATION : le canvas est dÃ©calÃ© dans le sens du dÃ©filement
//     (`anchorLead`) de la distance que le dÃ©filement parcourt en
//     ANCHOR_LEAD_SECONDS Ã  sa vitesse actuelle, sans jamais manger plus de
//     1 âˆ’ ANCHOR_TRAIL_KEEP de la marge cÃ´tÃ© arriÃ¨re. La marge cÃ´tÃ© avant monte
//     ainsi Ã  (2 âˆ’ ANCHOR_TRAIL_KEEP) fois la marge de base dÃ¨s que l'on dÃ©file
//     vite, soit de quoi absorber un fil principal bloquÃ© ANCHOR_LEAD_SECONDS de
//     plus que sa marge de base ; Ã  l'arrÃªt, ou en dÃ©filement lent, elle reste
//     symÃ©trique. Le dÃ©calage ne change que quand le dÃ©filement change : le
//     canvas n'est jamais dÃ©placÃ© sans Ãªtre redessinÃ© dans la mÃªme tÃ¢che (loop.ts).

/** Marge de base (fraction de la fenÃªtre, de chaque cÃ´tÃ©) d'un appareil Ã  pointeur prÃ©cis seul. */
export const ANCHOR_MARGIN_FINE = 0.3;
/** Marge de base dÃ¨s qu'un pointeur grossier (doigt) est prÃ©sent : inertie du lancer. */
export const ANCHOR_MARGIN_COARSE = 0.5;
/** Anticipation : durÃ©e (s) de dÃ©filement, Ã  la vitesse actuelle, que le cÃ´tÃ© avant couvre en plus. */
export const ANCHOR_LEAD_SECONDS = 0.1;
/** Part de la marge toujours gardÃ©e cÃ´tÃ© arriÃ¨re : un demi-tour brutal ne trouve jamais le bord. */
export const ANCHOR_TRAIL_KEEP = 0.2;
/** Intervalle minimal (ms) entre deux mesures de vitesse : deux appels dans la mÃªme frame ne comptent pas double. */
const MIN_INTERVAL_MS = 4;

/** Marge de base du canvas ancrÃ©, en fraction de la hauteur de la fenÃªtre, de chaque cÃ´tÃ©. */
export function anchorMargin(coarsePointer: boolean): number {
  return coarsePointer ? ANCHOR_MARGIN_COARSE : ANCHOR_MARGIN_FINE;
}

/** Hauteur du canvas ancrÃ©, en fenÃªtres : la fenÃªtre et ses deux marges de base. */
export function anchorCanvasViewports(margin: number): number {
  return 1 + 2 * margin;
}

/**
 * DÃ©calage d'anticipation (px) : dans le sens du dÃ©filement (positif vers le
 * bas), proportionnel Ã  sa vitesse (px/s), bornÃ© pour garder ANCHOR_TRAIL_KEEP
 * de la marge cÃ´tÃ© arriÃ¨re. `margin` : la marge de base, en px.
 */
export function anchorLead(velocity: number, margin: number): number {
  const room = margin * (1 - ANCHOR_TRAIL_KEEP);
  const lead = velocity * ANCHOR_LEAD_SECONDS;
  if (!Number.isFinite(lead)) return 0;
  return Math.max(-room, Math.min(room, lead));
}

/**
 * MÃ©moire de l'anticipation : la vitesse se mesure d'un dÃ©filement au suivant
 * (pas d'une frame sans dÃ©filement), donc le dÃ©calage ne change que quand le
 * dÃ©filement change et le canvas ne bouge, sans Ãªtre redessinÃ©, que par un
 * changement de taille ou de mode, comme avant.
 */
export function createAnchorLead() {
  let lastScrollY = Number.NaN;
  let lastAt = 0;
  let lead = 0;
  return {
    /**
     * DÃ©calage Ã  appliquer pour ce dÃ©filement (px, signÃ©). `margin` : marge de
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
    /** Retour Ã  la symÃ©trie (changement de mode, de taille). */
    reset() {
      lastScrollY = Number.NaN;
      lead = 0;
    },
  };
}
