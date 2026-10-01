"use client";

// Gate du Studio (brief « Strates », §4.1, §9.2) : seul chemin du DOM vers le
// moteur du Studio (src/motion/studio/engine.tsx : export STL, Worker de
// géométrie). Avec `ssr: false`, le transform de Next retire l'import du build
// serveur : le Worker Cloudflare du site ne voit jamais le client du Worker
// de géométrie ni ses générateurs. La scène `studio-object` n'a pas de gate
// ici : elle passe par le registre du Stage (une vue déclarée par <StageView>,
// chargée par la SiteShell).
import dynamic from "next/dynamic";

export const StudioEngine = dynamic(
  () => import("@/motion/studio/engine").then((m) => m.StudioEngine),
  { ssr: false },
);
