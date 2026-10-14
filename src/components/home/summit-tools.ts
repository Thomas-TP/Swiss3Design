// Les deux fonctions de la Montagne que le chapitre 02 appelle quand le visiteur
// tape son sommet : l'étiquette (« POINTE LÉA · 2 566 M ») et les chiffres exacts.
// Types seulement : l'implémentation (modèle de la Montagne, d3-contour, métriques
// de glyphes, statistiques) vit dans src/motion/choreo/home-tools.tsx, que la page
// ne charge qu'à l'approche de la section, par le gate de l'accueil.
import type { MontagneConfig, StudioStats } from "@/lib/studio/types";
import type { HomeLocale } from "./home-data-types";

export interface MontagneTools {
  peakLabel(name: string, locale: HomeLocale): string;
  computeStats(
    config: MontagneConfig,
    texts: { peak: string },
    params: undefined,
    locale: HomeLocale,
  ): StudioStats;
}
