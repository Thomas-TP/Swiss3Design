// Contrat léger entre le viewer de la fiche (DOM, product-viewer.tsx) et la
// scène `product-viewer` du Stage (côté lourd, atteinte seulement par le
// Stage). Ce fichier n'importe rien de three : le DOM et la scène le lisent
// tous les deux (brief « Strates », §4.1, §4.5).
//
// Licence : le viewer MONTRE et FAIT TOURNER le fichier original de Ian (CC
// BY-ND 4.0), rien d'autre. Ce contrat ne porte donc ni zoom, ni plan de coupe,
// ni mode « impression », ni teinte libre : seulement une couleur réellement
// vendue, l'autorotation et la rotation (§1.5, §7.9).

export type ViewerState = "idle" | "loading" | "ready" | "error";

/** Avancement du chargement du STL, remonté au DOM pour l'attente narrée. */
export interface ViewerStatus {
  state: ViewerState;
  receivedBytes: number;
  /** Taille annoncée par le serveur (Content-Length), sinon null. */
  totalBytes: number | null;
}

export interface ProductViewerProps {
  /** STL (ou GLB) du produit, même origine que la page (`/api/files/…`). */
  modelUrl: string;
  /** Couleur réellement vendue (hex), celle de la pastille choisie à l'achat. */
  color: string;
  /** Mouvement complet demandé ; la scène ne tourne seule qu'en capacité C2. */
  autoRotate: boolean;
  /** Rappel appelé au changement d'état et pendant le chargement (≈ 4 Hz). */
  onStatus?: (status: ViewerStatus) => void;
}

/** Événement DOM des boutons « Tourner » vers la scène (sur l'élément de la vue). */
export const VIEWER_TURN_EVENT = "s3d-viewer-turn";

export interface ViewerTurnDetail {
  /** −1 : vers la gauche, +1 : vers la droite (un cran = 15°). */
  step: -1 | 1;
}

/** Teinte de repli si le produit ne liste aucune couleur : un blanc neutre. */
export const VIEWER_FALLBACK_COLOR = "#ddd9d0";

// Tailles connues des modèles, pour l'attente narrée quand le serveur ne
// donne pas de Content-Length (le STL du Vase spirale est servi en flux :
// 84 + 50 × 46 756 triangles = 2 337 884 octets). Une indication (« ≈ »), pas
// une promesse : le texte de la page dit « ≈ 2,2 Mo ».
export const MODEL_SIZE_HINTS: Readonly<Record<string, number>> = {
  "vase-spirale": 2_337_884,
};
