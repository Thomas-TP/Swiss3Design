import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { NAMESPACES, mergeNamespaces, type Messages } from "./namespaces";
import { routing } from "./routing";

// Garde-fou des traductions (brief §4.9, §10.2). Neuf packages écrivent en
// parallèle dans leurs namespaces : ce test est le seul endroit qui voit les
// 4 langues à la fois. Il vérifie, pour les fichiers historiques ET pour
// chaque namespace, que les 4 locales ont exactement les mêmes clés, les mêmes
// arguments ICU, aucune valeur vide, et que l'allemand (de-CH) n'a aucun ß.
// Référence : le français (locale par défaut et repli de next-intl).

const MESSAGES_DIR = fileURLToPath(new URL("../../messages/", import.meta.url));
const LOCALES = routing.locales;
const REFERENCE = routing.defaultLocale;

function readJson(relativePath: string): unknown {
  return JSON.parse(readFileSync(`${MESSAGES_DIR}${relativePath}`, "utf8"));
}

function isPlainObject(value: unknown): value is Messages {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Feuilles d'un arbre de messages : chemin pointé → valeur brute. */
function leaves(tree: Messages, prefix = ""): Map<string, unknown> {
  const out = new Map<string, unknown>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (isPlainObject(value)) {
      for (const [p, v] of leaves(value, path)) out.set(p, v);
    } else {
      out.set(path, value);
    }
  }
  return out;
}

/** Clés invalides pour next-intl (le point sépare les chemins : `a.b` serait
 *  illisible) et objets vides imbriqués (branche morte, rien à traduire). */
function structuralProblems(tree: Messages, prefix = ""): string[] {
  const problems: string[] = [];
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (key.includes(".")) problems.push(`clé avec un point : « ${path} »`);
    if (key.trim() === "") problems.push(`clé vide sous « ${prefix} »`);
    if (isPlainObject(value)) {
      if (Object.keys(value).length === 0) {
        problems.push(`objet vide : « ${path} »`);
      }
      problems.push(...structuralProblems(value, path));
    }
  }
  return problems;
}

/**
 * Signature ICU d'un message : arguments (`name`, `count, plural`,
 * `n, number`, `g, select, a|b|other`) et balises de texte riche (`<link>`),
 * triés. Mêmes règles que le parseur de next-intl (intl-messageformat) pour
 * ce qui change le sens : apostrophe qui cite `{ } < >` (et `#` en pluriel),
 * `''` littéral, `other` obligatoire. Lève une erreur sur une syntaxe
 * invalide, que next-intl ne signalerait qu'au rendu de la page, et sur une
 * accolade fermante isolée (tolérée par intl-messageformat comme simple
 * texte, mais toujours une faute de frappe dans nos messages).
 *
 * Les catégories de pluriel ne sont pas comparées : elles dépendent de la
 * langue (`=0`, `one`, `few`…). Les clés d'un `select`, elles, viennent du
 * code et doivent être identiques partout.
 */
