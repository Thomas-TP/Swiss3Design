// Contrat entre le formulaire de devis et l'atelier 3D (chargé à la demande) :
// types seulement, le formulaire n'importe rien d'autre de l'atelier.
import type { ViewerPaintedModel } from "@/components/catalog/viewer-props";
import type { ColorProjectSummary } from "@/lib/paint3d/summary";

export type { ColorProjectSummary };

export type PaintSourceFile =
  | { format: "stl" | "obj" | "3mf"; buffer: ArrayBuffer }
  | { format: "triangles"; positions: Float32Array };

/**
 * Couleurs d'une demande. `refs` : la couleur du stock de chaque emplacement
 * (filament 1 à 4, la principale en tête), tenue par le document de l'atelier
 * dès qu'un fichier est ouvert (son historique couvre la palette). `several` :
 * plusieurs couleurs imprimées ; faux, la pièce est imprimée dans la couleur 1,
 * les autres couleurs et leurs zones restent gardées.
 */
export interface ColorSetup {
  refs: string[];
  several: boolean;
}

/** Ce que l'atelier remonte au formulaire, à chaque fermeture et à l'ouverture du fichier. */
export interface PaintProject {
  /** Aperçu peint (vue « salle à manger »), ou null : le fichier tel quel suffit. */
  preview: ViewerPaintedModel | null;
  summary: ColorProjectSummary;
  /** Le projet change-t-il la pièce (plusieurs couleurs placées, taille, orientation) ? */
  matters: boolean;
  /** Échelle appliquée (le poids estimé suit son cube). */
  scale: number;
  /** Part de la surface de chaque emplacement (0 à 1), dans l'ordre. */
  slotShares: number[];
  /** Change à chaque modification : clé du 3MF déjà envoyé. */
  version: number;
  /** 3MF peint à joindre au devis (Bambu Studio, OrcaSlicer, PrusaSlicer). */
  export3mf(onProgress?: (fraction: number) => void): Promise<Blob>;
}

/** Message affiché sous le choix des couleurs après l'ouverture du fichier. */
export type PaintNotice =
  /** Le fichier porte plusieurs couleurs : ses zones sont reprises (un emplacement par filament). */
  { kind: "fileColors"; count: number; merged: boolean } | { kind: "error" };
