"use client";

import dynamic from "next/dynamic";

// Estimation du poids d'un fichier 3D, chargée À LA DEMANDE et jamais côté serveur :
// avec `ssr: false`, Next retire de la compilation serveur le module qui crée les
// Web Workers (src/lib/mesh-weight/client.ts), donc rien dans le Worker Cloudflare
// (règle d'or 10, même mécanisme que les portes de src/gates). Usage :
//   <MeshEstimator file={file} onResult={…} />
export const MeshEstimator = dynamic(() => import("./mesh-estimator-impl"), {
  ssr: false,
});
