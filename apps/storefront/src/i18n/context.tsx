import { createContext, useContext, createMemo, type Accessor, type JSX } from "solid-js";
import { flatten, translator, type Translator, type TemplateResolver } from "@solid-primitives/i18n";
import { messages, type Locale, type Messages } from "./messages";
import { icuResolveTemplate, type TemplateArgs } from "./format";

type FlatMessages = ReturnType<typeof flatten<Messages>>;
// Signature relâchée pour les clés construites dynamiquement (ex. `nav.${key}`,
// `home.processStep${n}Title`) — le typage strict de Translator<T> n'accepte
// que des clés littérales connues à la compilation.
export type LooseTranslator = (key: string, args?: TemplateArgs) => string;

interface I18nContextValue {
  locale: Accessor<Locale>;
  t: Translator<FlatMessages> & LooseTranslator;
}

const I18nContext = createContext<I18nContextValue>();

export function I18nProvider(props: { locale: Accessor<Locale>; children: JSX.Element }) {
  const dict = createMemo(() => flatten(messages[props.locale()] as Messages));
  const resolveTemplate: TemplateResolver<string> = (tmpl, ...args) =>
    icuResolveTemplate(tmpl, args[0] as TemplateArgs | undefined, props.locale());
  const t = translator(dict, resolveTemplate) as Translator<FlatMessages> & LooseTranslator;

  return (
    <I18nContext.Provider value={{ locale: props.locale, t }}>
      {props.children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
