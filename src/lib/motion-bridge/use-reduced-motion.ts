// Préférence de mouvement pour les composants React (brief « Strates », §3.6).
// Remplace useReducedMotion() de motion/react, qui ne lit que le réglage du
// système : ici, la valeur suit data-motion, donc aussi l'interrupteur
// « Réduire les animations » du footer, sans rechargement.
//
// Sûr pour l'hydratation : le serveur et le premier rendu client voient
// `false` (le SSR ne connaît pas la préférence), puis React relit la vraie
// valeur juste après. Un composant rend donc le même arbre des deux côtés ;
// l'état final du mouvement réduit s'applique dans la foulée, et le CSS
// (variante motion-off, posée avant le paint) couvre l'intervalle.
import { useSyncExternalStore } from "react";
import { readReducedMotion, subscribeMotionPreference } from "./motion-pref";

const serverSnapshot = () => false;

export function useReducedMotionPreference(): boolean {
  return useSyncExternalStore(
    subscribeMotionPreference,
    readReducedMotion,
    serverSnapshot,
  );
}
