// Forme des données précalculées de l'accueil (home-data.generated.ts). Types
// seulement : aucun import d'exécution, la page et les composants les lisent
// sans tirer les bibliothèques du Studio.
import type { HeroPoster } from "@/lib/studio/poster";
import type { ReliefConfig } from "@/lib/studio/types";
import type { StatsFigures } from "./stats-items";
import type { HeroData } from "./hero-data";

export type HomeLocale = "fr" | "de" | "it" | "en";

/** Affiche d'une carte du chapitre 03. */
export type ObjectPoster =
  | { kind: "hero" }
  | { kind: "relief" }
  /** Vue de dessus calculée (barres à la place du texte), prête à l'emploi. */
  | { kind: "svg"; svg: string };

export interface ObjectCard {
  stats: StatsFigures;
  /** Centimes ; null tant que PRICING.validated vaut false (« Sur devis »). */
  estimate: { lowCents: number; highCents: number } | null;
  poster: ObjectPoster;
}

export interface HomeData {
  /** Les douze variantes du héros : configuration, chiffres, bandes. */
  hero: HeroData;
  /** Les trois posters de la configuration d'exemple (§5.7). */
  posters: { plate: HeroPoster; final: HeroPoster; exploded: HeroPoster };
  /** Étiquette et chiffres du sous-verre pour le sommet d'exemple, par langue. */
  summit: Record<HomeLocale, { label: string; stats: StatsFigures }>;
  reliefConfig: ReliefConfig;
  /** `/studio/relief#c=v1.…` (sans préfixe de langue, jamais de texte). */
  reliefHref: string;
  /** Chiffres et affiche des quatre objets, par langue. */
  objects: Record<HomeLocale, Record<StudioObjectIdKey, ObjectCard>>;
}

type StudioObjectIdKey = "lavaux" | "cartouche" | "relief" | "borne";
