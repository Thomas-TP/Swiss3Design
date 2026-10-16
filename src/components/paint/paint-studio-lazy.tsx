"use client";

import dynamic from "next/dynamic";

// Atelier 3D de « Sur mesure » (peinture par zone, taille, orientation), chargé À
// LA DEMANDE et jamais côté serveur : avec `ssr: false`, Next retire de la
// compilation serveur le document, la BVH, l'écriture du 3MF et les panneaux
// (src/lib/paint3d, src/components/paint), donc rien dans le Worker Cloudflare
// (règle d'or 10, même mécanisme que mesh-estimator.tsx). La scène 3D, elle,
// vient du registre du Stage (scène « paint-editor »).
export const PaintStudio = dynamic(
  () => import("./paint-studio").then((m) => m.PaintStudio),
  { ssr: false },
);
