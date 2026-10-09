import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Donne accès aux bindings Cloudflare (D1, R2, KV) pendant `next dev`
initOpenNextCloudflareForDev();

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Paquets dont le code dépend de la couche webpack (alias et conditions
// d'export propres à Next) : on ne les fusionne jamais entre couches.
const LAYER_SENSITIVE_PACKAGES = new Set([
  "next",
  "react",
  "react-dom",
  "scheduler",
]);

const unixPath = (file: string) => file.replace(/\\/g, "/");

/** Nom du paquet de `node_modules` d'un fichier (le plus profond), sinon undefined. */
function packageOf(file: string): string | undefined {
  return unixPath(file).match(/.*\/node_modules\/((?:@[^/]+\/)?[^/]+)\//)?.[1];
}

const nextConfig: NextConfig = {
  // Taille du Worker (règle d'or 10 d'AGENTS.md, WP-99). Deux réglages du seul
  // build webpack serveur Node.js, celui d'`opennextjs-cloudflare build` qui
  // lance `next build --webpack` (`next dev` et un `next build` nu tournent
  // sous Turbopack et ne passent pas ici ; Workers Builds exécute le même
  // `opennextjs-cloudflare build` que `bun run deploy`). Ils ne changent que la
  // RÉPARTITION des modules dans `.next/server`, jamais le code exécuté :
  // contre un build sans ce bloc, 58 pages (4 langues, Studio, compte et admin
  // sans session), 61 routes GET/POST sans effet (API, .well-known, MCP, A2A,
  // webhook à signature invalide…) et les 37 Server Actions répondent comme
  // avant, octet pour octet une fois neutralisés l'identifiant de build, les
  // noms hachés des fichiers client, les identifiants d'actions et les nonces,
  // que Next change à chaque build ou à chaque requête, même à code identique ;
  // les parcours réels (panier, formulaires invalides, connexion refusée,
  // Studio) aussi, sans violation de CSP ni erreur d'hydratation.
  //
  // Mesuré dans le dossier de 41 caractères (`wrangler deploy --dry-run`) :
  // 3 336 KiB gzip avant, 2 460 après (−26 %), 16 987 KiB bruts avant,
  // 12 895 après ; JS client inchangé (209 chunks, 1 220,3 KiB gzip). Ne pas
  // retirer ce bloc sans remesurer : sans lui, le Worker repasse à 3 336 KiB.
  // En cas de doute sur un déploiement, le retirer suffit à revenir au
  // comportement par défaut de Next.
  webpack(config, { dev, isServer, nextRuntime, dir }) {
    if (dev || !isServer || nextRuntime !== "nodejs") return config;
    const src = `${unixPath(dir)}/src/`;

    // 1. COUCHES. Webpack compile un module une fois PAR COUCHE : `rsc` (pages,
    //    layouts, routes), `action-browser` (Server Actions importées par un
    //    composant client) et `ssr` (rendu serveur des composants client). Les
    //    couches `rsc` et `action-browser` sont la même saveur de React pour
    //    Next (`WEBPACK_LAYERS.GROUP.builtinReact`) : ne diffèrent que le nom.
    //    Better-auth et ses greffons, kysely, drizzle, Stripe, zod… se
    //    retrouvaient donc en deux exemplaires (1,2 Mo chacun pour la pile
    //    d'authentification), zod en trois. Un module demandé depuis une
    //    Server Action est placé dans la couche `rsc` : une seule copie,
    //    partagée avec les pages (et l'état de module l'est aussi : pool
    //    Postgres par requête, ensemencement OAuth, clé du cache JWKS, tous
    //    sans dépendance à la couche). Les fichiers « use server » eux-mêmes
    //    restent dans leur couche. Sans risque pour la résolution : webpack-
    //    config.js applique à `rsc` et `action-browser` les mêmes conditions
    //    d'export (`react-server`), les mêmes alias et la même chaîne de
    //    loaders (`shouldUseReactServerCondition`) ; `next`, `react`,
    //    `react-dom` et `scheduler`, seuls paquets liés à la couche, restent
    //    exclus.
    config.module.rules.push({
      issuerLayer: "action-browser",
      test: (file: string) => {
        const pkg = packageOf(file);
        if (pkg) return !LAYER_SENSITIVE_PACKAGES.has(pkg);
        const path = unixPath(file);
        return path.startsWith(`${src}lib/`) || path.startsWith(`${src}db/`);
      },
      layer: "rsc",
    });
    // Idem de `ssr` vers `rsc`, mais seulement pour du code pur : la
    // bibliothèque du Studio et zod, que le serveur de pages et le rendu des
    // composants client importaient chacun de leur côté. Vérifié à la main :
    // ni zod (aucune dépendance, aucune condition d'export), ni
    // `src/lib/studio/**` (d3-contour, d3-array, internmap et earcut, dont
    // l'export n'a pas de condition propre à la couche) n'importent React,
    // Next, `server-only`/`client-only` ni un fichier « use client » ou
    // « use server » ; leur état de module (caches purs du Studio,
    // `z.config` posé sur `globalThis`) ne dépend pas de la couche. Ne pas
    // élargir cette règle à un paquet qui touche à React.
    config.module.rules.push({
      issuerLayer: "ssr",
      test: (file: string) =>
        packageOf(file) === "zod" ||
        unixPath(file).startsWith(`${src}lib/studio/`),
      layer: "rsc",
    });

    // 2. DÉCOUPAGE. Par défaut Next ne sort un module partagé dans un fichier
    //    commun que s'il pèse ≥ 20 Ko et tant qu'une page ne charge pas plus de
    //    30 fichiers : sinon il est recopié dans CHAQUE page et route (119
    //    entrées). Sans seuil ni plafond, chaque module n'existe qu'une fois ;
    //    le coût (plus de petits fichiers) est nul dans le Worker, où tout est
    //    déjà dans un seul fichier et où les `require` sont locaux.
    const split = config.optimization?.splitChunks;
    if (split && typeof split === "object") {
      split.minSize = 0;
      split.maxInitialRequests = 1000;
      split.maxAsyncRequests = 1000;
    }
    return config;
  },
  poweredByHeader: false,
  images: {
    // Optimisation déléguée à Cloudflare Images au déploiement
    unoptimized: true,
  },
};

export default withNextIntl(nextConfig);