function icuSignature(message: string): string[] {
  const found = new Set<string>();
  let i = 0;

  const fail = (reason: string): never => {
    throw new Error(`${reason} (position ${i}) dans « ${message} »`);
  };
  const skipSpaces = () => {
    while (i < message.length && /\s/.test(message[i])) i++;
  };
  const readToken = (stop: RegExp): string => {
    const start = i;
    while (i < message.length && !stop.test(message[i])) i++;
    return message.slice(start, i);
  };
  const expect = (char: string) => {
    if (message[i] !== char) fail(`« ${char} » attendu`);
    i++;
  };

  // Texte jusqu'à la fin du message (niveau 0) ou jusqu'à l'accolade qui
  // ferme l'option en cours (niveau > 0, laissée au parseur d'argument).
  const parseText = (depth: number, inPlural: boolean): void => {
    while (i < message.length) {
      const char = message[i];
      if (char === "'") {
        const next = message[i + 1];
        if (next === "'") {
          i += 2;
        } else if (
          next === "{" ||
          next === "}" ||
          next === "<" ||
          next === ">" ||
          (inPlural && next === "#")
        ) {
          // Littéral cité jusqu'à l'apostrophe fermante (ou la fin).
          i += 2;
          while (i < message.length) {
            if (message[i] === "'" && message[i + 1] === "'") i += 2;
            else if (message[i] === "'") {
              i++;
              break;
            } else i++;
          }
        } else {
          i++; // apostrophe ordinaire (« l'atelier »)
        }
      } else if (char === "{") {
        i++;
        parseArgument(depth);
      } else if (char === "}") {
        if (depth === 0) fail("accolade fermante sans ouvrante");
        return;
      } else if (char === "<" && /[a-zA-Z]/.test(message[i + 1] ?? "")) {
        i++;
        const tag = readToken(/[\s/>]/);
        found.add(`<${tag}>`);
      } else {
        i++;
      }
    }
    if (depth > 0) fail("accolade ouvrante non fermée");
  };

  const parseArgument = (depth: number): void => {
    skipSpaces();
    const name = readToken(/[\s,{}]/);
    if (!name) fail("argument sans nom");
    skipSpaces();
    if (message[i] === "}") {
      i++;
      found.add(name);
      return;
    }
    expect(",");
    skipSpaces();
    const type = readToken(/[\s,{}]/);
    if (!type) fail(`type manquant pour « ${name} »`);
    skipSpaces();

    if (type === "plural" || type === "selectordinal" || type === "select") {
      expect(",");
      const selectors: string[] = [];
      for (;;) {
        skipSpaces();
        if (message[i] === "}") {
          i++;
          break;
        }
        const selector = readToken(/[\s{}]/);
        if (!selector) fail(`option vide dans « ${name} »`);
        if (type !== "select" && selector.startsWith("offset:")) continue;
        skipSpaces();
        expect("{");
        parseText(depth + 1, type !== "select");
        expect("}");
        selectors.push(selector);
      }
      if (!selectors.includes("other"))
        fail(`« other » manquant dans « ${name} »`);
      found.add(
        type === "select"
          ? `${name}, select, ${[...selectors].sort().join("|")}`
          : `${name}, ${type}`,
      );
      return;
    }

    // number, date, time… avec un style facultatif (`::currency/CHF`).
    if (message[i] === ",") {
      i++;
      readToken(/[}]/);
    }
    expect("}");
    found.add(`${name}, ${type}`);
  };

  parseText(0, false);
  return [...found].sort();
}

type Group = { label: string; byLocale: Record<string, Messages> };

// Les fichiers historiques forment un groupe, chaque namespace un autre.
function loadGroups(): Group[] {
  const historic: Group = { label: "messages/<locale>.json", byLocale: {} };
  for (const locale of LOCALES) {
    const tree = readJson(`${locale}.json`);
    if (!isPlainObject(tree)) throw new Error(`${locale}.json : pas un objet`);
    historic.byLocale[locale] = tree;
  }
  const namespaced = NAMESPACES.map((ns): Group => {
    const group: Group = {
      label: `messages/<locale>/${ns}.json`,
      byLocale: {},
    };
    for (const locale of LOCALES) {
      const tree = readJson(`${locale}/${ns}.json`);
      if (!isPlainObject(tree)) {
        throw new Error(`${locale}/${ns}.json : pas un objet`);
      }
      group.byLocale[locale] = tree;
    }
    return group;
  });
  return [historic, ...namespaced];
}

const groups = loadGroups();

describe("icuSignature", () => {
  it("relève arguments, types, clés de select et balises", () => {
    expect(
      icuSignature(
        "Bonjour {name}, {count, plural, =0 {rien} one {# objet} other {# objets}}",
      ),
    ).toEqual(["count, plural", "name"]);
    expect(
      icuSignature("{g, select, a {A} other {{n, number}}} <link>ici</link>"),
    ).toEqual(["<link>", "g, select, a|other", "n, number"]);
    expect(icuSignature("Un texte sans argument, l'atelier.")).toEqual([]);
  });

  it("suit la citation ICU par apostrophe, comme next-intl", () => {
    // « '{ » cite l'accolade : ce n'est PAS un argument (piège réel en
    // français : intl-messageformat rend « l'{name} » en « l{name} »,
    // apostrophe avalée et argument jamais remplacé).
    expect(icuSignature("l'{name}'")).toEqual([]);
    expect(icuSignature("C''est {name}")).toEqual(["name"]);
  });

  it("refuse une syntaxe invalide ou une accolade isolée", () => {
    expect(() => icuSignature("{name")).toThrow(/attendu/);
    expect(() => icuSignature("fin}")).toThrow(/sans ouvrante/);
    expect(() => icuSignature("{count, plural, one {#}}")).toThrow(/other/);
  });
});

