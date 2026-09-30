import type { Messages } from "./namespaces";

// Quels messages partent au navigateur. Sans `messages`, NextIntlClientProvider
// reprend TOUT l'ensemble fusionné de request.ts (fichiers historiques + un
// fichier par namespace de la refonte) et l'écrit dans le HTML de chaque page,
// alors qu'une page n'en lit qu'une petite part (mesuré : 45 Ko de JSON par
// page en français, dont moins de 4 Ko servent à la plupart). Les composants
// SERVEUR, eux, lisent les messages côté serveur et ne coûtent rien au client :
// seuls les composants « use client » (et ce qu'ils importent) ont besoin de
// leurs textes dans le navigateur.
//
// Le client reçoit donc, par étages, uniquement ce que ses composants lisent :
// - la racine (LocaleShell) : l'habillage commun, ROOT_CLIENT_NAMESPACES ;
// - un segment ou une page, via <ClientMessages namespaces={[…]}> (voir
//   client-messages.tsx), qui AJOUTE ses namespaces à ceux de ses parents.
//
// Un « namespace » est exactement l'argument d'un useTranslations() côté
// client : `nav`, `catalog.viewer`, `system.error`… (la règle d'or : toute clé
// lue par un composant client doit être couverte par la racine ou par un
// ancêtre de la page ; client-messages.test.ts le vérifie sur le code).

/**
 * Namespaces lus par l'habillage commun, donc présents sur toutes les pages :
 * en-tête, navigation mobile, pied de page, interrupteurs (thème, mouvement,
 * langue), bandeau de consentement et cœur du panier (`nav`, `shell`,
 * `consent`) ; `errors` et `system.error` pour error.tsx, qui s'affiche à la
 * place de la page et ne peut donc pas être enveloppée par un segment.
 */
export const ROOT_CLIENT_NAMESPACES = [
  "nav",
  "shell",
  "consent",
  "errors",
  "system.error",
] as const;

function isPlainObject(value: unknown): value is Messages {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Fusion récursive de deux arbres de messages (b l'emporte feuille à feuille).
 * Sert à ajouter les messages d'une page à ceux de la racine : `system.error`
 * (racine) et `system.cart` (page) cohabitent sous `system`.
 */
export function mergeMessages(a: Messages, b: Messages): Messages {
  const out: Messages = { ...a };
  for (const [key, value] of Object.entries(b)) {
    const current = out[key];
    out[key] =
      isPlainObject(current) && isPlainObject(value)
        ? mergeMessages(current, value)
        : value;
  }
  return out;
}

/**
 * Sous-ensemble d'un arbre de messages : pour chaque namespace (chemin pointé),
 * la branche correspondante, à sa place dans l'arbre. `["system.error",
 * "shell"]` donne `{ system: { error: … }, shell: … }`. Un namespace absent est
 * signalé dans la console du serveur puis ignoré : mieux vaut une page avec un
 * texte manquant qu'une page en erreur 500 (le test de couverture et la
 * console du navigateur en développement — MISSING_MESSAGE — le révèlent bien
 * avant la mise en ligne).
 */
export function pickMessages(
  messages: Messages,
  namespaces: readonly string[],
): Messages {
  let out: Messages = {};
  for (const namespace of namespaces) {
    const segments = namespace.split(".");
    let source: unknown = messages;
    for (const segment of segments) {
      source = isPlainObject(source) ? source[segment] : undefined;
    }
    if (source === undefined) {
      console.error(
        `[i18n] namespace client absent des messages : ${namespace}`,
      );
      continue;
    }
    // Reconstruit le chemin autour de la branche, de l'extérieur vers l'intérieur.
    let branch: unknown = source;
    for (let i = segments.length - 1; i >= 0; i--) {
      branch = { [segments[i]]: branch };
    }
    out = mergeMessages(out, branch as Messages);
  }
  return out;
}
