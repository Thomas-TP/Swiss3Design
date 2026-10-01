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
| Dépôt      | worktree `wf_106251d3-62d-1` (chemin de 78 caractères, voir section 2 : la taille gzip du Worker en dépend), `bun install` à neuf (523 paquets)                                           |
| Navigateur | Edge headless piloté par CDP (Playwright `connectOverCDP`, port 9340), profil isolé, contextes neufs, cache désactivé pour le CLS, consentement non donné                                 |
| Garde-fous | jeux d'essai uniquement sur `localhost`, base = branche Neon de développement, clés Stripe de test, e-mails en `example.test`, aucun événement de mesure sorti (hôte ≠ `swiss3design.ch`) |

## 1. Contrôles du §10

| Contrôle               | Résultat                                                                                                                            |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `bun run lint`         | vert (oxlint, aucun diagnostic, 1 s)                                                                                                |
| `bun run typecheck`    | vert (18 s), `.next/types` et `.next/dev/types` supprimés avant                                                                     |
| `bun run test`         | vert : 44 fichiers passés (1 ignoré), **709 tests passés**, 15 ignorés sans URL de base (21 s)                                      |
| `bun run format:check` | **vert sur les 612 fichiers** (le fichier non suivi `docs/signature-infomaniak.html` du propriétaire n'existe pas dans ce worktree) |
