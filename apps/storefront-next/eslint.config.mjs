import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Sortie de build OpenNext (code généré, jamais commité)
    ".open-next/**",
    ".wrangler/**",
    // Copie générée par scripts/sync-messages.mjs (source de vérité :
    // messages/ à la racine du monorepo)
    "messages/**",
  ]),
]);

export default eslintConfig;
