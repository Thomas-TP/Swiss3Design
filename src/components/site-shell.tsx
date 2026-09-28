"use client";

import { MotionRuntime, StageRoot } from "@/gates/runtime";
import { useMotionShell } from "@/lib/motion-bridge/shell";

// Coquille des pages vitrine (brief « Strates », §4.2 à §4.4) : montée une
// seule fois par le layout du groupe de routes (site) et conservée d'une page
// vitrine à l'autre, si bien que Lenis et le renderer WebGL survivent aux
// navigations entre accueil, boutique, fiche, Studio, sur mesure, Atelier et
// contact. Quitter (site) (panier, checkout, compte, admin, OAuth, suivi,
// légal) la démonte : Lenis est détruit, le renderer libéré, et ces pages ne
// voient jamais ni Lenis ni canvas (aucune iframe Stripe sous Lenis).
//
// Les deux moteurs n'arrivent qu'après l'hydratation, par le gate
// src/gates/runtime.tsx (next/dynamic, ssr: false : ni gsap, ni lenis, ni
// three dans le Worker), et seulement quand useMotionShell les autorise :
//   - MotionRuntime (GSAP + Lenis) : mouvement complet et capacité ≥ C1,
//     détectée dans un moment de calme (requestIdleCallback, 1 200 ms au
//     plus) ; l'interrupteur « Réduire les animations » le décharge sans
//     rechargement ;
//   - StageRoot (three) : au moins une vue enregistrée (StageView), capacité
//     ≥ C1 et aucune perte de contexte dans la session. Une page sans vue
//     (contact, sur mesure) ne télécharge jamais three.
// Rien ici ne rend de DOM : le contenu SSR des pages est complet sans eux
// (posters, textes), le mouvement ne fait que l'enrichir.
//
// La transition « Coupe » n'est PAS ici : un layout persiste d'une navigation
// à l'autre, ni enter ni exit n'y partiraient ; chaque page l'obtient en
// enveloppant son contenu dans <PageCut> (src/components/ui/page-cut.tsx).
export function SiteShell({ children }: { children: React.ReactNode }) {
  const { runtime, stage } = useMotionShell();
  return (
    <>
      {children}
      {runtime ? <MotionRuntime /> : null}
      {stage ? <StageRoot /> : null}
    </>
  );
}
