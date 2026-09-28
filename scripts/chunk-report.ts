// Rapport des chunks client (brief de refonte « Strates », §4.6 et §4.11).
//
// À lancer APRÈS un build de production (`bunx opennextjs-cloudflare build`,
// qui fait un `next build --webpack`) : lit `.next/`, ne construit rien.
//
//   bun scripts/chunk-report.ts
//
// Deux tableaux :
// 1. les 15 plus gros chunks de `.next/static/chunks` (taille gzip), avec les
//    moteurs client-only qu'ils embarquent (three, gsap, lenis) : ces moteurs
//    ne doivent vivre que dans les chunks chargés par next/dynamic depuis
//    src/gates/** (runtime ≤ 65 KiB, Stage ≤ 200 KiB gzip) ;
// 2. le JS initial des pages vitrine : `rootMainFiles` du build-manifest + les
//    chunks de chaque module client de la route (manifeste de références
//    client de la page). Les chunks chargés plus tard par next/dynamic (gates,
//    runtime, Stage) n'y figurent pas, et c'est voulu : le budget « JS initial
//    de l'accueil ≤ actuel + 15 KiB » les exclut.
//
// Le gzip est calculé ici fichier par fichier (niveau par défaut de zlib) :
// c'est un ordre de grandeur comparable d'un build à l'autre, pas l'octet près
// servi par Cloudflare (qui peut aussi répondre en brotli).
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { gzipSync } from "node:zlib";

const NEXT_DIR = ".next";
const CHUNKS_DIR = join(NEXT_DIR, "static", "chunks");
const TOP = 15;

// Signatures qui survivent à la minification (noms de propriétés, chaînes,
// noms de classes CSS posées par la bibliothèque). Un chunk de NOTRE code qui
// appelle `THREE.WebGLRenderer` est signalé lui aussi : il dépend de three et
// doit donc, lui aussi, rester derrière un gate.
const ENGINES: { name: string; signatures: string[] }[] = [
  { name: "three", signatures: ["WebGLRenderer", "NeutralToneMapping"] },
  { name: "gsap", signatures: ["GreenSock", "ScrollTrigger", "_gsap"] },
  { name: "lenis", signatures: ["lenis-smooth", "lenis-stopped"] },
];

// Pages dont on suit le JS initial : les six routes déplacées dans (site) par
// WP-00 et, en témoin, deux pages qui restent hors du groupe. Les clés sont
// normalisées (groupes de routes retirés) : le rapport reste comparable avant
// et après le `git mv` vers `(site)/`.
const ROUTES = [
  "/[locale]",
  "/[locale]/shop",
  "/[locale]/products/[slug]",
  "/[locale]/custom",
  "/[locale]/a-propos",
  "/[locale]/contact",
  "/[locale]/cart",
  "/[locale]/checkout",
];

const kib = (bytes: number) => `${(bytes / 1024).toFixed(1)} KiB`;
const pad = (s: string, n: number) => s.padStart(n);

interface ChunkInfo {
  file: string; // relatif à .next/, séparateurs « / »
  raw: number;
  gzip: number;
  engines: string[];
}

async function listFiles(dir: string, ext: RegExp): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && ext.test(e.name))
    .map((e) => join(e.parentPath, e.name));
}

const chunkCache = new Map<string, ChunkInfo>();
async function chunkInfo(fileFromNext: string): Promise<ChunkInfo> {
  const cached = chunkCache.get(fileFromNext);
  if (cached) return cached;
  const buf = await readFile(join(NEXT_DIR, fileFromNext));
  const text = buf.toString("utf8");
  const info: ChunkInfo = {
    file: fileFromNext,
    raw: buf.byteLength,
    gzip: gzipSync(buf).byteLength,
    engines: ENGINES.filter((e) =>
      e.signatures.some((s) => text.includes(s)),
    ).map((e) => e.name),
  };
  chunkCache.set(fileFromNext, info);
  return info;
}

// « /[locale]/(site)/shop/page » → « /[locale]/shop »
function normalizeRoute(route: string): string {
  const path = route
    .replace(/\/page$/, "")
    .split("/")
    .filter((seg) => !/^\(.+\)$/.test(seg))
    .join("/");
  return path === "" ? "/" : path;
}

