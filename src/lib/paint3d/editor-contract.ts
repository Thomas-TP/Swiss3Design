// Contrat léger entre l'atelier 3D du DOM (src/components/paint) et sa scène du
// Stage (src/motion/stage/scenes/paint-editor.ts). Types seulement : rien de
// three, rien qui s'exécute (brief « Strates », §4.5).
import type { PaintDocument } from "./document";
import type { FillMode } from "./tools";

export type PaintTool =
  | "orbit"
  | "brush"
  | "triangle"
  | "fill"
  | "height"
  | "erase"
  | "measure"
  | "lay";

/** Bandes de hauteur : tout au-dessus du clic, tout en dessous, ou une bande. */
export type HeightMode = "above" | "below" | "band";

export type ViewPreset =
  | "iso"
  | "front"
  | "back"
  | "left"
  | "right"
  | "top"
  | "bottom"
  | "fit";

export interface PaintEditorProps {
  doc: PaintDocument;
  /** `doc.version` au rendu : un nouvel instantané à chaque modification. */
  version: number;
  /** Teintes de chaque emplacement (1 à 3 pour une bobine co-extrudée). */
  palette: readonly (readonly string[])[];
  tool: PaintTool;
  /** Emplacement peint (0 = la base, jusqu'à 3). */
  slot: number;
  /** Rayon du pinceau (mm, à la taille choisie). */
  brushRadius: number;
  /** Le pinceau traverse la pièce (faces cachées comprises). */
  throughWalls: boolean;
  fillMode: FillMode;
  /** Angle limite du remplissage « surface lisse » (degrés). */
  fillAngle: number;
  heightMode: HeightMode;
  /** Épaisseur d'une bande (mm). */
  bandHeight: number;
  /** Coupe : on ne voit (ni ne peint) que ce qui est sous cette hauteur (mm). */
  clipZ: number | null;
  /** Côté du plateau (mm) : celui de l'imprimante. */
  plate: number;
  /** Commande de vue (préréglage), rejouée quand `nonce` change. */
  viewCommand: { preset: ViewPreset; nonce: number } | null;
  /** Pointeur au-dessus de la pièce : hauteur (mm) sous le curseur, ou null. */
  onHover?: (hover: { z: number } | null) => void;
  /** Mesure en cours (outil « mesure »), en mm sur le plateau. */
  onMeasure?: (measure: PaintMeasure | null) => void;
  /** Une étape vient d'être faite par la scène (trait, remplissage, pose). */
  onEdit?: () => void;
  /** Première image rendue. */
  onReady?: () => void;
}

export interface PaintMeasure {
  a: [number, number, number];
  b: [number, number, number] | null;
  /** Distance A–B (mm), ou null tant que B manque. */
  distance: number | null;
}
