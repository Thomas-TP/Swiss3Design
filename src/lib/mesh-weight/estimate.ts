// Poids d'une pièce estimé d'après son maillage : la MÊME physique que le Studio
// (lib/studio/stats.ts) : coque de 0,8 mm pleine + remplissage à 15 % du reste
// (`V_coque = min(V, A × 0,8)`), PLA à 1,24 g/cm³. L'estimation affichée au client
// est cette valeur brute ; le filtre des couleurs en stock y ajoute une marge
// (`quoteNeedGrams` : × 1,15 + 15 g).
import { PRINT } from "@/lib/studio/print-params";
import { solidPrintVolume } from "@/lib/studio/solid-volume";
import type { MeshStats } from "./geometry";

export type EstimateIssue =
  /** Maillage vide ou volume nul : rien à estimer. */
  | "empty"
  /** Plus petit que 2 mm : unité probablement fausse (mètres, pouces). */
  | "tiny"
  /** Volume supérieur à celui de la boîte englobante : maillage ouvert ou recouvrant, valeur plafonnée. */
  | "overlap";

export interface Estimate {
  /** Grammes d'UNE pièce, valeur brute (arrondie au gramme). */
  grams: number;
  /** Anomalie tolérée ou bloquante (voir `blocking`). */
  issue: EstimateIssue | null;
  /** Vrai : on n'invente pas d'estimation, le client doit changer de fichier. */
  blocking: boolean;
}

export function estimateFromMesh(stats: MeshStats): Estimate {
  const [x0, y0, z0, x1, y1, z1] = stats.bbox;
  const size = [x1 - x0, y1 - y0, z1 - z0];
  const finite =
    size.every(Number.isFinite) && Number.isFinite(stats.volumeMm3);
  if (!finite || stats.triangles === 0 || stats.volumeMm3 <= 0)
    return { grams: 0, issue: "empty", blocking: true };
  if (Math.max(...size) < 2) return { grams: 0, issue: "tiny", blocking: true };
  const boxVolume = size[0] * size[1] * size[2];
  const overlap = stats.volumeMm3 > boxVolume * 1.0001;
  const volume = overlap
    ? Math.min(stats.volumeMm3, boxVolume)
    : stats.volumeMm3;
  const printed = solidPrintVolume(volume, stats.areaMm2);
  return {
    grams: Math.max(1, Math.round((printed / 1000) * PRINT.densityGcm3)),
    issue: overlap ? "overlap" : null,
    blocking: false,
  };
}
