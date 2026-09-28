// Garde-fou du bundle du Worker (règle d'or 10 ; brief de refonte « Strates »,
// §4.1 et §4.6).
//
// À lancer APRÈS `bunx opennextjs-cloudflare build` : lit `.open-next/`, ne
// construit rien.
//
//   bun scripts/check-worker-bundle.ts
//
// three, gsap et lenis sont client-only : ils ne doivent être atteints que par
// `next/dynamic(() => import("@/motion/…"), { ssr: false })` depuis
// src/gates/**, un chemin que le transform de Next retire du build serveur.
// Un simple `await import("three")` dans un effet d'un composant rendu côté
// serveur, lui, RESTE dans le Worker (≈ 243 KiB gzip pour three seul, mesuré
// en septembre 2026) sans qu'aucun type ni aucun test ne le signale : ce
// script cherche donc, dans le code serveur réellement produit, des chaînes
// que ces bibliothèques embarquent et qu'aucun autre paquet du dépôt n'emploie
// (vérifié sur le build de référence de WP-00 : 0 occurrence).
//
// La taille imprimée est la somme des fichiers analysés, gzip fichier par
// fichier : un indicateur de tendance. La valeur qui compte pour le plafond
// Cloudflare reste la ligne « Total Upload: … / gzip: » de
// `bunx wrangler deploy --dry-run`.
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { gzipSync } from "node:zlib";

const OPEN_NEXT = ".open-next";

// Le brief impose `server-functions/**` ; le middleware (Edge) et le point
// d'entrée `worker.js` finissent dans le même Worker, on les lit aussi.
const ROOTS = [
  join(OPEN_NEXT, "server-functions"),
  join(OPEN_NEXT, "middleware"),
  join(OPEN_NEXT, "worker.js"),
];

const SIGNATURES: { signature: string; engine: string }[] = [
  { signature: "WebGLRenderer", engine: "three" },
  { signature: "NeutralToneMapping", engine: "three" },
  { signature: "GreenSock", engine: "gsap" },
  { signature: "ScrollTrigger", engine: "gsap" },
  { signature: "lenis-smooth", engine: "lenis" },
];

const kib = (bytes: number) => `${(bytes / 1024).toFixed(1)} KiB`;
const display = (file: string) => relative(".", file).split(sep).join("/");

async function collect(root: string): Promise<string[]> {
  if (!existsSync(root)) return [];
  if (/\.(m?js)$/.test(root)) return [root];
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && /\.m?js$/.test(e.name))
    .map((e) => join(e.parentPath, e.name));
}

async function main() {
  if (!existsSync(join(OPEN_NEXT, "server-functions"))) {
    console.error(
      `${OPEN_NEXT}/server-functions introuvable : lancez d'abord \`bunx opennextjs-cloudflare build\`.`,
    );
    process.exit(1);
  }

  const files = (await Promise.all(ROOTS.map(collect))).flat();
  const hits = new Map<string, string[]>(); // signature → fichiers
  // Ventilation par sous-dossier (handler.mjs, .next/, node_modules/…) : le
  // total seul mélange le serveur bundlé et les fichiers tracés qu'il requiert.
  const groups = new Map<
    string,
    { raw: number; gzip: number; count: number }
  >();
  let raw = 0;
  let gzip = 0;

  for (const file of files) {
    const buf = await readFile(file);
    const zipped = gzipSync(buf).byteLength;
    raw += buf.byteLength;
    gzip += zipped;
    const parts = relative(OPEN_NEXT, file).split(sep);
    const key =
      parts.length > 3 ? `${parts.slice(0, 3).join("/")}/` : parts.join("/");
    const group = groups.get(key) ?? { raw: 0, gzip: 0, count: 0 };
    group.raw += buf.byteLength;
    group.gzip += zipped;
    group.count += 1;
    groups.set(key, group);
    const text = buf.toString("utf8");
    for (const { signature } of SIGNATURES) {
      if (!text.includes(signature)) continue;
      const list = hits.get(signature) ?? [];
      list.push(display(file));
      hits.set(signature, list);
    }
  }

  console.log(
    `\nWorker (${OPEN_NEXT}) : ${files.length} fichiers .js/.mjs analysés`,
  );
  console.log(`  brut                        : ${kib(raw)}`);
  console.log(`  gzip (fichier par fichier)  : ${kib(gzip)}`);
  for (const [key, g] of [...groups].sort((a, b) => b[1].gzip - a[1].gzip))
    console.log(
      `    ${kib(g.gzip).padStart(12)} gzip  ${kib(g.raw).padStart(12)} brut  ${String(g.count).padStart(5)} fichier(s)  ${key}`,
    );
  console.log(
    "  (plafond Cloudflare : se fier à « Total Upload … / gzip » de `bunx wrangler deploy --dry-run`)",
  );

  if (hits.size === 0) {
    console.log(
      `\nOK : aucune signature three/gsap/lenis (${SIGNATURES.map((s) => s.signature).join(", ")}).\n`,
    );
    return;
  }

  console.error("\nÉCHEC : un moteur client-only a fui dans le Worker.");
  for (const { signature, engine } of SIGNATURES) {
    const list = hits.get(signature);
    if (!list) continue;
    console.error(
      `  « ${signature} » (${engine}) dans ${list.length} fichier(s) :`,
    );
    for (const f of list.slice(0, 10)) console.error(`    ${f}`);
    if (list.length > 10)
      console.error(`    … et ${list.length - 10} autre(s)`);
  }
  console.error(
    "\nCause probable : un import (statique ou `await import()`) de three, gsap, lenis ou @/motion/** hors de\n" +
      "src/gates/** + next/dynamic({ ssr: false }). Voir le brief, §4.1.\n",
  );
  process.exit(1);
}

await main();
