// Contrat entre le formulaire de devis et l'atelier 3D (chargé à la demande) :
// types seulement, le formulaire n'importe rien d'autre de l'atelier.
import type { ViewerPaintedModel } from "@/components/catalog/viewer-props";
import type { ColorProjectSummary } from "@/lib/paint3d/summary";

export type { ColorProjectSummary };

export type PaintSourceFile =
  | { format: "stl" | "obj" | "3mf"; buffer: ArrayBuffer }
  | { format: "triangles"; positions: Float32Array };

/**
 * Emplacement de couleur (un filament, 1 à 4) : un identifiant stable et la
 * couleur du stock choisie. Les zones peintes appartiennent à l'emplacement :
 * changer sa couleur ne touche jamais à la peinture (comme la liste des
 * filaments de Bambu Studio). Deux emplacements peuvent avoir la même couleur.
 */
export interface ColorSlot {
  id: number;
  ref: string;
}

/** Couleurs d'une demande : les emplacements, et une couleur ou plusieurs. */
export interface ColorSetup {
  slots: ColorSlot[];
  /**
   * Plusieurs couleurs imprimées. Faux : la pièce est imprimée dans la couleur
   * de l'emplacement 1 ; les autres emplacements et la peinture restent gardés.
   */
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