describe("namespaces", () => {
  it("n'ont pas de doublon", () => {
    expect(new Set(NAMESPACES).size).toBe(NAMESPACES.length);
  });

  it.each(LOCALES)(
    "messages/%s/ contient exactement un fichier par namespace",
    (locale) => {
      const files = readdirSync(`${MESSAGES_DIR}${locale}`).sort();
      expect(files).toEqual(NAMESPACES.map((ns) => `${ns}.json`).sort());
    },
  );

  it.each(LOCALES)(
    "aucun namespace ne masque une clé racine de messages/%s.json",
    (locale) => {
      const base = groups[0].byLocale[locale];
      expect(NAMESPACES.filter((ns) => Object.hasOwn(base, ns))).toEqual([]);
    },
  );

  it("mergeNamespaces greffe chaque namespace à la racine", () => {
    const parts = NAMESPACES.map((ns) => ({ marker: ns }));
    const merged = mergeNamespaces({ nav: { home: "Accueil" } }, parts, "fr");
    expect(merged.nav).toEqual({ home: "Accueil" });
    for (const ns of NAMESPACES) expect(merged[ns]).toEqual({ marker: ns });
  });

  it("mergeNamespaces refuse une collision au lieu d'écraser", () => {
    const parts = NAMESPACES.map(() => ({}));
    expect(() =>
      mergeNamespaces({ [NAMESPACES[0]]: { a: "b" } }, parts, "fr"),
    ).toThrow(/existe déjà/);
    expect(() => mergeNamespaces({}, parts.slice(1), "fr")).toThrow(
      /fichiers de namespace/,
    );
  });
});

describe.each(groups)("$label", ({ byLocale }) => {
  const reference = leaves(byLocale[REFERENCE]);

  it.each(LOCALES)("%s : structure valide, aucune valeur vide", (locale) => {
    const tree = byLocale[locale];
    const problems = structuralProblems(tree);
    for (const [path, value] of leaves(tree)) {
      if (typeof value !== "string") {
        problems.push(`« ${path} » n'est pas une chaîne`);
      } else if (value.trim() === "") {
        problems.push(`« ${path} » est vide`);
      }
    }
    expect(problems).toEqual([]);
  });

  it.each(LOCALES.filter((l) => l !== REFERENCE))(
    "%s : mêmes clés que la référence",
    (locale) => {
      const keys = new Set(leaves(byLocale[locale]).keys());
      const missing = [...reference.keys()].filter((k) => !keys.has(k));
      const extra = [...keys].filter((k) => !reference.has(k));
      expect({ missing, extra }).toEqual({ missing: [], extra: [] });
    },
  );

  it.each(LOCALES)("%s : mêmes arguments ICU que la référence", (locale) => {
    const mismatches: string[] = [];
    for (const [path, value] of leaves(byLocale[locale])) {
      const ref = reference.get(path);
      if (typeof value !== "string" || typeof ref !== "string") continue;
      const got = icuSignature(value).join(" ; ");
      const want = icuSignature(ref).join(" ; ");
      if (got !== want)
        mismatches.push(`${path} : [${got}] au lieu de [${want}]`);
    }
    expect(mismatches).toEqual([]);
  });
});

describe("allemand de Suisse", () => {
  // Brief §1.6 : « Grösse », « Schliessen », « Mass ». On lit le texte brut
  // des fichiers : une clé ou une valeur, rien ne doit contenir de ß ni de ẞ.
  const files = ["de.json", ...NAMESPACES.map((ns) => `de/${ns}.json`)];

  it.each(files)("%s ne contient aucun ß", (file) => {
    const lines = readFileSync(`${MESSAGES_DIR}${file}`, "utf8")
      .split("\n")
      .map((line, index) => ({ line: index + 1, text: line.trim() }))
      .filter(({ text }) => /[ßẞ]/.test(text));
    expect(lines).toEqual([]);
  });
});
