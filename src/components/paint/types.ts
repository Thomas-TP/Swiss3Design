// Contrat entre le formulaire de devis et l'atelier 3D (chargé à la demande) :
// types seulement, le formulaire n'importe rien d'autre de l'atelier.
import type { ViewerPaintedModel } from "@/components/catalog/viewer-props";
import type { ColorProjectSummary } from "@/lib/paint3d/summary";

export type { ColorProjectSummary };

export type PaintSourceFile =
  | { format: "stl" | "obj" | "3mf"; buffer: ArrayBuffer }
  | { format: "triangles"; positions: Float32Array };

/** Ce que l'atelier remonte au formulaire, à chaque fermeture et à l'ouverture du fichier. */
export interface PaintProject {
  /** Aperçu peint (vue « salle à manger »), ou null : le fichier tel quel suffit. */
  preview: ViewerPaintedModel | null;
  summary: ColorProjectSummary;
  /** Le projet change-t-il la pièce (plusieurs couleurs placées, taille, orientation) ? */
  matters: boolean;
  /** Échelle appliquée (le poids estimé suit son cube). */
  scale: number;
  /** Change à chaque modification : clé du 3MF déjà envoyé. */
  version: number;
  /** 3MF peint à joindre au devis (Bambu Studio, OrcaSlicer, PrusaSlicer). */
  export3mf(onProgress?: (fraction: number) => void): Promise<Blob>;
}

/** Message affiché sous l'aperçu après l'ouverture du fichier. */
export type PaintNotice =
  /** Couleurs du fichier retirées (une seule couleur) : on peut les reprendre. */
  | { kind: "fileColors"; count: number; merged: boolean; apply: () => void }
  /** Couleurs du fichier reprises (d'office à l'ouverture) : on peut les retirer. */
  | {
      kind: "fileColorsApplied";
      count: number;
      merged: boolean;
      revert: () => void;
    }
  | { kind: "error" };
