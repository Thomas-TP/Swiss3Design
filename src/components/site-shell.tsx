"use client";

// Coquille des pages vitrine : montée une seule fois par le layout du groupe
// de routes (site) et conservée d'une page vitrine à l'autre (brief de
// refonte « Strates », §4.2). C'est ici que viendront MotionRuntime (Lenis +
// GSAP) et StageRoot (renderer WebGL persistant), chargés après l'hydratation
// par src/gates/runtime.tsx. Quitter (site) (panier, checkout, compte, admin,
// OAuth, suivi, légal) la démonte : ces pages ne voient jamais ni Lenis ni
// canvas. Pour l'instant (WP-00, étape 4), elle ne fait que rendre ses enfants.
export function SiteShell({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
