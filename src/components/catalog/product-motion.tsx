"use client";

import { ProductChoreo } from "@/gates/product";
import { useMotionBridge } from "@/lib/motion-bridge/store";

// Monte la chorégraphie de la fiche (titres de chapitre, brief « Strates »,
// §3.3) une fois le runtime GSAP prêt : mouvement complet et capacité ≥ C1
// seulement (`runtimeReady` n'est vrai que dans ce cas, et redevient faux quand
// l'interrupteur « Réduire les animations » est actionné : la chorégraphie se
// démonte alors et remet les titres dans leur état final). Ne rend rien : le
// contenu SSR de la fiche est complet sans elle.
export function ProductMotion() {
  const ready = useMotionBridge((s) => s.runtimeReady);
  return ready ? <ProductChoreo /> : null;
}
