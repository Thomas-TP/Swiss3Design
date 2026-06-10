import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default {
  ...defineCloudflareConfig({}),
  // Next 16 builde avec Turbopack par défaut, mais ses chunks SSR cassent le
  // bundling OpenNext (ChunkLoadError en prod) → build webpack pour le deploy.
  buildCommand: "npx next build --webpack",
};
