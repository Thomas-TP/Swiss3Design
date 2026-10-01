# Vague 2b · Vérification et mesures

Vérification de la branche d'intégration `claude/redesign-2026` après la fusion de WP-HOME
(`f2dd5b5`) et de WP-STUDIO (`cdefa67`), plus quatre petits correctifs (partie A). Base de
comparaison : `measures-wave2a.md` (Worker 3 145,30 KiB après WP-02), `measures-wave1.md`,
brief §4.11 et §10. **01.10.2026**, worktree isolé, rien poussé, branche
`claude/redesign-2026--verify-w3`.

Ce document s'écrit au fil des étapes : chaque section est commitée dès que sa mesure est
faite (la limite d'usage a déjà coupé des passages précédents).

## Résumé

_(rempli en fin de passage)_

## Environnement

|            |                                                                                                                                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Outils     | Bun 1.4.2 · Next 16.3.6 (webpack) · `@opennextjs/cloudflare` 1.20.6 · Vitest 5.0.2 · Node 26.7                                                                                                   |
| Dépôt      | worktree `wf_c69b4bef-c00-1`, `bun install` à neuf (523 paquets) ; mesures du Worker aussi dans `C:\s3d-matched-path-w2a-0123456789abcdefg` (41 caractères, mêmes `package.json` et `bun.lock`)  |
| Navigateur | Edge headless piloté par CDP (Playwright `connectOverCDP`, port 9343), profil isolé, contextes neufs, consentement non donné ; WebGL par SwiftShader (logiciel, voir les réserves de la section 7) |
| Garde-fous | jeux d'essai uniquement sur `localhost`, base = branche Neon de développement, clés Stripe de test, clé Resend vide (aucun e-mail réel), ports 3130 / 8792 / 9332 / 9343                          |

## A. Correctifs

### A1. Vie privée : champs cachés du formulaire de devis hors des enregistrements de visite

**Défaut.** Dans la variante « tiroir » verrouillée de `QuoteRequestForm`
(`src/components/quote/quote-request-form.tsx`), la description complète (avec les textes à
imprimer d'un passage Studio) voyage dans un `<input type="hidden" name="description">`.
PostHog masque les saisies par `maskAllInputs: true`, mais **rrweb ne couvre pas le type
`hidden`** (son attribut `value` entre en clair dans l'enregistrement) et `ph-mask` ne masque
que des textes. WP-STUDIO avait posé `ph-no-capture` autour de son tiroir
(`send-drawer.tsx:292`), mais le composant partagé restait exposé chez tout autre hôte.

**Correctif.** Les quatre champs cachés de la variante verrouillée portent
`className="ph-no-capture"` (aucun enrobage : une `<div>` vide aurait ajouté un espace au
`flex gap-6` du tiroir) ; la vignette de `StudioAttachmentCard` (une `data:` URL qui montre
le texte gravé) porte `ph-no-capture` et la liste des lignes du résumé `ph-mask` (le tiroir y
met le résumé des textes saisis). Rien n'est retiré de ce que le visiteur voit ou saisit : les
classes n'ont d'effet que sur l'enregistrement. Variante « page » (`/custom`) : champs visibles
(textarea, e-mail), masqués d'office par `maskAllInputs`, donc rien à retirer.

**Test.** `quote-request-form.test.ts` (rendu serveur avec `react-dom/server`, 4 tests) : les
quatre champs cachés portent `ph-no-capture` et la description garde son texte ; la variante
verrouillée n'a aucun `<textarea>` ; la variante « page » reste un formulaire normal ; la
vignette porte `ph-no-capture` et la liste `ph-mask`.

### A2. Robustesse : un échec réseau de la Server Action ne remplace plus la page

**Défaut.** `useActionState(submitQuoteRequest)` : une Server Action qui échoue au niveau
réseau (connexion coupée, 5xx) **lève dans le rendu du composant** ; sans frontière, l'erreur
remonte jusqu'à `error.tsx` et emporte la page, `/custom` comprise, avec la saisie du visiteur.
(Un `try/catch` autour de `startTransition(() => formAction(data))` n'attraperait rien :
`formAction` rend la main tout de suite, l'exception arrive plus tard, dans le rendu.)

**Correctif.** L'envoi piloté par JavaScript appelle désormais la Server Action
**directement**, dans une transition, par `attemptSubmit()` (`quote-logic.ts`, ne lève
jamais) ; la réponse alimente un état local (`sentState`). Un échec devient une valeur :
le formulaire reste monté (saisie et fichier déjà préparé gardés dans `prepared.current`, donc
**aucun second export ni téléversement** au « Réessayer »), affiche le message existant
`quote.errors.network` (« L'envoi a échoué. Vérifiez votre connexion et réessayez. ») et le
bouton passe à `quote.retry` (« Réessayer »). `useActionState` reste branché pour le
formulaire natif sans JavaScript (amélioration progressive conservée). Aucune clé de message
ajoutée : `errors.network` et `retry` existaient déjà dans les quatre langues (ajoutées par
WP-STUDIO pour son `SendErrorBoundary`, qui reste en place derrière le formulaire).

**Test.** `quote-logic.test.ts` : `attemptSubmit` rend l'état, attrape un rejet et une erreur
levée avant la première attente. La vérification dans le navigateur est en section 6.

### A3. `peakLabel` : plus de « POINTE POINTE ZORGL »

**Défaut.** `peakLabelParts` (`src/lib/studio/objects/relief-model.ts`) préfixait toujours le
mot de la langue : un visiteur qui tape « Pointe Zorgl » lisait « POINTE POINTE ZORGL ».

**Correctif.** Nouvelle fonction exportée `startsWithPeakWord(name, locale)` : vrai quand le
nom nettoyé commence par le mot de la langue (fr Pointe, de Piz, it Pizzo, en Mount), **mot
entier** (la frontière est une non-lettre : « Pointe-Noire » compte, « Pointer » et
« Mountain » non), sans tenir compte de la casse ni des accents (« POINTÉ »). Le mot d'une
autre langue ne compte pas (« Piz Bernina » sous `/fr` reste « POINTE PIZ BERNINA »).
`peakLabelParts` ne préfixe plus dans ce cas ; l'altitude reste celle du nom saisi.
**`peakLabelParts` est le point unique** : `peakLabel` (chapitre 02 de l'accueil, par
`home-tools.tsx` et `home-data-build.ts`) et `layoutLabel` (étiquette gravée du sous-verre du
Studio, STL compris) en dérivent, les deux suivent donc la règle. Les clés
`studioCore.relief.peak` / `relief.summit` (« Pointe {name} ») ne sont lues par aucun code.

**Tests.** `flat-objects.test.ts`, trois tests ajoutés : préfixe non doublé dans les quatre
langues (casse, accents, espaces, trait d'union, mot seul), préfixe ajouté sinon (mot entier,
autre langue), et l'étiquette gravée par `layoutLabel` suit la même règle.

### A4. Chapitre 02 de l'accueil avec la vraie scène du Studio

_(section 6.4, après la mesure)_

## B. Vérification de production

### 5.1 Worker (gzip du dry-run, la valeur qui compte)

_(en cours)_
