// Aides des tests du Studio (jamais importé par le code de production) :
// traducteurs réels (messages/<locale>/studio.json et studioCore.json, lus tels
// quels) et faux stockages de session.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createTranslator } from "next-intl";
import type { Translate } from "./summary";

export type TestLocale = "fr" | "de" | "it" | "en";

const read = (locale: string, namespace: string) =>
  JSON.parse(
    readFileSync(
      fileURLToPath(
        new URL(
          `../../../messages/${locale}/${namespace}.json`,
          import.meta.url,
        ),
      ),
      "utf8",
    ),
  );

/** `t` (namespace studio) et `core` (studioCore) d'une langue, avec les vrais messages. */
export function translators(locale: TestLocale): {
  t: Translate;
  core: Translate;
} {
  const messages = {
    studio: read(locale, "studio"),
    studioCore: read(locale, "studioCore"),
  };
  const t = createTranslator({ locale, messages, namespace: "studio" });
  const core = createTranslator({ locale, messages, namespace: "studioCore" });
  return { t: t as unknown as Translate, core: core as unknown as Translate };
}

/** Faux sessionStorage / window pour les modules qui lisent le navigateur. */
export function installFakeSession(): {
  store: Map<string, string>;
  uninstall: () => void;
} {
  const store = new Map<string, string>();
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, String(value)),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
  };
  const g = globalThis as unknown as Record<string, unknown>;
  const before = { window: g.window, sessionStorage: g.sessionStorage };
  g.window = g;
  g.sessionStorage = storage;
  return {
    store,
    uninstall() {
      if (before.window === undefined) delete g.window;
      else g.window = before.window;
      if (before.sessionStorage === undefined) delete g.sessionStorage;
      else g.sessionStorage = before.sessionStorage;
    },
  };
}
