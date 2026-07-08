import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default {
  ...defineCloudflareConfig({}),
  // Next 16 builde avec Turbopack par défaut, mais ses chunks SSR cassent le
  // bundling OpenNext (ChunkLoadError en prod) → build webpack pour le deploy.
  // Même contrainte que l'app racine (AGENTS.md, règle d'or 3).
  buildCommand: "npx next build --webpack",
};
