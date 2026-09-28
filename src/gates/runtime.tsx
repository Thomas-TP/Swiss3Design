"use client";

// Gate du socle motion (brief « Strates », §4.1) : seul chemin du DOM vers
// src/motion pour la SiteShell. Avec `ssr: false`, le transform de Next retire
// ces imports du build serveur : ni gsap, ni lenis, ni three n'entrent dans le
// Worker. Deux chunks séparés : le runtime (gsap + Lenis, ≤ 65 KiB gzip) et le
// Stage (three + cœur, ≤ 200 KiB gzip). La SiteShell décide de leur montage
// avec useMotionShell (src/lib/motion-bridge/shell.ts).
import dynamic from "next/dynamic";

export const MotionRuntime = dynamic(
  () => import("@/motion/runtime").then((m) => m.MotionRuntime),
  { ssr: false },
);

export const StageRoot = dynamic(
  () => import("@/motion/stage/stage-root").then((m) => m.StageRoot),
  { ssr: false },
);
