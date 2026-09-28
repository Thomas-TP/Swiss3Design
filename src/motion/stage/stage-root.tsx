"use client";

// StageRoot (brief « Strates », §4.4) : monte l'unique canvas du Stage,
// porté dans document.body, derrière tout le contenu (z-index −1, sans
// pointeur, aria-hidden). Chargé par la SiteShell via src/gates/runtime.tsx
// quand une vue au moins est enregistrée (useMotionShell) ; son démontage
// (sortie de (site), capacité C0, perte de contexte) libère le renderer et
// rend le contexte WebGL au navigateur.
//
// Le canvas est créé dans l'effet, pas par React : un contexte perdu par
// forceContextLoss() ne revient jamais sur le même canvas, et le double effet
// du StrictMode (développement) doit pouvoir recréer le Stage sur un canvas
// neuf. Ne rend rien dans l'arbre React.
import { useEffect } from "react";
import { motionBridge } from "@/lib/motion-bridge/store";
import { lowerDetectedCapability } from "@/lib/motion-bridge/tier";
import { Stage } from "./stage";

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

export function StageRoot() {
  useEffect(() => {
    const canvas = createCanvas();
    document.body.appendChild(canvas);
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
      canvas.remove();
    };
  }, []);

  return null;
}
