// Écrit `home-data.generated.ts` : les chiffres et les posters de l'accueil,
// calculés par les bibliothèques du Studio (home-data-build.ts), figés dans un
// module de données que la page importe à leur place.
//
//   bun src/components/home/generate-home-data.ts
//
// À relancer quand un préréglage, un coefficient ou un texte d'exemple change
// (`home-data.test.ts` échoue tant que le fichier n'est pas à jour). La page
// n'importe ni presets, ni statistiques, ni générateurs : le Worker garde ses
// ≈ 100 Kio gzip.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildHomeData } from "./home-data-build";

const target = join(
  process.cwd(),
  "src",
  "components",
  "home",
  "home-data.generated.ts",
);
const header = `// FICHIER GÉNÉRÉ : ne pas éditer. \`bun src/components/home/generate-home-data.ts\`
// le réécrit depuis les bibliothèques du Studio (home-data-build.ts) ;
// \`home-data.test.ts\` vérifie qu'il est à jour.
import type { HomeData } from "./home-data-types";

export const HOME_DATA: HomeData = `;
writeFileSync(
  target,
  `${header}${JSON.stringify(buildHomeData(), null, 2)};\n`,
);
console.log(`écrit : ${target}`);
