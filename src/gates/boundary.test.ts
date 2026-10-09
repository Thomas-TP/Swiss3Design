// Frontière du bundle motion (règle d'or 10 ; brief de refonte « Strates »,
// §4.1 et §4.6).
//
// three, gsap et lenis ne vivent que sous src/motion/**, et src/motion n'est
// atteint QUE par `next/dynamic(() => import("@/motion/…"), { ssr: false })`
// déclaré au niveau module d'un fichier de src/gates/** : avec `ssr: false`,
// le transform de Next retire l'import du build serveur, le Worker ne voit
// jamais ces paquets. Un `await import("three")` dans l'effet d'un composant
// rendu côté serveur, lui, reste dans le Worker (≈ 243 KiB gzip pour three).
//
// oxlint (`no-restricted-imports`) bloque déjà les imports de valeur ; ce test
// ajoute ce que le lint ne sait pas dire :
//   - dans un gate : `"use client"` en tête, aucun import statique de
//     @/motion (même `import { type X }` : seul `import type` passe), chaque
//     `import("@/motion/…")` est le premier argument d'un `dynamic()` de
//     next/dynamic, au niveau module, avec `{ ssr: false }` littéral ;
//   - partout ailleurs dans src/** (hors src/motion et src/gates) : aucune
//     référence à `@/motion` ni aucun import de three/gsap/lenis, même de type.
//
// Les fichiers sont lus par le parseur de TypeScript (pas par des regex) :
// commentaires, chaînes et gabarits ne créent ni faux positif ni angle mort.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const SRC = fileURLToPath(new URL("..", import.meta.url));
const GATES_DIR = join(SRC, "gates");
const MOTION_DIR = join(SRC, "motion");

const CODE_FILE = /\.[cm]?[jt]sx?$/;
const TEST_FILE = /\.test\.[cm]?[jt]sx?$/;

// Moteurs client-only. `motion` (Framer, « motion/react ») n'en fait pas
// partie : il reste autorisé pour l'existant et l'admin (brief §3.1).
const ENGINE = /^(?:three|gsap|lenis|postprocessing)(?:\/|$)|^@gsap\//;
const MOTION_ALIAS = /^@\/motion(?:\/|$)/;

// Temporaire : ancien viewer 3D, supprimé par WP-SHOP (même exception que
// l'override d'oxlint, retiré par WP-99). Exempté pour three seulement, et un
// fichier absent est simplement ignoré : sa suppression ne casse pas ce test.
const TEMPORARY_THREE_USERS = new Set([
  "components/product-viewer-3d.tsx",
  "components/showroom-scene.ts",
]);

interface ModuleRef {
  specifier: string;
  typeOnly: boolean;
  dynamic: boolean;
  node: ts.Node;
}

function parse(source: string, fileName: string): ts.SourceFile {
  return ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
  );
}

function literalText(node: ts.Node | undefined): string | null {
  if (!node) return null;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    return node.text;
  // Gabarit `@/motion/${x}` : on garde la tête, assez pour tester un préfixe.
  if (ts.isTemplateExpression(node)) return `${node.head.text}\${…}`;
  return null;
}

