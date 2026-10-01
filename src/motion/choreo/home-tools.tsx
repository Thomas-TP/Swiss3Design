"use client";

// Outils de l'accueil qui ont besoin des bibliothèques du Studio (brief
// « Strates », §4.1, §7.5, §5.7). Ils ne passent pas par le serveur : les
// générateurs, les statistiques, d3-contour et les métriques de glyphes pèsent
// ≈ 100 Kio gzip, et un import asynchrone depuis un composant client resterait
// dans le Worker (le composant est aussi rendu côté serveur). Atteints par le
// gate src/gates/home.tsx (next/dynamic, ssr: false), ils n'existent que dans
// le navigateur, au moment où on en a besoin :
//  - PosterEngine : en 2D (mouvement réduit, appareil sans WebGL), recalcule le
//    poster du héros ou de l'éclaté quand le visiteur règle palette et motif ;
//  - SummitEngine : à l'approche du chapitre 02, fournit l'étiquette et les
//    chiffres exacts du sous-verre pour le sommet saisi.
// Ce module n'importe ni gsap, ni three : il ne retarde pas le mouvement réduit.
import { useEffect } from "react";
import type { HomeLocale } from "@/components/home/home-data-types";
import type { ReliefTools } from "@/components/home/summit-tools";
import { peakLabel } from "@/lib/studio/objects/relief-model";
import { heroPoster, type HeroPoster } from "@/lib/studio/poster";
import { computeStats } from "@/lib/studio/stats";
import type { LavauxConfig } from "@/lib/studio/types";

export function PosterEngine({
  config,
  variant,
  onPoster,
}: {
  config: LavauxConfig;
  variant: HeroPoster["variant"];
  onPoster: (poster: HeroPoster) => void;
}) {
  useEffect(() => {
    onPoster(heroPoster(config, variant));
  }, [config, variant, onPoster]);
  return null;
}

const tools: ReliefTools = {
  peakLabel: (name, locale: HomeLocale) => peakLabel(name, locale),
  computeStats: (config, texts, params, locale) =>
    computeStats(config, texts, params, locale),
};

export function SummitEngine({
  onReady,
}: {
  onReady: (tools: ReliefTools) => void;
}) {
  useEffect(() => {
    onReady(tools);
  }, [onReady]);
  return null;
}
