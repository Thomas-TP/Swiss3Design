"use client";

// Gate de l'accueil (brief « Strates », §4.1) : seul chemin de la page d'accueil
// vers src/motion. Avec `ssr: false`, le transform de Next retire ces imports du
// build serveur : ni gsap, ni SplitText, ni les bibliothèques du Studio (≈ 100 Kio
// gzip) n'entrent dans le Worker. Trois chunks, chargés à la demande :
//  - HomeChoreo : la chorégraphie (GSAP), une fois le runtime prêt ;
//  - PosterEngine : le recalcul des posters en 2D (mouvement réduit, C0) ;
//  - SummitEngine : l'étiquette et les chiffres exacts du chapitre 02.
import dynamic from "next/dynamic";

export const HomeChoreo = dynamic(
  () => import("@/motion/choreo/home").then((m) => m.HomeChoreo),
  { ssr: false },
);

export const PosterEngine = dynamic(
  () => import("@/motion/choreo/home-tools").then((m) => m.PosterEngine),
  { ssr: false },
);

export const SummitEngine = dynamic(
  () => import("@/motion/choreo/home-tools").then((m) => m.SummitEngine),
  { ssr: false },
);
