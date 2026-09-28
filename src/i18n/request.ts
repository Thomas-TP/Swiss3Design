import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";
import { NAMESPACES, mergeNamespaces, type Messages } from "./namespaces";

// Messages = fichier historique messages/<locale>.json + un fichier par
// namespace de la refonte (messages/<locale>/<ns>.json, voir namespaces.ts),
// greffé à la racine : `useTranslations("shell")` lit messages/<locale>/shell.json
// exactement comme `useTranslations("nav")` lit la clé `nav` du fichier
// historique. Les imports sont des gabarits : le bundler embarque tous les
// JSON de messages/ dans le Worker (quelques Ko, comme avant) et le module
// est mis en cache après la première requête, donc aucun coût par requête.
//
// Le layout ne passe pas de `messages` à NextIntlClientProvider : il hérite
// de cet ensemble fusionné, namespaces compris (budget du brief §4.9 :
// ≤ 25 Ko de textes nouveaux par locale, puisque tout part au client).
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  const [base, ...parts] = await Promise.all([
    import(`../../messages/${locale}.json`).then((m) => m.default as Messages),
    ...NAMESPACES.map((ns) =>
      import(`../../messages/${locale}/${ns}.json`).then(
        (m) => m.default as Messages,
      ),
    ),
  ]);

  return { locale, messages: mergeNamespaces(base, parts, locale) };
});
