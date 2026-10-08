# Vague R1 · Vérification et mesures

Vérification de la branche `claude/redesign-2026--verify-r1` : fusion des trois paquets de la
vague R1 (socle `r1-base`, accueil `r1-home`, Studio `r1-studio`) dans `claude/redesign-2026`
(`8afa945`), un correctif d'intégration (`4b2ad7f`), puis build OpenNext, preview de
production locale et contrôle de chaque point R01 à R18 du document
`retours-j1-j2.md`. **08.10.2026**, worktree isolé, rien poussé. Base de comparaison :
`measures-wave2b.md` (Worker 3 326,10 KiB), brief §4.11.

Ce document s'écrit au fil des étapes : chaque section est commitée dès que sa mesure est faite.

## 1. Fusions et portes

| Fusion                                                                                                                                                                                             | Commit    | Conflits                                                       |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | -------------------------------------------------------------- |
| `claude/redesign-2026--r1-base` (socle)                                                                                                                                                            | `be6ef73` | **aucun** (fusion `--no-ff` propre, `git diff-tree --cc` vide) |
| `claude/redesign-2026--r1-home` (accueil)                                                                                                                                                          | `c241ded` | **aucun**                                                      |
| `claude/redesign-2026--r1-studio` (Studio)                                                                                                                                                         | `93399ab` | **aucun**                                                      |
| Intégration : clé orpheline `studioCore.bands.change` (R05) retirée des 4 langues et de `studio-core-messages.test.ts` ; derniers « adjust » des surfaces agents (`llms.txt`, `configure-tool.ts`) | `4b2ad7f` | sans objet                                                     |

La propriété disjointe des trois lots a tenu : aucun fichier modifié des deux côtés.

Portes après les trois fusions et `4b2ad7f` (08.10.2026, `bun install` à neuf, 523 paquets) :

| Porte                  | Résultat                                                             |
| ---------------------- | -------------------------------------------------------------------- |
| `bun run lint`         | **0 erreur**                                                         |
| `bun run typecheck`    | **0 erreur**                                                         |
| `bun run test`         | **856 passés**, 15 ignorés (sans URL de base), 65 fichiers, 1 ignoré |
| `bun run format:check` | **propre** (716 fichiers)                                            |

## 2. Build OpenNext et Worker

`bunx opennextjs-cloudflare build` : réussi (webpack, 32 pages statiques). Environnement :
Bun 1.4.2, Next 16.3.6, `@opennextjs/cloudflare` 1.20.6, Edge pour les essais.

| Mesure                                                 | Valeur                                                                                                                     |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| **Worker gzip, dossier de 41 caractères** (comparable) | **3 333,45 KiB** (`Total Upload` brut 16 986,52 KiB)                                                                       |
| Worker gzip, worktree (chemin de 77 caractères)        | 3 329,23 KiB (brut 17 259,49 KiB)                                                                                          |
| Vague 2b (41 caractères, base de comparaison)          | 3 326,10 KiB                                                                                                               |
| Écart R1 − vague 2b                                    | **+7,35 KiB** (répartition par lot non mesurée)                                                                            |
| Cible WP-99 (AGENTS.md règle 10)                       | ≈ 3 250 KiB : **non atteinte, WP-99 reste à faire** ; plafond Cloudflare 10 MiB non menacé                                 |
| `bun scripts/check-worker-bundle.ts`                   | **0 signature** three / gsap / lenis (1 582 fichiers analysés), aux deux emplacements                                      |
| Chunks client (`chunk-report.ts`)                      | 209 chunks, 1 220,3 KiB gzip ; moteurs : three 83,4 + 65,6 + 8,1, gsap 27,8 + 19,5, lenis 7,0 KiB, tous hors du JS initial |
| JS initial `/fr` (accueil)                             | **194,1 KiB** gzip (vague 2b : 194,2) ; boutique 187,7 ; Studio index 189,4 ; **Studio objet 304,2** (302,7)               |

Le chemin de build change le gzip de ≈ 4 KiB (3 329,23 contre 3 333,45 pour le même code) : ne
comparer que les chiffres du dossier de 41 caractères
(`C:\s3d-matched-path-w2a-0123456789abcdefg`, synchronisé par `robocopy` depuis le worktree).
