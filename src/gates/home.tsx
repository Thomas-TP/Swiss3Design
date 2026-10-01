"use client";

// Gate de l'accueil (brief « Strates », §4.1) : seul chemin de la page d'accueil
// vers src/motion. Avec `ssr: false`, le transform de Next retire cet import du
// build serveur : ni gsap ni SplitText n'entrent dans le Worker. Le chunk ne
// part qu'à la demande de HomeMotion, une fois le runtime prêt.
import dynamic from "next/dynamic";

export const HomeChoreo = dynamic(
  () => import("@/motion/choreo/home").then((m) => m.HomeChoreo),
  { ssr: false },
);