/** Tous les modules référencés : import/export, import(), require(), import("x").T. */
function moduleRefs(sf: ts.SourceFile): ModuleRef[] {
  const refs: ModuleRef[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node)) {
      const specifier = literalText(node.moduleSpecifier);
      if (specifier !== null)
        refs.push({
          specifier,
          typeOnly: node.importClause?.isTypeOnly ?? false,
          dynamic: false,
          node,
        });
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      const specifier = literalText(node.moduleSpecifier);
      if (specifier !== null)
        refs.push({
          specifier,
          typeOnly: node.isTypeOnly,
          dynamic: false,
          node,
        });
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      const specifier = literalText(node.moduleReference.expression);
      if (specifier !== null)
        refs.push({
          specifier,
          typeOnly: node.isTypeOnly,
          dynamic: false,
          node,
        });
    } else if (ts.isImportTypeNode(node)) {
      const arg = node.argument;
      const specifier = ts.isLiteralTypeNode(arg)
        ? literalText(arg.literal)
        : null;
      if (specifier !== null)
        refs.push({ specifier, typeOnly: true, dynamic: false, node });
    } else if (ts.isCallExpression(node)) {
      const isImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
      const isRequire =
        ts.isIdentifier(node.expression) && node.expression.text === "require";
      if (isImport || isRequire) {
        const specifier = literalText(node.arguments[0]) ?? "<non littéral>";
        refs.push({ specifier, typeOnly: false, dynamic: isImport, node });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return refs;
}

/** Toute chaîne qui commence par @/motion (import, vi.mock, chargeur maison…). */
function motionStrings(sf: ts.SourceFile): ts.Node[] {
  const found: ts.Node[] = [];
  const visit = (node: ts.Node) => {
    if (
      (ts.isStringLiteral(node) ||
        ts.isNoSubstitutionTemplateLiteral(node) ||
        ts.isTemplateHead(node)) &&
      MOTION_ALIAS.test(node.text)
    )
      found.push(node);
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

function lineOf(sf: ts.SourceFile, node: ts.Node): number {
  return sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
}

/** Contrat d'un fichier de src/gates/** ; renvoie la liste des violations. */
function checkGate(source: string, fileName: string): string[] {
  const sf = parse(source, fileName);
  const errors: string[] = [];
  const at = (node: ts.Node, message: string) =>
    errors.push(`${fileName}:${lineOf(sf, node)} ${message}`);

  // (c) La directive doit être la première instruction (commentaires permis).
  const first = sf.statements[0];
  if (
    !first ||
    !ts.isExpressionStatement(first) ||
    !ts.isStringLiteral(first.expression) ||
    first.expression.text !== "use client"
  )
    errors.push(`${fileName}:1 doit commencer par "use client"`);

  // Nom local de l'import par défaut de next/dynamic (souvent « dynamic »).
  const dynamicNames = new Set<string>();
  for (const statement of sf.statements)
    if (
      ts.isImportDeclaration(statement) &&
      literalText(statement.moduleSpecifier) === "next/dynamic" &&
      !statement.importClause?.isTypeOnly &&
      statement.importClause?.name
    )
      dynamicNames.add(statement.importClause.name.text);

  for (const ref of moduleRefs(sf)) {
    const toMotion = MOTION_ALIAS.test(ref.specifier);

    if (ENGINE.test(ref.specifier) && !ref.typeOnly) {
      at(
        ref.node,
        `importe « ${ref.specifier} » : un gate n'atteint les moteurs que via @/motion/**`,
      );
      continue;
    }
    if (!ref.dynamic) {
      // (a) Aucun import statique de valeur de @/motion.
      if (toMotion && !ref.typeOnly)
        at(
          ref.node,
          `import statique de « ${ref.specifier} » : seul \`import type\` est permis, le code passe par dynamic()`,
        );
      continue;
    }
    if (!toMotion) {
      at(
        ref.node,
        `import() de « ${ref.specifier} » : un gate n'importe dynamiquement que @/motion/**`,
      );
      continue;
    }

    // (b) import("@/motion/…") = premier argument d'un dynamic() de next/dynamic.
    let child: ts.Node = ref.node;
    let call: ts.CallExpression | null = null;
    while (child.parent) {
      const parent: ts.Node = child.parent;
      if (
        ts.isCallExpression(parent) &&
        ts.isIdentifier(parent.expression) &&
        dynamicNames.has(parent.expression.text) &&
        parent.arguments[0] === child
      ) {
        call = parent;
        break;
      }
      child = parent;
    }
    if (!call) {
      at(
        ref.node,
        `import("${ref.specifier}") hors du premier argument d'un dynamic() importé de next/dynamic`,
      );
      continue;
    }

    const options = call.arguments[1];
    const ssrFalse =
      options !== undefined &&
      ts.isObjectLiteralExpression(options) &&
      options.properties.some(
        (p) =>
          ts.isPropertyAssignment(p) &&
          (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) &&
          p.name.text === "ssr" &&
          p.initializer.kind === ts.SyntaxKind.FalseKeyword,
      );
    if (!ssrFalse)
      at(
        call,
        `dynamic() de « ${ref.specifier} » sans \`{ ssr: false }\` littéral : le module entrerait dans le Worker`,
      );

    // Au niveau module : un dynamic() dans un composant est recréé à chaque rendu.
    for (let n: ts.Node | undefined = call.parent; n; n = n.parent)
      if (ts.isFunctionLike(n)) {
        at(call, "dynamic() doit être déclaré au niveau module");
        break;
      }
  }
  return errors;
}

/** Règle du reste de src/** : ni @/motion ni moteur, même en type. */
function checkOutsideBoundary(
  source: string,
  fileName: string,
  { allowThree = false } = {},
): string[] {
  const sf = parse(source, fileName);
  const errors: string[] = [];
  for (const node of motionStrings(sf))
    errors.push(
      `${fileName}:${lineOf(sf, node)} référence @/motion hors de src/gates/** (passer par un gate)`,
    );
  for (const ref of moduleRefs(sf)) {
    if (!ENGINE.test(ref.specifier)) continue;
    if (allowThree && /^three(?:\/|$)/.test(ref.specifier)) continue;
    errors.push(
      `${fileName}:${lineOf(sf, ref.node)} importe « ${ref.specifier} » hors de src/motion/**`,
    );
  }
  return errors;
}

function listCodeFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && CODE_FILE.test(e.name))
    .map((e) => join(e.parentPath, e.name));
}

const fromSrc = (file: string) => relative(SRC, file).split(sep).join("/");
const inside = (file: string, dir: string) =>
  !relative(dir, file).startsWith("..");

describe("frontière motion : src/gates/**", () => {
  it("chaque gate : use client, aucun import statique de @/motion, dynamic() + ssr: false au niveau module", () => {
    const gates = listCodeFiles(GATES_DIR).filter((f) => !TEST_FILE.test(f));
    const errors = gates.flatMap((f) =>
      checkGate(readFileSync(f, "utf8"), fromSrc(f)),
    );
    expect(errors).toEqual([]);
  });
});

describe("frontière motion : src/** hors src/motion et src/gates", () => {
  it("aucune référence à @/motion ni import de three, gsap, lenis", () => {
    const files = listCodeFiles(SRC).filter(
      (f) => !inside(f, MOTION_DIR) && !inside(f, GATES_DIR),
    );
    // Garde-fou du garde-fou : le parcours a bien trouvé le code de l'app.
    expect(files.length).toBeGreaterThan(100);
    const errors = files.flatMap((f) =>
      checkOutsideBoundary(readFileSync(f, "utf8"), fromSrc(f), {
        allowThree: TEMPORARY_THREE_USERS.has(fromSrc(f)),
      }),
    );
    expect(errors).toEqual([]);
  });
});

// Auto-test des vérificateurs : src/gates/ ne contient encore aucun gate
// (src/gates/runtime.tsx arrive plus tard dans WP-00), le test ci-dessus
// passerait donc à vide. Ces cas prouvent que chaque règle mord.
describe("vérificateurs de frontière (cas témoins)", () => {
  const GOOD_GATE = `"use client";
// Gate : rien d'autre que des déclarations dynamic().
import dynamic from "next/dynamic";
import type { StageContext } from "@/motion/stage/types";
export type { StageContext };
export const MotionRuntime = dynamic(
  () => import("@/motion/runtime").then((m) => m.MotionRuntime),
  { ssr: false },
);
export const StageRoot = dynamic(() => import("@/motion/stage/root"), {
  ssr: false,
  loading: () => null,
});
`;

  it("accepte un gate conforme", () => {
    expect(checkGate(GOOD_GATE, "gates/runtime.tsx")).toEqual([]);
  });

  it.each([
    [
      "sans use client",
      GOOD_GATE.replace(`"use client";\n`, ""),
      `"use client"`,
    ],
    [
      "use client après un import",
      GOOD_GATE.replace(`"use client";\n`, "").replace(
        `import dynamic from "next/dynamic";`,
        `import dynamic from "next/dynamic";\n"use client";`,
      ),
      `"use client"`,
    ],
    [
      "import statique de valeur",
      `${GOOD_GATE}import { gsap } from "@/motion/gsap";\n`,
      "import statique",
    ],
    [
      "import { type X } (pas import type)",
      `${GOOD_GATE}import { type Capability } from "@/motion/stage/types";\n`,
      "import statique",
    ],
    [
      "import de side-effect",
      `${GOOD_GATE}import "@/motion/gsap";\n`,
      "import statique",
    ],
    [
      "réexport de valeur",
      `${GOOD_GATE}export { gsap } from "@/motion/gsap";\n`,
      "import statique",
    ],
    [
      "ssr: true",
      GOOD_GATE.replace("{ ssr: false },", "{ ssr: true },"),
      "ssr: false",
    ],
    [
      "options absentes",
      GOOD_GATE.replace(
        `() => import("@/motion/runtime").then((m) => m.MotionRuntime),\n  { ssr: false },`,
        `() => import("@/motion/runtime").then((m) => m.MotionRuntime),`,
      ),
      "ssr: false",
    ],
    [
      "options par variable",
      `${GOOD_GATE}const OPTS = { ssr: false };\nexport const X = dynamic(() => import("@/motion/x"), OPTS);\n`,
      "ssr: false",
    ],
    [
      "import() hors de dynamic()",
      `${GOOD_GATE}export async function load() { return import("@/motion/runtime"); }\n`,
      "hors du premier argument",
    ],
    [
      "dynamic() dans un composant",
      `${GOOD_GATE}export function Lazy() { const C = dynamic(() => import("@/motion/x"), { ssr: false }); return C; }\n`,
      "niveau module",
    ],
    [
      "dynamic qui ne vient pas de next/dynamic",
      GOOD_GATE.replace(
        `import dynamic from "next/dynamic";`,
        `import dynamic from "./my-dynamic";`,
      ),
      "hors du premier argument",
    ],
    [
      "import() d'un autre module",
      `${GOOD_GATE}export const Y = dynamic(() => import("@/components/header"), { ssr: false });\n`,
      "que @/motion/**",
    ],
    [
      "import() non littéral",
      `${GOOD_GATE}const p = "@/motion/x";\nexport const Z = dynamic(() => import(p), { ssr: false });\n`,
      "que @/motion/**",
    ],
    [
      "moteur importé directement",
      `${GOOD_GATE}import { gsap } from "gsap";\n`,
      "moteurs que via",
    ],
  ])("refuse un gate : %s", (_label, source, expected) => {
    expect(checkGate(source, "gates/bad.tsx").join("\n")).toContain(expected);
  });

  it.each([
    ["import statique de three", `import * as THREE from "three";`],
    ["import type de three", `import type { Texture } from "three";`],
    [
      "sous-chemin de three",
      `import { OrbitControls } from "three/addons/controls/OrbitControls.js";`,
    ],
    [
      "await import() de three",
      `export async function f() { return import("three"); }`,
    ],
    ['type import("three")', `export type R = import("three").WebGLRenderer;`],
    ["gsap", `import { gsap } from "gsap";`],
    ["plugin gsap", `import { ScrollTrigger } from "gsap/ScrollTrigger";`],
    ["@gsap/react", `import { useGSAP } from "@gsap/react";`],
    ["lenis", `import Lenis from "lenis";`],
    ["lenis/react", `import { ReactLenis } from "lenis/react";`],
    ["require()", `const three = require("three");`],
    ["import de @/motion", `import { gsap } from "@/motion/gsap";`],
    [
      "import type de @/motion",
      `import type { StageScene } from "@/motion/stage/types";`,
    ],
    [
      "import() de @/motion",
      `export const m = () => import("@/motion/runtime");`,
    ],
    [
      "gabarit @/motion",
      "export const m = (s: string) => import(`@/motion/${s}`);",
    ],
    ["mock de @/motion", `vi.mock("@/motion/gsap");`],
  ])("refuse hors frontière : %s", (_label, source) => {
    expect(checkOutsideBoundary(source, "components/bad.tsx")).not.toEqual([]);
  });

  it.each([
    ["Framer Motion", `import { motion } from "motion/react";`],
    [
      "bridge léger",
      `import { useMotionBridge } from "@/lib/motion-bridge/store";`,
    ],
    [
      "mention en commentaire",
      `// src/motion n'est atteint que par un gate ("@/motion/gsap").`,
    ],
    ["mot three dans un texte", `export const label = "three";`],
    ["paquet voisin", `import { threeish } from "three-stdlib-like";`],
  ])("accepte hors frontière : %s", (_label, source) => {
    expect(checkOutsideBoundary(source, "components/ok.tsx")).toEqual([]);
  });

  it("l'exception temporaire du viewer ne couvre que three", () => {
    const source = `import * as THREE from "three";\nimport { gsap } from "gsap";`;
    expect(
      checkOutsideBoundary(source, "components/product-viewer-3d.tsx", {
        allowThree: true,
      }),
    ).toHaveLength(1);
  });
});
