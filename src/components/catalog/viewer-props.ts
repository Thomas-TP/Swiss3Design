// Contrat léger entre le viewer de la fiche (DOM, product-viewer.tsx) et la
// scène `product-viewer` du Stage (côté lourd, atteinte seulement par le
// Stage). Ce fichier n'importe rien de three : le DOM et la scène le lisent
// tous les deux (brief « Strates », §4.1, §4.5).
//
// Licence : le viewer MONTRE et FAIT TOURNER le fichier original de Ian (CC
// BY-ND 4.0), rien d'autre. Ce contrat ne porte donc ni zoom, ni plan de coupe,
// ni mode « impression », ni teinte libre : seulement les teintes d'une bobine
// réellement vendue, l'autorotation et la rotation (§1.5, §7.9).

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
  /**
   * Teintes (hex) de la bobine choisie à l'achat : une seule, ou 2 à 3 pour une
   * bobine co-extrudée (bicolore, tricolore), rendue en secteurs autour de la pièce.
   */
  colors: readonly string[];
  /** Mouvement complet demandé ; la scène ne tourne seule qu'en capacité C2. */
  autoRotate: boolean;
  /** Pièce où la pièce est posée (null : le fond neutre de la page). */
  decor: ViewerDecor | null;
  /** Rappel appelé au changement d'état et pendant le chargement (≈ 4 Hz). */
  onStatus?: (status: ViewerStatus) => void;
}

/**
 * Décor de la vue : une pièce 3D à l'éclairage précalculé (glTF, textures WebP,
 * servie depuis `public/`), où la pièce vendue est posée sur un meuble. La pièce
 * est montrée telle quelle, à l'échelle réelle, sans être modifiée : le décor
 * l'entoure, il ne la transforme pas.
 */
export interface ViewerDecor {
  /** glTF du décor (même origine : ses .bin et .webp se chargent à côté). */
  url: string;
  /** Point d'appui de la pièce dans le décor (mètres, Y vers le haut). */
  anchor: readonly [number, number, number];
  /** Crédit exigé par la licence du décor (rendu sous la vue). */
  credit: {
    title: string;
    author: string;
    url: string;
    license: string;
    licenseUrl: string;
  };
}

/**
 * La salle à manger de ChristyHsu (« Dining room | Kichen baked », Sketchfab,
 * CC BY 4.0), adaptée pour le web : vase et bouquet d'origine retirés, petits
 * objets du plan de travail simplifiés, matériaux sans éclairage (la lumière est
 * dans les textures), textures en WebP ≤ 2048 px. 44 Mo → 3,8 Mo. Source et
 * licence hors du dépôt (sources-3d/), script : scripts/optimize-decor.mjs.
 * Le produit est posé au centre de la table ovale (plateau à 0,78 m).
 */
export const DINING_ROOM_DECOR: ViewerDecor = {
  url: "/scenes/dining-room/dining-room.gltf",
  anchor: [0.83, 0.78, 0.245],
  credit: {
    title: "Dining room | Kichen baked",
    author: "ChristyHsu",
    url: "https://skfb.ly/owqH6",
    license: "CC BY 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  },
};

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
