// Copie messages/*.json (racine du monorepo, source de vérité unique
// partagée avec l'app Next.js racine) vers apps/storefront-next/messages/.
// Nécessaire car ni Turbopack (racine scopée à cette app, cf.
// next.config.ts) ni Cloudflare Workers (pas de filesystem réel à
// l'exécution) ne peuvent résoudre un import hors de cette app — voir
// src/i18n/request.ts. Copie regénérée à chaque dev/build, jamais éditée
// à la main (gitignorée).
import { readdirSync, mkdirSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, "..", "..", "..", "messages");
const DEST = join(__dirname, "..", "messages");

mkdirSync(DEST, { recursive: true });
for (const file of readdirSync(SRC)) {
  if (file.endsWith(".json")) copyFileSync(join(SRC, file), join(DEST, file));
}