// Le manifeste est un petit module JS : `globalThis.__RSC_MANIFEST["<route>"]={…};`.
// Le JSON est extrait sans évaluer le fichier.
function parseClientManifest(source: string): {
  route: string;
  chunks: string[];
} {
  const match = source.match(/__RSC_MANIFEST\["([^"]+)"\]\s*=\s*(\{[\s\S]*\})/);
  if (!match) throw new Error("format de manifeste de références inattendu");
  const json = match[2].replace(/;\s*$/, "");
  const manifest = JSON.parse(json) as {
    clientModules: Record<string, { chunks: string[] }>;
  };
  const chunks = new Set<string>();
  for (const mod of Object.values(manifest.clientModules)) {
    // Liste plate [id, fichier, id, fichier…] : on ne garde que les fichiers.
    for (const entry of mod.chunks)
      if (entry.endsWith(".js")) chunks.add(decodeURIComponent(entry));
  }
  return { route: match[1], chunks: [...chunks] };
}

async function main() {
  if (!existsSync(CHUNKS_DIR)) {
    console.error(
      `${CHUNKS_DIR} introuvable : lancez d'abord \`bunx opennextjs-cloudflare build\`.`,
    );
    process.exit(1);
  }

  // 1. Plus gros chunks.
  const all = await Promise.all(
    (await listFiles(CHUNKS_DIR, /\.js$/)).map((f) =>
      chunkInfo(relative(NEXT_DIR, f).split(sep).join("/")),
    ),
  );
  all.sort((a, b) => b.gzip - a.gzip);
  const totalGzip = all.reduce((sum, c) => sum + c.gzip, 0);
  const totalRaw = all.reduce((sum, c) => sum + c.raw, 0);

  console.log(
    `\n${all.length} chunks dans ${CHUNKS_DIR} : ${kib(totalGzip)} gzip (${kib(totalRaw)} brut)\n`,
  );
  console.log(`Les ${TOP} plus gros (gzip) :`);
  console.log(`${pad("gzip", 11)}  ${pad("brut", 11)}  moteurs   fichier`);
  for (const c of all.slice(0, TOP)) {
    console.log(
      `${pad(kib(c.gzip), 11)}  ${pad(kib(c.raw), 11)}  ${(c.engines.join(",") || "-").padEnd(8)}  ${c.file}`,
    );
  }
  const withEngines = all.filter((c) => c.engines.length > 0);
  console.log(
    withEngines.length === 0
      ? "\nAucun chunk ne contient three, gsap ni lenis."
      : `\nChunks qui contiennent un moteur (${withEngines.length}) :\n${withEngines
          .map(
            (c) =>
              `  ${c.engines.join(",").padEnd(12)} ${kib(c.gzip)}  ${c.file}`,
          )
          .join("\n")}`,
  );

  // 2. JS initial par route.
  const buildManifest = JSON.parse(
    await readFile(join(NEXT_DIR, "build-manifest.json"), "utf8"),
  ) as { rootMainFiles: string[] };
  const manifests = await listFiles(
    join(NEXT_DIR, "server", "app"),
    /^page_client-reference-manifest\.js$/,
  );
  const byRoute = new Map<string, { route: string; chunks: string[] }>();
  for (const file of manifests) {
    const parsed = parseClientManifest(await readFile(file, "utf8"));
    byRoute.set(normalizeRoute(parsed.route), parsed);
  }

  console.log(
    "\nJS initial par page (rootMainFiles + chunks des modules client, hors next/dynamic) :",
  );
  console.log(
    `${pad("gzip", 11)}  ${pad("brut", 11)}  chunks  moteurs   route`,
  );
  for (const route of ROUTES) {
    const found = byRoute.get(route);
    if (!found) {
      console.log(
        `${pad("—", 11)}  ${pad("—", 11)}  ${pad("—", 6)}  ${"".padEnd(8)}  ${route} (absente du build)`,
      );
      continue;
    }
    const files = [
      ...new Set([...buildManifest.rootMainFiles, ...found.chunks]),
    ];
    const infos = await Promise.all(files.map((f) => chunkInfo(f)));
    const gzip = infos.reduce((sum, c) => sum + c.gzip, 0);
    const raw = infos.reduce((sum, c) => sum + c.raw, 0);
    const engines = [...new Set(infos.flatMap((c) => c.engines))];
    console.log(
      `${pad(kib(gzip), 11)}  ${pad(kib(raw), 11)}  ${pad(String(files.length), 6)}  ${(engines.join(",") || "-").padEnd(8)}  ${route}  [${found.route}]`,
    );
  }
  console.log("");
}

await main();
