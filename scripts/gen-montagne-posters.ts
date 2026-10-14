// Génère les posters statiques de la Montagne par défaut :
// `public/posters/montagne-default-{light,dark}.svg` (brief « Strates », fiche
// WP-02 : « poster par défaut en fichiers clair et sombre » ; §7.5, chapitre 02
// de l'accueil : « SVG statique + étiquette en DOM mise à jour en direct » ;
// cartes de l'index du Studio et du chapitre 03). C'est l'ÉLÉVATION de
// `MONTAGNE_DEFAULT` (silhouette exacte vue de face, bandes de couleur par
// altitude, une ligne de couche toutes les 10 couches), sans étiquette : le
// nom du visiteur n'y est jamais.
//
//   bun scripts/gen-montagne-posters.ts           # écrit les 2 fichiers
//   bun scripts/gen-montagne-posters.ts --check   # échoue si un fichier diffère
//
// Déterministe (graine fixe, aucun Math.random) : relancer ne change aucun octet
// tant que le code ne change pas. Le calcul vit dans
// `src/lib/studio/poster-montagne.ts` (`montagnePosterSvg`, pur, testé) ; ce
// script ne fait que lire et écrire des fichiers.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { montagnePosterSvg } from "../src/lib/studio/poster-montagne";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "posters");
const check = process.argv.includes("--check");
const THEMES = ["light", "dark"] as const;
/** Poids maximal d'un poster de la Montagne (octets). */
export const MONTAGNE_POSTER_MAX_BYTES = 40 * 1024;

mkdirSync(outDir, { recursive: true });
let stale = 0;
for (const theme of THEMES) {
  const name = `montagne-default-${theme}.svg`;
  const file = join(outDir, name);
  const svg = montagnePosterSvg(theme);
  const bytes = Buffer.byteLength(svg);
  if (bytes > MONTAGNE_POSTER_MAX_BYTES) {
    console.error(
      `✗ ${name} : ${bytes} o dépasse ${MONTAGNE_POSTER_MAX_BYTES} o`,
    );
    process.exit(1);
  }
  if (check) {
    const current = existsSync(file) ? readFileSync(file, "utf8") : "";
    if (current !== svg) {
      console.error(
        `✗ ${name} est périmé : relancez bun scripts/gen-montagne-posters.ts`,
      );
      stale++;
    }
    continue;
  }
  writeFileSync(file, svg);
  console.log(
    `✓ ${name.padEnd(28)} ${(bytes / 1024).toFixed(1).padStart(5)} Ko`,
  );
}
if (stale > 0) process.exit(1);
