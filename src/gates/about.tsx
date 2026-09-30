"use client";

// Gate de l'Atelier (brief « Strates », §4.1) : seul chemin de la page
// /a-propos vers src/motion. Avec `ssr: false`, le transform de Next retire cet
// import du build serveur : ni gsap ni DrawSVG n'entrent dans le Worker. Le
// chunk ne part qu'à la demande de PrinterShowcase, une fois le runtime prêt.
import dynamic from "next/dynamic";

export const SchematicDraw = dynamic(
  () => import("@/motion/choreo/about").then((m) => m.SchematicDraw),
  { ssr: false },
);
