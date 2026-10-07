"use client";

// StageRoot (brief « Strates », §4.4) : monte l'unique canvas du Stage, porté
// dans document.body, derrière tout le contenu (z-index −1, sans pointeur,
// aria-hidden). Chargé par la SiteShell via src/gates/runtime.tsx quand une
// vue au moins est enregistrée (useMotionShell) ; son démontage (sortie de
// (site), capacité C0, perte de contexte) libère le renderer et rend le
// contexte WebGL au navigateur.
//
// Le canvas est créé dans l'effet, pas par React : un contexte perdu par
// forceContextLoss() ne revient jamais sur le même canvas, et le double effet
// du StrictMode (développement) doit pouvoir recréer le Stage sur un canvas
// neuf. Ne rend rien dans l'arbre React.
//
// Deux montages selon le palier :
//   - C2 (bureau) : canvas `fixed` de la taille de la fenêtre. Le défilement y
//     est celui de Lenis, mené par le fil principal dans la même frame que le
//     dessin : DOM et canvas ne se séparent jamais (mesuré : 0,4 px au plus).
//   - C1 (mobile, petit écran, machine modeste) : canvas ANCRÉ AU DOCUMENT.
//     Le défilement tactile reste natif, donc mené par le compositeur, qui
//     avance le DOM sans attendre le fil principal : un canvas fixe montrerait
//     l'objet une ou deux frames en retard sur son conteneur (retour R16 :
//     « les objets 3D sautent au défilement »). Ancré, le canvas défile avec
//     le DOM, côté compositeur, et reste collé à son conteneur ; la boucle le
//     recale à chaque frame sur la position du fil principal (ticker.ts).
import { useEffect } from "react";
import { motionBridge } from "@/lib/motion-bridge/store";
import { lowerDetectedCapability } from "@/lib/motion-bridge/tier";
import { Stage } from "./stage";
import { setCanvasAnchor, type CanvasAnchor } from "./ticker";

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.className = "s3d-stage";
  canvas.setAttribute("aria-hidden", "true");
  // Mêmes règles que .s3d-stage (globals.css), posées aussi ici pour que le
  // calque reste juste quel que soit l'ordre de chargement des styles. 100lvh
  // (grande fenêtre mobile) : la barre d'adresse qui bouge ne redimensionne
  // pas le canvas ; repli 100vh là où lvh n'existe pas.
  const style = canvas.style;
  style.position = "fixed";
  style.inset = "0";
  style.width = "100vw";
  style.height = "100vh";
  style.height = "100lvh";
  style.zIndex = "-1";
  style.pointerEvents = "none";
  style.display = "block";
  return canvas;
}

/** Hauteur du document, hors calque du Stage (qui est absolu et ne compte pas). */
function documentHeight(): number {
  return Math.max(document.body.offsetHeight, window.innerHeight);
}

interface Anchored {
  anchor: CanvasAnchor;
  dispose(): void;
}

/**
 * Monte le canvas ancré au document : un calque absolu de la hauteur de la
 * page, rogné (overflow: clip, pour que le canvas, plus haut que la fenêtre,
 * n'allonge jamais la page), derrière le contenu, et dans lui un canvas de
 * deux fenêtres de haut (une demi-fenêtre de marge au-dessus et au-dessous de
 * la fenêtre visible) que `follow` cale sur le défilement. La marge couvre
 * l'avance du compositeur sur le fil principal (au pire quelques dizaines de
 * pixels par frame, même en lancer rapide).
 */
function mountAnchored(canvas: HTMLCanvasElement): Anchored {
  const wrapper = document.createElement("div");
  wrapper.setAttribute("aria-hidden", "true");
  wrapper.className = "s3d-stage-anchor";
  const w = wrapper.style;
  w.position = "absolute";
  w.top = "0";
  w.left = "0";
  w.width = "100%";
  w.height = `${documentHeight()}px`;
  // `hidden` d'abord : un navigateur sans overflow: clip (Safari < 16) garde
  // cette valeur, la page ne s'allonge pas non plus.
  w.overflow = "hidden";
  w.overflow = "clip";
  w.zIndex = "-1";
  w.pointerEvents = "none";

  const s = canvas.style;
  s.position = "absolute";
  s.inset = "auto";
  s.top = "0";
  s.left = "0";
  s.width = "100%";
  s.height = "200vh";
  s.height = "200lvh";
  s.zIndex = "auto";
  s.willChange = "transform";

  wrapper.appendChild(canvas);
  document.body.appendChild(wrapper);

  // Marge = un quart de la hauteur du canvas (une demi-fenêtre). Relue quand
  // le canvas change de taille (rotation, barre d'adresse).
  let margin = canvas.clientHeight / 4;
  let offset = margin;
  let lastTop = Number.NaN;

  const sizeObserver = new ResizeObserver(() => {
    margin = canvas.clientHeight / 4;
    lastTop = Number.NaN;
  });
  sizeObserver.observe(canvas);
  // La page grandit ou rétrécit (images, polices, accordéons) : le calque la
  // suit, sinon le canvas serait rogné trop tôt ou allongerait le défilement.
  const docObserver = new ResizeObserver(() => {
    w.height = `${documentHeight()}px`;
  });
  docObserver.observe(document.body);

  const anchor: CanvasAnchor = {
    follow(scrollY) {
      // Haut du canvas dans le document : une marge au-dessus de la fenêtre,
      // arrondi au pixel physique (un décalage fractionnaire rééchantillonne
      // le canvas et le rend flou).
      const dpr = window.devicePixelRatio || 1;
      const top = Math.round((scrollY - margin) * dpr) / dpr;
      offset = scrollY - top;
      if (top === lastTop) return;
      lastTop = top;
      s.transform = `translate3d(0, ${top}px, 0)`;
    },
    offsetY: () => offset,
  };
  setCanvasAnchor(anchor);

  return {
    anchor,
    dispose() {
      setCanvasAnchor(null);
      sizeObserver.disconnect();
      docObserver.disconnect();
      wrapper.remove();
    },
  };
}

export function StageRoot() {
  useEffect(() => {
    const canvas = createCanvas();
    // Palier lu au montage : un déclassement C2 → C1 en cours de session garde
    // le canvas fixe (le Stage redimensionne son rendu, pas son montage).
    const anchored =
      motionBridge.get().capability === 1 ? mountAnchored(canvas) : null;
    if (!anchored) document.body.appendChild(canvas);
    let stage: Stage | null = null;
    try {
      stage = new Stage(canvas);
    } catch (error) {
      // Aucun contexte WebGL2 malgré la sonde : posters (C0) pour la session.
      console.warn("[stage] WebGL indisponible", error);
      motionBridge.set({ capability: lowerDetectedCapability(0) });
    }
    return () => {
      stage?.dispose();
      anchored?.dispose();
      canvas.remove();
    };
  }, []);

  return null;
}
