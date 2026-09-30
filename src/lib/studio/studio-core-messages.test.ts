// Le namespace `studioCore` (messages/<locale>/studioCore.json) doit couvrir
// TOUT identifiant que le code de src/lib/studio expose : objets, profils,
// motifs, palettes, filaments, options et codes d'anomalie. La parité entre
// langues est déjà testée par src/i18n/messages.test.ts ; ici on vérifie que le
// code et les textes ne dérivent pas l'un de l'autre.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FILAMENT_IDS } from "./filaments";
import { ISSUE_MESSAGE_KEYS, issueValues } from "./guards";
import { HERO_PALETTE_KEYS, LAVAUX_PRESETS } from "./presets";
import { LAVAUX_PATTERN_KINDS, LAVAUX_PROFILES } from "./schemas";
import { STUDIO_OBJECT_IDS, type IssueCode } from "./types";

const LOCALES = ["fr", "de", "it", "en"] as const;

type Tree = { [key: string]: Tree | string };
const load = (locale: string): Tree =>
  JSON.parse(
    readFileSync(
      fileURLToPath(
        new URL(`../../../messages/${locale}/studioCore.json`, import.meta.url),
      ),
      "utf8",
    ),
  );

function lookup(tree: Tree, path: string): string | undefined {
  let node: Tree | string | undefined = tree;
  for (const part of path.split(".")) {
    if (typeof node !== "object" || node === null) return undefined;
    node = node[part];
  }
  return typeof node === "string" ? node : undefined;
}

describe("studioCore : couverture du code", () => {
  for (const locale of LOCALES) {
    const tree = load(locale);
    // Chemins absents : une seule assertion par test, avec la liste en cas d'échec.
    const missing: string[] = [];
    const has = (path: string) => {
      if (!lookup(tree, path)) missing.push(`${locale} : ${path}`);
    };

    it(`${locale} : objets, profils, motifs, palettes, filaments`, () => {
      missing.length = 0;
      for (const id of STUDIO_OBJECT_IDS) {
        has(`objects.${id}.name`);
        has(`objects.${id}.noun`);
        has(`objects.${id}.tagline`);
      }
      for (const profile of LAVAUX_PROFILES) has(`profiles.${profile}`);
      for (const pattern of LAVAUX_PATTERN_KINDS) has(`patterns.${pattern}`);
      for (const palette of HERO_PALETTE_KEYS) has(`palettes.${palette}`);
      for (const filament of FILAMENT_IDS) has(`filaments.${filament}`);
      for (const preset of LAVAUX_PRESETS) has(`presets.${preset.id}`);
      expect(LAVAUX_PRESETS.length).toBeGreaterThan(0);
      expect(missing).toEqual([]);
    });

    it(`${locale} : options des objets plats, unités, mesures, bandes`, () => {
      missing.length = 0;
      for (const v of ["relief", "gravure"]) has(`options.mode.${v}`);
      for (const v of ["classique", "centree", "cartouche", "monogramme"])
        has(`options.layout.${v}`);
      for (const v of ["rond", "carre", "pilule", "etiquette", "goutte", "pic"])
        has(`options.shape.${v}`);
      for (const v of ["gauche", "droite", "aucun"]) has(`options.ring.${v}`);
      for (const v of [
        "layers",
        "filaments",
        "bands",
        "changes",
        "triangles",
        "dimensions",
      ]) {
        has(`units.${v}`);
      }
      for (const v of ["strip", "hero", "onQuote", "priceLater"])
        has(`measure.${v}`);
      for (const v of ["real", "simulated", "extra"]) has(`duration.${v}`);
      for (const v of [
        "label",
        "range",
        "layerReadout",
        "change",
        "boundary",
        "purge",
        "single",
      ]) {
        has(`bands.${v}`);
      }
      for (const v of ["peak", "summit", "fictional"]) has(`relief.${v}`);
      expect(missing).toEqual([]);
    });

    it(`${locale} : un message par code d'anomalie et par état d'imprimabilité`, () => {
      missing.length = 0;
      const codes = Object.keys(ISSUE_MESSAGE_KEYS) as IssueCode[];
      expect(codes).toHaveLength(9);
      for (const code of codes) has(ISSUE_MESSAGE_KEYS[code]);
      for (const status of ["ok", "warn", "error"])
        has(`guard.status.${status}`);
      has("guard.fix");
      expect(missing).toEqual([]);
    });
  }

  it("arguments ICU des anomalies : ceux que issueValues fournit", () => {
    const fr = load("fr");
    const overhang = lookup(fr, ISSUE_MESSAGE_KEYS.overhang)!;
    expect(overhang).toContain("{angle}");
    expect(overhang).toContain("{at}");
    expect(issueValues({ code: "overhang", atMm: 7.5, value: 46.2 })).toEqual({
      angle: 46.2,
      at: 7.5,
    });
    expect(issueValues({ code: "band-thin", atMm: 0, value: 1 })).toEqual({
      value: 1,
    });
    expect(issueValues({ code: "near-vase-spirale" })).toEqual({});
    expect(lookup(fr, ISSUE_MESSAGE_KEYS["text-char"])).toContain("{char}");
  });

  it("le message du Vase spirale est celui du brief, dans les 4 langues", () => {
    expect(lookup(load("fr"), "guard.issue.nearVase")).toContain(
      "Vase spirale de Ian",
    );
    for (const locale of LOCALES) {
      expect(
        lookup(load(locale), "guard.issue.nearVase"),
        `${locale}`,
      ).toContain("Vase spirale");
    }
  });

  it("allemand sans ß, noms publics conformes au lexique (Namensschild, Visitenkarte)", () => {
    const de = JSON.stringify(load("de"));
    expect(de).not.toContain("ß");
    expect(lookup(load("de"), "objects.borne.name")).toBe(
      "Namensschild «Borne»",
    );
    expect(lookup(load("de"), "objects.cartouche.name")).toBe(
      "Visitenkarte «Cartouche»",
    );
    expect(lookup(load("fr"), "objects.lavaux.name")).toBe("Vase « Lavaux »");
    expect(lookup(load("en"), "relief.peak")).toBe("Mount {name}");
    expect(lookup(load("de"), "relief.peak")).toBe("Piz {name}");
  });
});
