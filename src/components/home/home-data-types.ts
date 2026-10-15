// Forme des données précalculées de l'accueil (home-data.generated.ts). Types
// seulement : aucun import d'exécution, la page et les composants les lisent
// sans tirer les bibliothèques du Studio.
import type { HeroPoster } from "@/lib/studio/poster";
import type { MontagneConfig } from "@/lib/studio/types";
import type { StatsFigures } from "./stats-items";
import type { HeroData } from "./hero-data";

export type HomeLocale = "fr" | "de" | "it" | "en";

/** Affiche d'une carte du chapitre 03. */
export type ObjectPoster =
  | { kind: "hero" }
  | { kind: "montagne" }
  /** Vue de dessus calculée (barres à la place du texte), prête à l'emploi. */
  | { kind: "svg"; svg: string };

export interface ObjectCard {
  stats: StatsFigures;
  /** Prix ferme de la configuration de départ (une pièce, livraison comprise), en centimes. */
  priceCents: number;
  poster: ObjectPoster;
}

export interface HomeData {
  /** Les douze variantes du héros : configuration, chiffres, bandes. */
  hero: HeroData;
  /** Les trois posters de la configuration d'exemple (§5.7). */
  posters: { plate: HeroPoster; final: HeroPoster; exploded: HeroPoster };
  /** Étiquette et chiffres de la Montagne pour le sommet d'exemple, par langue. */
  summit: Record<HomeLocale, { label: string; stats: StatsFigures }>;
  montagneConfig: MontagneConfig;
  /** `/studio/montagne#c=v1.…` (sans préfixe de langue, jamais de texte). */
  montagneHref: string;
  /** Chiffres et affiche des quatre objets, par langue. */
  objects: Record<HomeLocale, Record<StudioObjectIdKey, ObjectCard>>;
}

type StudioObjectIdKey = "lavaux" | "cartouche" | "montagne" | "borne";
