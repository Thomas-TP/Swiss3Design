# Mesures · achat direct du Studio (15.10.2026)

> Rapport daté (historique, pas une règle). Branche `claude/redesign-2026--achat-studio`
> contre sa base `claude/redesign-2026` (4d987c7). Les deux builds ont été faits dans des
> dossiers de **même longueur de chemin** (un chemin plus long décale le gzip jusqu'à ±6 KiB),
> avec `bunx opennextjs-cloudflare build` puis `bunx wrangler deploy --dry-run`.

## Poids du Worker

| Build          | Total Upload (brut) | gzip (Total Upload)    |
| -------------- | ------------------- | ---------------------- |
| Base (4d987c7) | 13 269.43 KiB       | **2 471.59 KiB**       |
| Achat direct   | 13 347.90 KiB       | **2 489.17 KiB**       |
| Écart          | +78.5 KiB           | **+17.6 KiB (+0,7 %)** |

Le plafond Workers Paid est de 10 MiB gzip : la marge reste très large. Le surcoût vient de
la validation serveur (`purchase.ts`, schéma zod des configurations déjà présent pour le
Studio), de la résolution des lignes, des gabarits d'e-mail et de la section admin. La
**géométrie du Studio n'entre pas dans le Worker** : le bouton « Télécharger le STL » de
l'admin passe par `components/admin/studio-stl-gate.tsx` (`next/dynamic`, `ssr: false`) ; la
chaîne d'erreur du bouton (`export STL impossible`) n'existe que dans un chunk client
(`static/chunks/1019…js`), jamais dans `.open-next/server-functions`.

`bun scripts/check-worker-bundle.ts` : OK, aucune signature three / gsap / lenis dans le Worker.

## JS initial par page (gzip, `bun scripts/chunk-report.ts`)

| Route                      | Base      | Achat direct | Écart                                 |
| -------------------------- | --------- | ------------ | ------------------------------------- |
| `/[locale]/cart`           | 213.1 KiB | 213.9 KiB    | +0.8 KiB                              |
| `/[locale]/checkout`       | 222.1 KiB | 221.9 KiB    | −0.2 KiB                              |
| `/[locale]/studio`         | 189.4 KiB | 187.8 KiB    | −1.6 KiB                              |
| `/[locale]/studio/[objet]` | 307.6 KiB | 313.3 KiB    | +5.7 KiB (bloc d'achat, panier, prix) |

La ligne du Studio du panier (poster, résumé, moteur de statistiques) est chargée à la demande
(`next/dynamic`) : un panier de produits seuls ne paie rien de plus.

## Moteur de prix

- `computeStats` : moins de 1 ms par appel sous Bun (Montagne ≈ 0,6 ms), donc le recalcul au
  paiement est négligeable.
- Invariant « police » : 3 476 cas comparés (4 objets, défauts, préréglages, tirages
  « Surprenez-moi », textes accentués ou extrêmes, 4 langues), 0 différence entre sans police,
  avec la police chargée et après un export STL. Gardé par `price-font.test.ts` et
  `price-isolation.test.ts`.
- Langue : 12 des 270 combinaisons (configuration, texte) de la Montagne changent de grammes
  selon la langue (séparateur de milliers de l'étiquette) : le prix se calcule donc toujours en
  `PRICE_LOCALE` (`fr`).
- 1 224 configurations produites par l'interface passent le schéma strict du serveur après un
  aller-retour JSON, et `clampConfig` les laisse inchangées.
