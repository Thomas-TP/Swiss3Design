import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Tests unitaires du métier pur (format, port, remises). Pas de runtime
// Cloudflare ici : on teste des fonctions sans binding (D1 mocké si besoin).
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
