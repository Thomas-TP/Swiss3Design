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
// Un seul montage, aux deux paliers (C1 et C2) : le canvas est ANCRÉ AU
// DOCUMENT (retour R16 : « les objets 3D sautent au défilement » ; décision du
// propriétaire du 08.10.2026 : en C2 aussi, avec un rapport de pixels plafonné à
// 1,5 sous un budget de pixels, pixel-ratio.ts). Un canvas `fixed` ne bouge pas avec la page : dès que
// le défilement est natif, donc mené par le compositeur, qui avance le DOM sans
// attendre le fil principal (tactile, clavier : flèches, Espace, Pages, Début et
// Fin ; barre de défilement), il montre l'objet une ou deux frames en retard sur
// son conteneur (mesuré en C2 au clavier : jusqu'à 10 px d'écart). Ancré, le
// canvas défile avec le DOM, côté compositeur, et reste collé à son conteneur ;
// la boucle le recale à chaque frame sur la position du fil principal
// (ticker.ts). Le défilement de Lenis (molette, trackpad) est mené par le fil
// principal dans la même frame que le dessin : lui aussi reste collé, c'est le
// même recalage, sans rien à gérer. Le clavier reste natif (accessibilité) :
// Lenis n'en intercepte aucune touche.
//
// Déclassement C2 → C1 en cours de session : le montage ne change pas (seul le
// Stage s'ajuste), il n'y a plus de cas où le canvas resterait fixe.
import { useEffect } from "react";
import { motionBridge } from "@/lib/motion-bridge/store";
import { lowerDetectedCapability } from "@/lib/motion-bridge/tier";
import {
  anchorCanvasViewports,
  anchorMargin,
  createAnchorLead,
  hasCoarsePointer,
} from "./anchor-margin";
import { Stage } from "./stage";
import { anchorPlacement, setCanvasAnchor, type CanvasAnchor } from "./ticker";

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.className = "s3d-stage";
  canvas.setAttribute("aria-hidden", "true");
  // La géométrie (absolue, la fenêtre plus ses marges de haut, ou fixe en mode « live »)
  // est posée par mountAnchored : elle l'emporte sur la règle .s3d-stage de
  // globals.css, quel que soit l'ordre de chargement des styles.
  const style = canvas.style;
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
 * n'allonge jamais la page), derrière le contenu, et dans lui un canvas de la
 * hauteur de la fenêtre plus une marge au-dessus et au-dessous (0,3 fenêtre à la
 * souris, 0,5 dès qu'il y a un doigt : anchor-margin.ts) que `follow` cale sur
 * le défilement. La marge couvre l'avance du compositeur sur le fil principal :
 * un pas de défilement par frame, et plus quand le fil principal est chargé.
 * Côté avant elle monte jusqu'à 1,8 fois sa valeur de base (anticipation
 * dans le sens du défilement, aux dépens du côté arrière).
 *
 * Quand une vue « live » est proche de la fenêtre (collante ou épinglée : le
 * Studio sur grand écran, le héros épinglé de l'accueil en C2), le calque
 * devient fixe, de la taille de la fenêtre, et le canvas n'est plus décalé :
 * un élément collant ou épinglé reste en place dans la fenêtre pendant que le
 * compositeur fait défiler le document, c'est un canvas fixe qu'il lui faut. Le
 * canvas garde sa taille dans les deux modes, donc le changement ne
 * redimensionne pas le rendu. Dès que cette vue s'éloigne (le héros, passé),
 * le calque redevient ancré au document : view-tracker.ts, syncAnchor().
 */
function mountAnchored(canvas: HTMLCanvasElement): Anchored {
  const wrapper = document.createElement("div");
  wrapper.setAttribute("aria-hidden", "true");
  wrapper.className = "s3d-stage-anchor";
  const w = wrapper.style;
  w.left = "0";
  w.width = "100%";
  w.top = "0";
  // `hidden` d'abord : un navigateur sans overflow: clip (Safari < 16) garde
  // cette valeur, la page ne s'allonge pas non plus.
  w.overflow = "hidden";
  w.overflow = "clip";
  w.zIndex = "-1";
  w.pointerEvents = "none";

  // Marge de chaque côté (fraction de la fenêtre) : plus petite à la souris
  // qu'au doigt (pixel-ratio.ts). Le canvas fait la fenêtre plus deux marges.
  const marginRatio = anchorMargin(hasCoarsePointer());
  const heightPct = anchorCanvasViewports(marginRatio) * 100;
  const s = canvas.style;
  s.position = "absolute";
  s.inset = "auto";
  s.top = "0";
  s.left = "0";
  s.width = "100%";
  s.height = `${heightPct}vh`;
  s.height = `${heightPct}lvh`;
  s.zIndex = "auto";
  s.willChange = "transform";

  let live = false;
  let appliedLive: boolean | null = null;
  const applyMode = () => {
    appliedLive = live;
    if (live) {
      w.position = "fixed";
      w.height = "100vh";
      w.height = "100lvh";
      s.transform = "none";
    } else {
      w.position = "absolute";
      w.height = `${documentHeight()}px`;
    }
  };
  applyMode();

  wrapper.appendChild(canvas);
  document.body.appendChild(wrapper);

  // Marge en pixels : sa part de la hauteur du canvas (marge / (1 + 2 × marge)).
  // Relue quand le canvas change de taille (rotation, barre d'adresse).
  const marginShare = marginRatio / anchorCanvasViewports(marginRatio);
  let margin = canvas.clientHeight * marginShare;
  let offset = margin;
  let lastTop = Number.NaN;

  // Anticipation dans le sens du défilement (anchor-margin.ts).
  const lead = createAnchorLead();

  const sizeObserver = new ResizeObserver(() => {
    margin = canvas.clientHeight * marginShare;
    lead.reset();
    lastTop = Number.NaN;
  });
  sizeObserver.observe(canvas);
  // La page grandit ou rétrécit (images, polices, accordéons) : le calque la
  // suit, sinon le canvas serait rogné trop tôt ou allongerait le défilement.
  const docObserver = new ResizeObserver(() => {
    if (!live) w.height = `${documentHeight()}px`;
  });
  docObserver.observe(document.body);

  const anchor: CanvasAnchor = {
    setLive(next) {
      live = next;
    },
    follow(scrollY) {
      if (live !== appliedLive) {
        applyMode();
        lead.reset();
        lastTop = Number.NaN;
      }
      if (live) {
        offset = 0;
        return;
      }
      // Haut du canvas dans le document : une marge au-dessus de la fenêtre,
      // moins l'anticipation (le canvas avance dans le sens du défilement).
      const placed = anchorPlacement(
        scrollY,
        margin,
        window.devicePixelRatio || 1,
        lead.update(scrollY, margin, performance.now()),
      );
      const top = placed.top;
      offset = placed.offset;
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
    // La SiteShell ne monte StageRoot qu'à partir de C1 : toujours ancré.
    const anchored = mountAnchored(canvas);
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
      anchored.dispose();
      canvas.remove();
    };
  }, []);

  return null;
}
