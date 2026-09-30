"use client";

// Gate de la fiche produit (brief « Strates », §4.1, §9.2) : seul chemin du DOM
// vers la chorégraphie de la fiche (src/motion/choreo/product.tsx : GSAP,
// ScrollTrigger, SplitText). Avec `ssr: false`, le transform de Next retire
// l'import du build serveur : le Worker ne voit jamais gsap. La scène
// `product-viewer` n'a pas de gate ici : elle passe par le registre du Stage
// (une vue déclarée par <StageView>, chargée par la SiteShell).
import dynamic from "next/dynamic";

export const ProductChoreo = dynamic(
  () => import("@/motion/choreo/product").then((m) => m.ProductChoreo),
  { ssr: false },
);
