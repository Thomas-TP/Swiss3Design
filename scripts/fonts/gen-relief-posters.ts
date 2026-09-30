// Génère les posters statiques du sous-verre « Relief » par défaut :
// `public/posters/relief-default-{light,dark}.svg` (brief « Strates », fiche
// WP-02 : « relief par défaut en fichiers clair et sombre » ; §7.5, chapitre 02
// de l'accueil : « SVG statique du relief + étiquette en DOM mise à jour en
// direct »). Le massif est celui de `RELIEF_DEFAULT` (graine 1291) sans son
// étiquette : la zone plate reste libre pour le texte du visiteur.
//
//   bun scripts/fonts/gen-relief-posters.ts           # écrit les 2 fichiers
//   bun scripts/fonts/gen-relief-posters.ts --check   # échoue si un fichier diffère
//
// Déterministe (graine fixe, aucun Math.random) : relancer ne change aucun octet
// tant que le code ne change pas. Le calcul vit dans
// `src/lib/studio/poster-flat.ts` (pur, testé) ; ce script ne fait que lire et
// écrire des fichiers. Rangé sous `scripts/fonts/` avec les autres outils du
// texte en relief : WP-99 pourra le déplacer à côté de `gen-field-posters.ts`.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { RELIEF_DEFAULT } from "../../src/lib/studio/presets";
import {
  reliefTopView,
  topViewToSvg,
  type Theme,
} from "../../src/lib/studio/poster-flat";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const outDir = join(root, "public", "posters");
const check = process.argv.includes("--check");
const THEMES: Theme[] = ["light", "dark"];
/** Poids maximal d'un poster de relief (octets). */
export const RELIEF_POSTER_MAX_BYTES = 40 * 1024;

mkdirSync(outDir, { recursive: true });
let stale = 0;
for (const theme of THEMES) {
  const name = `relief-default-${theme}.svg`;
  const file = join(outDir, name);
  const svg = topViewToSvg(
    reliefTopView(RELIEF_DEFAULT, undefined, { theme, label: false }),
    { className: "s3d-relief-poster" },
  );
  const bytes = Buffer.byteLength(svg);
  if (bytes > RELIEF_POSTER_MAX_BYTES) {
    console.error(
      `✗ ${name} : ${bytes} o dépasse ${RELIEF_POSTER_MAX_BYTES} o`,
    );
    process.exit(1);
  }
  if (check) {
    const current = existsSync(file) ? readFileSync(file, "utf8") : "";
    if (current !== svg) {
      console.error(
        `✗ ${name} est périmé : relancez bun scripts/fonts/gen-relief-posters.ts`,
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
