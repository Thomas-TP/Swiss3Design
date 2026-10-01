"use client";

import { HomeChoreo } from "@/gates/home";
import { useMotionBridge } from "@/lib/motion-bridge/store";

// Porte de la chorégraphie de l'accueil (brief « Strates », §4.1, §5.5) : rien
// ne part tant que le runtime (GSAP + Lenis) n'est pas prêt, c'est-à-dire en
// mouvement complet et en capacité ≥ C1. En mouvement réduit comme en C0, la
// page est dans son état final dans le HTML, sans rien à défaire : le chunk de
// la chorégraphie n'est alors jamais téléchargé. Le gate (src/gates/home.tsx)
// est le seul chemin du DOM vers src/motion/choreo/home.tsx.
export function HomeMotion() {
  const runtimeReady = useMotionBridge((state) => state.runtimeReady);
  return runtimeReady ? <HomeChoreo /> : null;
}
