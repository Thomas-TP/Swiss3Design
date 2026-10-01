# Vague 2a · Vérification et mesures

Vérification de ce que la vague 2a a fusionné dans `claude/redesign-2026` : les paquets de
la vague 1, les correctifs de la vague 1 (`fix-w1`) et **WP-02** (texte en relief,
Cartouche, Relief, Borne). Code vérifié : `6ceaf0c` (merge de WP-02) ; la branche de
vérification `claude/redesign-2026--verify-w2a` n'ajoute que de la documentation
(`4ab94a2`). **01.10.2026**, worktree isolé, rien poussé. Références : `measures-wave1.md`
(base de comparaison), `measures-wp00.md`, brief §4.11 et §10.

Ce document s'écrit au fil des étapes : chaque section est commitée dès que sa mesure est
faite (le passage précédent avait été coupé par la limite d'usage avant de rien consigner).

## Environnement

|            |                                                                                                                                                                                           |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Outils     | Bun 1.4.2 · Next 16.3.6 (webpack) · `@opennextjs/cloudflare` 1.20.6 · Vitest 5.0.2                                                                                                        |
| Dépôt      | worktree `wf_106251d3-62d-1` (chemin de 77 caractères, voir section 2 : la taille gzip du Worker en dépend), `bun install` à neuf (523 paquets)                                           |
| Navigateur | Edge headless piloté par CDP (Playwright `connectOverCDP`, port 9340), profil isolé, contextes neufs, cache désactivé pour le CLS, consentement non donné                                 |
| Garde-fous | jeux d'essai uniquement sur `localhost`, base = branche Neon de développement, clés Stripe de test, e-mails en `example.test`, aucun événement de mesure sorti (hôte ≠ `swiss3design.ch`) |

## 1. Contrôles du §10

| Contrôle               | Résultat                                                                                                                            |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `bun run lint`         | vert (oxlint, aucun diagnostic, 1 s)                                                                                                |
| `bun run typecheck`    | vert (18 s), `.next/types` et `.next/dev/types` supprimés avant                                                                     |
| `bun run test`         | vert : 44 fichiers passés (1 ignoré), **709 tests passés**, 15 ignorés sans URL de base (21 s)                                      |
| `bun run format:check` | **vert sur les 612 fichiers** (le fichier non suivi `docs/signature-infomaniak.html` du propriétaire n'existe pas dans ce worktree) |

## 2. Worker et chunks client

Build : `bunx opennextjs-cloudflare build` (réussi, `worker.js` produit), puis
`bunx wrangler deploy --dry-run`, `bun scripts/check-worker-bundle.ts` et
`bun scripts/chunk-report.ts`.

### 2.1 Worker (gzip du dry-run, la valeur qui compte)

**Les chiffres de ce tableau ne sont comparables qu'à chemin de build égal.** Les
manifestes du Worker embarquent des chemins absolus (le `handler.mjs` du worktree pèse
11 249,2 KiB brut contre 10 991,5 KiB dans un dossier de 41 caractères pour le même code) :
la taille gzip varie donc avec le dossier **et**, à code identique, d'un build à l'autre
(3 138,49 / 3 144,05 / 3 145,30 / 3 150,48 KiB pour le même code, soit ±6 KiB). Pour avoir
une référence propre, trois builds successifs ont été faits **dans un même dossier de
41 caractères** (la longueur du checkout principal, où la vague 1 avait été mesurée), avec
le même `node_modules` (écart de `node_modules` entre les trois : 0,0 KiB, aucune
dépendance n'a bougé).

| Révision (même dossier de 41 caractères) | `Total Upload` (brut) | `gzip` (dry-run) | Écart de gzip             |
| ---------------------------------------- | --------------------- | ---------------- | ------------------------- |
| `ac9d0a5` fin de la vague 1 (relevé)     | 15 901,83 KiB         | **3 110,61 KiB** | —                         |
| `26bb1f3` + correctifs `fix-w1`          | 16 167,99 KiB         | **3 150,19 KiB** | +39,6 KiB                 |
| `6ceaf0c` + WP-02 (le code vérifié ici)  | 16 170,02 KiB         | **3 145,30 KiB** | −4,9 KiB                  |
| même code, build dans le worktree        | 16 417,68 KiB         | 3 144,05 KiB     | (chemin de 77 caractères) |

- **Le relevé de la vague 1 est reproduit** : 3 110,61 KiB ici contre 3 109,13 KiB alors
  (+1,5 KiB), la méthode est donc fiable à quelques KiB près.
- **Le Worker a grossi de ≈ 35 KiB depuis la vague 1** (3 109,13 → 3 145,30 ; 3 144,05 dans
  le worktree), **et c'est entièrement dû aux correctifs `fix-w1`, pas à WP-02** :
  - WP-02 : +2,0 KiB brut et −4,9 KiB gzip, c'est-à-dire du bruit de build. Aucune chaîne de
    ses modules (`GlyphsNotLoadedError`, `S3D Relief`, `mulberry32`, `opentype`) n'est dans le
    `handler.mjs` : le texte en relief, la Cartouche, le Relief et la Borne sont du code
    client ou de Worker de géométrie, sans page serveur qui les importe avant WP-STUDIO.
  - `fix-w1` : +266 KiB brut, +75,4 KiB de gzip fichier par fichier, **sans aucun changement
    de dépendance**. Ventilation (gzip fichier par fichier, `ac9d0a5` → `26bb1f3`) :
    `handler.mjs` +30,7 KiB (+197 KiB brut), les 111 entrées `page.js`/`route.js` +25,7 KiB
    (+129 KiB brut), les chunks serveur numérotés +14,7 KiB, les manifestes
    `client-reference` +4,6 KiB. Cause la plus probable : le nouveau layout racine
    `src/app/layout.tsx`, la route interne `/_not-found` (`src/app/not-found.tsx`, qui rend
    `LocaleShell`) et la douzaine de `layout.tsx` de segment portant `ClientMessages` ont
    redistribué les modules entre les entrées de page et les chunks partagés : le gros chunk
    partagé `2430.js` (427 KiB brut) devient `946.js` (449 KiB) et passe de 232 à 266 modules
    (surtout `next/link`, la navigation next-intl et des composants client désormais tirés
    dans le graphe serveur ; cette attribution vient de la comparaison des modules webpack,
    pas d'un profil de bundle). Le
    `Total Upload` brut a gagné 266 KiB (+1,7 %) pour +39,6 KiB de gzip (+1,3 %), soit le
    même ratio que le reste du Worker : aucun gros bloc isolé à retirer.
- **Budget de fin de refonte** (§4.11, relevé à **3 185 KiB** le 30.09.2026) : **3 145,30 KiB,
  marge de 39,7 KiB** (34,8 KiB si l'on retient le pire build du même code, 3 150,48). Il
  reste WP-HOME, WP-STUDIO et WP-99 ; WP-02 n'a rien consommé. À re-mesurer après chaque
  fusion, **toujours dans un dossier de 41 caractères** pour comparer à ce tableau.
- `check-worker-bundle` : **0 signature** (WebGLRenderer, NeutralToneMapping, GreenSock,
  ScrollTrigger, lenis-smooth) sur 1 570 fichiers (39 790,8 KiB brut, 10 227,1 KiB gzip
  fichier par fichier dans le worktree) ; les mêmes 0 sur les trois builds de 41 caractères.
  `node_modules/` 5 011,8 KiB (inchangé depuis la vague 1), middleware 102,0 KiB.

### 2.2 Chunks client

189 chunks, **1 071,5 KiB gzip** (3 270,1 KiB brut), contre 178 chunks et 1 065,6 KiB en
vague 1 ; 6 chunks portent un moteur (three ×3, gsap ×2, lenis ×1), tous derrière un gate.

| Route (JS initial, borne haute)         | gzip          | brut      | chunks | Écart / vague 1 |
| --------------------------------------- | ------------- | --------- | ------ | --------------- |
| `/[locale]` (accueil)                   | **231,4 KiB** | 723,6 KiB | 17     | +1,1 KiB        |
| `/[locale]/shop`                        | 230,4 KiB     | 720,3 KiB | 18     | +1,7 KiB        |
| `/[locale]/products/[slug]`             | 234,8 KiB     | 733,5 KiB | 18     | +1,6 KiB        |
| `/[locale]/custom`                      | 259,7 KiB     | 803,8 KiB | 20     | +1,6 KiB        |
| `/[locale]/a-propos`                    | 258,9 KiB     | 803,9 KiB | 20     | +1,6 KiB        |
| `/[locale]/contact`                     | 253,5 KiB     | 784,3 KiB | 20     | +1,6 KiB        |
| `/[locale]/cart` (hors `(site)`)        | 256,3 KiB     | 793,4 KiB | 20     | +1,4 KiB        |
| `/[locale]/checkout` (hors `(site)`)    | 265,3 KiB     | 819,5 KiB | 20     | +1,1 KiB        |
| `/[locale]/track` (hors script)         | 234,8 KiB     | 731,5 KiB | 19     | +1,4 KiB        |
| `/[locale]/favorites` (hors script)     | 233,2 KiB     | 728,7 KiB | 17     | +1,4 KiB        |
| `/[locale]/account/login` (hors script) | 256,1 KiB     | 793,1 KiB | 19     | +0,8 KiB        |
| `/[locale]/legal/terms` (hors script)   | 225,9 KiB     | 708,6 KiB | 16     | +0,9 KiB        |

Les quatre dernières lignes viennent d'une copie jetable de `chunk-report.ts` dont la liste
`ROUTES` est étendue (le script du dépôt ne suit que les 8 premières routes).

- **Accueil : 231,4 KiB pour un budget de 233,7 KiB** (base + 15) : dans le budget, **marge de
  2,3 KiB** (3,4 en vague 1). Toutes les routes ont pris +0,8 à +1,7 KiB, uniformément, et
  deux chunks de plus : c'est l'effet de `fix-w1` (layout racine, `ClientMessages`), pas de
  WP-02. L'accueil n'a pas encore reçu WP-HOME : **la marge restante est étroite pour un
  paquet qui doit y ajouter du JS** ; le budget de l'accueil se tiendra ou non à ce moment.
- Gates (`.next/react-loadable-manifest.json`, gzip zlib par défaut) : **inchangés depuis la
  vague 1**, donc WP-02 n'a ajouté aucun chunk de moteur.

| Gate                                | Total gzip               | Budget      |
| ----------------------------------- | ------------------------ | ----------- |
| `@/motion/runtime` (gsap + Lenis)   | **53,7 KiB**             | ≤ 65 KiB ✓  |
| `@/motion/stage/stage-root` (three) | **148,9 KiB**            | ≤ 200 KiB ✓ |
| `@/motion/choreo/about`             | 49,7 KiB (2,8 en propre) | —           |
| `@/motion/choreo/product`           | 50,5 KiB (3,7 en propre) | —           |
