"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { useReducedMotionPreference } from "@/lib/motion-bridge/use-reduced-motion";

// Relie motion/react à la préférence du site (brief « Strates », §3.6) : par
// défaut, Motion ne suit que le réglage du système ; ici, il suit data-motion,
// donc aussi l'interrupteur du footer. « always » coupe les transformations
// et les animations de mise en page de tous les composants motion ; un choix
// explicite « full » l'emporte sur le système (« never »). Les opacités
// restent animables : chaque composant règle ses durées lui-même
// (useReducedMotionPreference).
export function ReducedMotionConfig({ children }: { children: ReactNode }) {
  const reduced = useReducedMotionPreference();
  return (
    <MotionConfig reducedMotion={reduced ? "always" : "never"}>
      {children}
    </MotionConfig>
  );
}
