// Décision de chargement des deux gates de la SiteShell (brief « Strates »,
// §4.3, §4.4) : MotionRuntime (GSAP + Lenis) et StageRoot (three). Rien n'est
// décidé avant l'hydratation : la détection de capacité attend un moment de
// calme (requestIdleCallback, 1 200 ms au plus), puis
//   - le runtime n'arrive qu'en mouvement complet et en capacité ≥ C1 ;
//   - le Stage n'arrive que s'il existe au moins une vue enregistrée, en
//     capacité ≥ C1 et sans perte de contexte : une page sans vue (contact,
//     sur mesure) ne télécharge jamais three.
// La SiteShell n'a qu'à rendre les gates selon ces deux booléens.
import { useEffect, useState } from "react";
import { motionBridge, useMotionBridge, useStageViewCount } from "./store";
import { detectCapability, webglLostInSession } from "./tier";

const IDLE_TIMEOUT_MS = 1200;

function whenIdle(run: () => void): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const handle = window.requestIdleCallback(run, {
      timeout: IDLE_TIMEOUT_MS,
    });
    return () => window.cancelIdleCallback(handle);
  }
  // Safari : pas de requestIdleCallback ; un court délai laisse passer
  // l'hydratation et le premier paint.
  const handle = window.setTimeout(run, 200);
  return () => window.clearTimeout(handle);
}

export function useMotionShell(): { runtime: boolean; stage: boolean } {
  const [settled, setSettled] = useState(false);
  const capability = useMotionBridge((s) => s.capability);
  const reduced = useMotionBridge((s) => s.reduced);
  const contextLost = useMotionBridge((s) => s.contextLost);
  const views = useStageViewCount();

  useEffect(
    () =>
      whenIdle(() => {
        // Une perte de contexte déjà subie dans la session l'emporte sur une
        // capacité mémorisée plus haute (et la classification la compte déjà).
        const lost = webglLostInSession();
        motionBridge.set({
          capability: lost ? 0 : detectCapability(),
          contextLost: lost || motionBridge.get().contextLost,
        });
        setSettled(true);
      }),
    [],
  );

  return {
    runtime: settled && !reduced && capability >= 1,
    stage: settled && views > 0 && capability >= 1 && !contextLost,
  };
}
