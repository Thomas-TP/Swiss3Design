import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";
import { NAMESPACES, mergeNamespaces, type Messages } from "./namespaces";

// Messages = fichier historique messages/<locale>.json + un fichier par
// namespace de la refonte (messages/<locale>/<ns>.json, voir namespaces.ts),
// greffé à la racine : `useTranslations("shell")` lit messages/<locale>/shell.json
// exactement comme `useTranslations("nav")` lit la clé `nav` du fichier
// historique. Cet ensemble fusionné reste celui des composants serveur ;
// le navigateur, lui, n'en reçoit qu'un sous-ensemble (racine + ce que chaque
// segment déclare avec <ClientMessages>, voir client-namespaces.ts). Le budget
// du brief §4.9 (≤ 25 Ko de textes nouveaux par locale) borne donc le Worker,
// plus le HTML des pages.
//
// Imports en gabarit : webpack crée un « contexte » qui embarque tout fichier
// JSON correspondant, un chunk paresseux par fichier. Deux commentaires
// magiques gardent le Worker léger (règle d'or 10), sans effet sous
// Turbopack (dev) qui les ignore :
// - webpackInclude limite le contexte historique aux fichiers à la racine de
//   messages/ : son motif `${locale}.json` attrape sinon aussi les 36 fichiers
//   des sous-dossiers, chacun en chunk paresseux ;
// - webpackMode "eager" met les namespaces dans le chunk de ce module (un
//   chunk par fichier, c'est ~0,3 Ko d'enveloppe webpack/OpenNext pour un
//   `{}` de 3 octets). La promesse reste, le JSON n'est évalué qu'à l'import.
// Mesuré sur le Worker (Total Upload brut, stable d'un build à l'autre) :
// +21 KiB sans ces commentaires, +10 KiB avec, dont ~5,4 KiB de textes shell.
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  const [base, ...parts] = await Promise.all([
    import(
      /* webpackInclude: /[\\/]messages[\\/][^\\/]+\.json$/ */
      `../../messages/${locale}.json`
    ).then((m) => m.default as Messages),
    ...NAMESPACES.map((ns) =>
      import(
        /* webpackMode: "eager" */
        `../../messages/${locale}/${ns}.json`
      ).then((m) => m.default as Messages),
    ),
  ]);

  return { locale, messages: mergeNamespaces(base, parts, locale) };
});
