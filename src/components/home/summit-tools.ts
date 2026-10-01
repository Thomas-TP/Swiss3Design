// Les deux fonctions du sous-verre que le chapitre 02 appelle quand le visiteur
// tape son sommet : l'étiquette (« POINTE LÉA · 2 566 M ») et les chiffres exacts.
// Types seulement : l'implémentation (modèle du sous-verre, d3-contour, métriques
// de glyphes, statistiques) vit dans src/motion/choreo/home-tools.tsx, que la page
// ne charge qu'à l'approche de la section, par le gate de l'accueil.
import type { ReliefConfig, StudioStats } from "@/lib/studio/types";
import type { HomeLocale } from "./home-data-types";

export interface ReliefTools {
  peakLabel(name: string, locale: HomeLocale): string;
  computeStats(
    config: ReliefConfig,
    texts: { peak: string },
    params: undefined,
    locale: HomeLocale,
  ): StudioStats;
}
