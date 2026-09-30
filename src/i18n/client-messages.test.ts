// Garde-fou des messages envoyés au navigateur (src/i18n/client-namespaces.ts).
//
// Le client ne reçoit que les namespaces de la racine (ROOT_CLIENT_NAMESPACES)
// plus ceux que chaque segment ou page déclare avec <ClientMessages
// namespaces={[…]}>. Un composant « use client » qui lit un namespace absent de
// cet ensemble affiche sa clé brute et lève MISSING_MESSAGE, mais seulement
// quand on visite la bonne page dans la bonne langue : ce test le trouve sur le
// code, pour les 4 langues à la fois.
//
// Méthode : pour chaque point d'entrée de src/app (page, layout, error,
// not-found), on parcourt les imports (statiques et import()) ; dès qu'on
// franchit un fichier « use client », tout ce qui suit est du code client, et
// ses useTranslations("ns") sont les namespaces à fournir. Un composant serveur
// (sans directive, atteint depuis un composant serveur) lit les messages côté
// serveur : il ne coûte rien au client et n'est pas exigé. Les namespaces
// fournis à une entrée = racine + <ClientMessages> de son fichier et de chaque
// layout ancêtre. Les fichiers sont lus par le parseur de TypeScript.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import {
  ROOT_CLIENT_NAMESPACES,
  mergeMessages,
  pickMessages,
} from "./client-namespaces";
import { NAMESPACES, mergeNamespaces, type Messages } from "./namespaces";
import { routing } from "./routing";

describe("pickMessages / mergeMessages", () => {
  const tree: Messages = {
    nav: { shop: "Boutique" },
    system: { error: { title: "Oups" }, cart: { title: "Panier" } },
    note: "texte",
  };

  it("reprend la branche à sa place dans l'arbre", () => {
    expect(pickMessages(tree, ["nav", "system.error"])).toEqual({
      nav: { shop: "Boutique" },
      system: { error: { title: "Oups" } },
    });
  });

  it("fusionne deux namespaces d'une même branche", () => {
    expect(pickMessages(tree, ["system.error", "system.cart"])).toEqual({
      system: tree.system,
    });
    // Un parent couvre ses enfants, dans n'importe quel ordre.
    expect(pickMessages(tree, ["system.cart", "system"])).toEqual({
      system: tree.system,
    });
  });

  it("ignore un namespace absent sans échouer", () => {
    const spy = console.error;
    console.error = () => {};
    try {
      expect(pickMessages(tree, ["nope", "nav.nope", "nav"])).toEqual({
        nav: { shop: "Boutique" },
      });
    } finally {
      console.error = spy;
    }
  });

  it("mergeMessages fusionne en profondeur sans modifier ses entrées", () => {
    const a: Messages = { x: { a: 1, b: 2 }, y: "a" };
    const b: Messages = { x: { b: 3, c: 4 }, z: "z" };
    expect(mergeMessages(a, b)).toEqual({
      x: { a: 1, b: 3, c: 4 },
      y: "a",
      z: "z",
    });
    expect(a).toEqual({ x: { a: 1, b: 2 }, y: "a" });
  });
});

// ── Analyse du code ─────────────────────────────────────────────────────────

const SRC = fileURLToPath(new URL("..", import.meta.url));
const APP = join(SRC, "app");
const MESSAGES_DIR = fileURLToPath(new URL("../../messages/", import.meta.url));
const CODE_FILE = /\.tsx?$/;
const TEST_FILE = /\.test\.tsx?$/;
const ENTRY_FILE = /^(?:page|layout|error|not-found)\.tsx$/;

interface FileInfo {
  client: boolean;
  imports: string[];
  /** Arguments littéraux de useTranslations() ; "" = appel sans argument. */
  translations: string[];
  /** Namespaces déclarés par <ClientMessages namespaces={[…]}>. */
  declared: string[];
  /** <ClientMessages> dont `namespaces` n'est pas un tableau de littéraux. */
  unreadable: number;
}

function listCode(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) listCode(path, out);
    else if (CODE_FILE.test(entry.name) && !TEST_FILE.test(entry.name)) {
      out.push(path);
    }
  }
  return out;
}

const CANDIDATES = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"];

function resolveImport(from: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith("@/")) base = join(SRC, specifier.slice(2));
  else if (specifier.startsWith(".")) base = resolve(dirname(from), specifier);
  else return null;
  for (const suffix of CANDIDATES) {
    const path = base + suffix;
    if (existsSync(path) && statSync(path).isFile()) return path;
  }
  return null;
}

