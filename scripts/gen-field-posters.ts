// Génère les posters de champ de courbes : `public/posters/field-<usage>-<thème>.svg`
// pour le footer, la 404, le Léman et l'accueil mobile (brief « Strates »,
// §2.4, §7.3, §7.12, §7.18). Remplace les placeholders de WP-00.
//
//   bun scripts/gen-field-posters.ts           # écrit les 8 fichiers
//   bun scripts/gen-field-posters.ts --check   # échoue si un fichier diffère (CI, test de fraîcheur)
//
// Tout est déterministe (graine fixe, pas de Math.random) : relancer ne change
// aucun octet tant que le code ne change pas. Le calcul vit dans
// `src/lib/studio/field-poster.ts` (pur, testé) ; ce script ne fait que lire et
// écrire des fichiers.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  FIELD_IDS,
  FIELD_MAX_BYTES,
  FIELD_SPECS,
  fieldFileName,
  fieldSvg,
  generateField,
  type Theme,
} from "../src/lib/studio/field-poster";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "posters");
const check = process.argv.includes("--check");
const THEMES: Theme[] = ["light", "dark"];

mkdirSync(outDir, { recursive: true });
let stale = 0;

for (const id of FIELD_IDS) {
  const data = generateField(FIELD_SPECS[id]);
  for (const theme of THEMES) {
    const file = join(outDir, fieldFileName(id, theme));
    const svg = fieldSvg(data, theme);
    const bytes = Buffer.byteLength(svg);
    if (bytes > FIELD_MAX_BYTES) {
      console.error(
        `✗ ${fieldFileName(id, theme)} : ${bytes} o dépasse ${FIELD_MAX_BYTES} o`,
      );
      process.exit(1);
    }
    if (check) {
      const current = existsSync(file) ? readFileSync(file, "utf8") : "";
      if (current !== svg) {
        console.error(
          `✗ ${fieldFileName(id, theme)} est périmé : relancez bun scripts/gen-field-posters.ts`,
        );
        stale++;
      }
      continue;
    }
    writeFileSync(file, svg);
    console.log(
      `✓ ${fieldFileName(id, theme).padEnd(24)} ${(bytes / 1024).toFixed(1).padStart(5)} Ko · ${data.rings.iso} courbes + ${data.rings.index} maîtresses`,
    );
  }
}

if (stale > 0) process.exit(1);
