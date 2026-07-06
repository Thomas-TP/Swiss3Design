import type { Locale } from "./messages";

// Sous-ensemble d'ICU MessageFormat réellement utilisé par messages/*.json
// (vérifié : seulement interpolation {clé} et pluriels {clé, plural, ...},
// jamais select/selectordinal) — @solid-primitives/i18n ne fournit qu'un
// résolveur {{ clé }} par défaut, incompatible avec ce format.
const PLURAL_RE = /\{(\w+),\s*plural,\s*((?:=?[\w-]+\s*\{[^{}]*\}\s*)+)\}/g;
const BRANCH_RE = /(=?[\w-]+)\s*\{([^{}]*)\}/g;
const INTERPOLATION_RE = /\{(\w+)\}/g;

export type TemplateArgs = Record<string, string | number | boolean>;

function resolvePlural(value: number, branches: string, locale: Locale): string {
  const options = [...branches.matchAll(BRANCH_RE)];
  const exact = options.find(([, selector]) => selector === `=${value}`);
  if (exact) return exact[2].replace(/#/g, String(value));

  const category = new Intl.PluralRules(locale).select(value);
  const match =
    options.find(([, selector]) => selector === category) ??
    options.find(([, selector]) => selector === "other");
  return (match?.[2] ?? "").replace(/#/g, String(value));
}

export function icuResolveTemplate(template: string, args: TemplateArgs | undefined, locale: Locale): string {
  let result = template.replace(PLURAL_RE, (_match, key: string, branches: string) => {
    const value = Number(args?.[key] ?? 0);
    return resolvePlural(value, branches, locale);
  });
  result = result.replace(INTERPOLATION_RE, (match, key: string) =>
    args && key in args ? String(args[key]) : match,
  );
  return result;
}