function readFile(path: string): FileInfo {
  const source = ts.createSourceFile(
    path,
    readFileSync(path, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const first = source.statements[0];
  const info: FileInfo = {
    client:
      !!first &&
      ts.isExpressionStatement(first) &&
      ts.isStringLiteral(first.expression) &&
      first.expression.text === "use client",
    imports: [],
    translations: [],
    declared: [],
    unreadable: 0,
  };
  const addImport = (specifier: string) => {
    const resolved = resolveImport(path, specifier);
    if (resolved) info.imports.push(resolved);
  };
  const visit = (node: ts.Node): void => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const typeOnly = ts.isImportDeclaration(node)
        ? !!node.importClause?.isTypeOnly
        : node.isTypeOnly;
      if (!typeOnly) addImport(node.moduleSpecifier.text);
    } else if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const arg = node.arguments[0];
      if (callee.kind === ts.SyntaxKind.ImportKeyword) {
        if (arg && ts.isStringLiteral(arg)) addImport(arg.text);
      } else if (ts.isIdentifier(callee) && callee.text === "useTranslations") {
        info.translations.push(arg && ts.isStringLiteral(arg) ? arg.text : "");
      }
    } else if (ts.isJsxOpeningLikeElement(node)) {
      if (node.tagName.getText() === "ClientMessages") {
        const prop = node.attributes.properties.find(
          (p): p is ts.JsxAttribute =>
            ts.isJsxAttribute(p) && p.name.getText() === "namespaces",
        );
        const value =
          prop?.initializer && ts.isJsxExpression(prop.initializer)
            ? prop.initializer.expression
            : undefined;
        if (
          value &&
          ts.isArrayLiteralExpression(value) &&
          value.elements.every(ts.isStringLiteral)
        ) {
          for (const el of value.elements) {
            info.declared.push((el as ts.StringLiteral).text);
          }
        } else {
          info.unreadable++;
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return info;
}

const FILES = new Map<string, FileInfo>(
  listCode(SRC).map((path) => [path, readFile(path)]),
);

const rel = (path: string) => relative(SRC, path).split(sep).join("/");

/** Namespaces lus côté client depuis une entrée : namespace → fichiers. */
function clientNamespaces(entry: string): Map<string, Set<string>> {
  const found = new Map<string, Set<string>>();
  const seen = new Set<string>();
  const walk = (file: string, inClient: boolean) => {
    const info = FILES.get(file);
    const key = `${file}|${inClient}`;
    if (!info || seen.has(key)) return;
    seen.add(key);
    const client = inClient || info.client;
    if (client) {
      for (const ns of info.translations) {
        if (!found.has(ns)) found.set(ns, new Set());
        found.get(ns)!.add(rel(file));
      }
    }
    for (const next of info.imports) walk(next, client);
  };
  walk(entry, false);
  return found;
}

/** Layouts ancêtres (du plus proche de l'entrée jusqu'à src/app), fichier compris. */
function providedBy(entry: string): string[] {
  const provided: string[] = [...ROOT_CLIENT_NAMESPACES];
  provided.push(...(FILES.get(entry)?.declared ?? []));
  let dir = dirname(entry);
  while (dir.startsWith(APP)) {
    const layout = join(dir, "layout.tsx");
    if (layout !== entry) provided.push(...(FILES.get(layout)?.declared ?? []));
    if (dir === APP) break;
    dir = dirname(dir);
  }
  return provided;
}

const covers = (provided: string[], ns: string) =>
  provided.some((p) => ns === p || ns.startsWith(`${p}.`));

const ENTRIES = [...FILES.keys()].filter(
  (path) =>
    path.startsWith(APP + sep) &&
    ENTRY_FILE.test(path.slice(path.lastIndexOf(sep) + 1)),
);

describe("messages envoyés au client", () => {
  it("l'analyse trouve des entrées et des namespaces (sinon le test est vide)", () => {
    expect(ENTRIES.length).toBeGreaterThan(20);
    const all = ENTRIES.flatMap((e) => [...clientNamespaces(e).keys()]);
    expect(all.length).toBeGreaterThan(20);
    expect(all).toContain("nav");
    expect(all).toContain("catalog.viewer");
  });

  it("<ClientMessages> reçoit toujours un tableau littéral de chaînes", () => {
    const bad = [...FILES]
      .filter(([, info]) => info.unreadable > 0)
      .map(([path]) => rel(path));
    expect(bad).toEqual([]);
  });

  it("aucun useTranslations() sans argument dans du code client", () => {
    const bad: string[] = [];
    for (const entry of ENTRIES) {
      const files = clientNamespaces(entry).get("");
      if (files) bad.push(...files);
    }
    // Sans argument, le composant lit tout l'arbre : impossible à restreindre.
    expect([...new Set(bad)]).toEqual([]);
  });

  it("chaque namespace lu côté client est fourni par la racine ou un ancêtre", () => {
    const missing: string[] = [];
    for (const entry of ENTRIES) {
      const provided = providedBy(entry);
      for (const [ns, files] of clientNamespaces(entry)) {
        if (ns !== "" && !covers(provided, ns)) {
          missing.push(
            `${rel(entry)} : « ${ns} » lu par ${[...files].join(", ")}`,
          );
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("chaque namespace déclaré existe dans les 4 langues", () => {
    const declared = new Set<string>(ROOT_CLIENT_NAMESPACES);
    for (const info of FILES.values()) {
      for (const ns of info.declared) declared.add(ns);
    }
    const absent: string[] = [];
    for (const locale of routing.locales) {
      const json = (path: string) =>
        JSON.parse(readFileSync(`${MESSAGES_DIR}${path}`, "utf8")) as Messages;
      const merged = mergeNamespaces(
        json(`${locale}.json`),
        NAMESPACES.map((ns) => json(`${locale}/${ns}.json`)),
        locale,
      );
      for (const ns of declared) {
        let node: unknown = merged;
        for (const segment of ns.split(".")) {
          node =
            typeof node === "object" && node !== null
              ? (node as Messages)[segment]
              : undefined;
        }
        if (node === undefined) absent.push(`${locale} : ${ns}`);
      }
    }
    expect(absent).toEqual([]);
  });
});
