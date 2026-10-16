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
  /**
   * Azimut de la caméra (degrés) : départ, et plage permise quand un mur ou un
   * meuble empêche d'en faire le tour (sans plage : tour complet).
   */
  azimuth?: { start: number; min?: number; max?: number };
  /**
   * Polaire de la caméra (degrés depuis la verticale) : départ et plage, quand
   * une tablette au-dessus ou un plateau en dessous limite la vue.
   */
  polar?: { start: number; min: number; max: number };
  /** Part de la hauteur de la vue occupée par la pièce (défaut 0,62). */
  fill?: number;
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
 * CC BY 4.0), adaptée pour le web : vase et bouquet d'origine retirés, table
 * ramenée de 1,61 × 2,60 m à 1,00 × 1,80 m en chêne haute définition (« Oak
 * Veneer 01 », Poly Haven, CC0) et chaises rapprochées, petits objets du plan de
 * travail simplifiés, matériaux sans éclairage ailleurs (la lumière est dans les
 * textures), textures en WebP ≤ 2048 px. 44 Mo → 5,3 Mo. Source et licence hors
 * du dépôt (sources-3d/), script : scripts/optimize-decor.mjs.
 * Le produit est posé au centre de la table (plateau à 0,78 m).
 */
export const DINING_ROOM_DECOR: ViewerDecor = {
  url: "/scenes/dining-room/dining-room.gltf",
  anchor: [0.831, 0.78, 0.247],
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
  /**
   * Autour (défaut) : −1 vers la gauche, +1 vers la droite (un cran = 15°).
   * Hauteur : −1 vue plus haute (jusqu'au-dessus de la pièce), +1 plus basse.
   */
  step: -1 | 1;
  axis?: "around" | "height";
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
