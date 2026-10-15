"use client";

import dynamic from "next/dynamic";
import type { StudioOrderLine } from "@/lib/studio/order-line";

// Seul chemin de l'admin vers la génération du STL : `next/dynamic` avec
// `ssr: false` retire l'import du build serveur, donc la géométrie du Studio
// (générateurs, noyau de maillage, contours des glyphes) n'entre pas dans le
// Worker (AGENTS.md, règle d'or 10, même mécanique que les gates du mouvement).
// Un composant serveur ne peut pas poser `ssr: false` : d'où ce fichier client.
const StudioStlButton = dynamic(() => import("./studio-stl-button"), {
  ssr: false,
  loading: () => (
    <button type="button" disabled className="opacity-50">
      Télécharger le STL
    </button>
  ),
});

export function StudioStlGate(props: {
  line: StudioOrderLine;
  label: string;
  className?: string;
}) {
  return <StudioStlButton {...props} />;
}
