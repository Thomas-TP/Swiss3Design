// Refonte « Strates » (brief §4.9) : les fichiers historiques
// messages/{fr,de,it,en}.json sont gelés ; chaque package écrit ses textes
// dans ses propres fichiers messages/<locale>/<ns>.json, fusionnés au
// chargement par request.ts. Un namespace = un fichier par locale = un seul
// package propriétaire (brief §9.2) : deux agents parallèles ne touchent donc
// jamais le même JSON, et les conflits de fusion sur messages/*.json
// disparaissent.
//
// Ajouter un namespace = l'ajouter ici ET créer les 4 fichiers (même `{}`) :
// l'import dynamique de request.ts échoue sur un fichier absent, et
// messages.test.ts vérifie la correspondance exacte dans les deux sens.
export const NAMESPACES = [
  "shell", // WP-00 : chrome (nav, BottomNav, footer, MotionToggle, vues 3D)
  "studioCore", // WP-01 (+ WP-02) : objets, profils, motifs, palettes, filaments
  "landing", // WP-HOME : accueil
  "studio", // WP-STUDIO : pages et outils du Studio
  "quote", // WP-QUOTE : /custom
  "catalog", // WP-SHOP : boutique, fiche, attribution
  "atelier", // WP-ABOUT : Atelier et contact
  "system", // WP-UTILITY : panier, succès, suivi, favoris, 404, erreur
  "accountUi", // WP-ACCOUNT : seulement si un texte nouveau est nécessaire
] as const;

export type Namespace = (typeof NAMESPACES)[number];

export type Messages = Record<string, unknown>;

/**
 * Greffe chaque namespace à la racine des messages historiques, dans l'ordre
 * de NAMESPACES (`parts[i]` est le contenu de `NAMESPACES[i]`).
 *
 * Refuse une collision plutôt que d'écraser en silence : une clé racine
 * historique homonyme (`home`, `nav`…) serait sinon remplacée entière par le
 * namespace, et toutes les pages qui la lisent perdraient leurs textes. Pur et
 * sans import next-intl, pour être testé tel quel par Vitest.
 */
export function mergeNamespaces(
  base: Messages,
  parts: readonly Messages[],
  locale: string,
): Messages {
  if (parts.length !== NAMESPACES.length) {
    throw new Error(
      `[i18n] ${parts.length} fichiers de namespace pour ${NAMESPACES.length} namespaces (${locale})`,
    );
  }
  const messages: Messages = { ...base };
  NAMESPACES.forEach((ns, i) => {
    if (Object.hasOwn(base, ns)) {
      throw new Error(
        `[i18n] « ${ns} » existe déjà dans messages/${locale}.json`,
      );
    }
    messages[ns] = parts[i];
  });
  return messages;
}
