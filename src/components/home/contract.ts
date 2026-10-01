// Contrat léger entre le DOM de l'accueil (src/components/home/**) et le côté
// lourd (chorégraphie src/motion/choreo/home.tsx, scènes du Stage). Aucun import
// de moteur ici : le fichier est lu par les composants serveur et client comme
// par la chorégraphie (qui peut importer de partout ; l'inverse est interdit).
//
// Le DOM ne parle au côté lourd que par le pont (vues du Stage, props
// immuables) ; le côté lourd ne répond au DOM que par ces événements et ces
// attributs. Pas d'état partagé ailleurs.

/** Nom d'une vue de l'accueil, posé en `data-home-view` sur son conteneur. */
export type HomeViewName = "hero" | "map" | "field" | "summit";

/** Attribut d'un conteneur de vue : la chorégraphie retrouve la vue par lui. */
export const HOME_VIEW_ATTR = "data-home-view";

/** Attributs des nœuds que la chorégraphie pilote directement. */
export const HOME = {
  /** Section du héros (épinglée ≥ 1024 × 768 en capacité C2). */
  hero: "hero",
  /** Boîte visuelle du héros : le Stage y dessine le vase. */
  heroVisual: "hero-visual",
  /** Réglette Z du héros mobile (curseur natif 0 → nombre de couches). */
  zRuler: "z-ruler",
  /** Premier chapitre sous le héros : déclenche l'éclaté. */
  map: "map",
} as const;

/** Sélecteur d'un nœud de l'accueil (`data-home="…"`). */
export const homeSelector = (name: string) => `[data-home="${name}"]`;

/**
 * Événements de la chorégraphie vers le DOM (window). Jamais de texte saisi
 * dedans : des nombres et des identifiants de filament seulement.
 */
export const HERO_EVENTS = {
  /** detail : HeroLayerDetail (≤ 10 Hz). */
  layer: "s3d:hero-layer",
  /** detail : HeroChangeDetail (un changement de filament vient d'être franchi). */
  change: "s3d:hero-change",
} as const;

export interface HeroLayerDetail {
  /** Couche courante, 0 à `total` (0 = plateau nu). */
  layer: number;
  total: number;
  /** Hauteur imprimée (mm). */
  z: number;
  /** Indice de bande (0 à 2 : le matériau a toujours trois bandes). */
  band: number;
}

export interface HeroChangeDetail {
  band: number;
  layer: number;
}

/** Intervalle minimal entre deux écritures du compteur (§3.3 : 10 Hz). */
export const READOUT_INTERVAL_MS = 100;
