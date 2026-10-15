import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { exportStl } from "./build";
import {
  BORNE_DEFAULT,
  CARTOUCHE_DEFAULT,
  LAVAUX_DEFAULT,
  MONTAGNE_DEFAULT,
} from "./presets";
import { exportOrderStl, orderNeedsGlyphs } from "./order-stl";
import { studioLineInputSchema, validateStudioLine } from "./purchase";
import { sanitizeTexts } from "./text/fields";
import { setGlyphFont, parseGlyphFont } from "./text/glyphs";
import type { StudioConfig } from "./types";

// Le STL de l'admin (regénéré dans son navigateur depuis la configuration gardée
// dans la commande) doit avoir les MÊMES octets et le même hash que l'export du
// Studio pour la même configuration : l'atelier imprime ce que le client a vu.
const JSON_PATH = new URL(
  "../../../public/studio/glyphs/s3d-relief-v1.json",
  import.meta.url,
);

function snapshot(
  config: StudioConfig,
  texts: Record<string, string>,
  locale: "fr" | "de" | "it" | "en" = "fr",
) {
  const result = validateStudioLine(
    studioLineInputSchema.parse({
      kind: "studio",
      object: config.object,
      config: JSON.parse(JSON.stringify(config)),
      texts,
      locale,
      quantity: 1,
    }),
  );
  if (!result.ok) throw new Error("ligne refusée : " + result.error);
  // Aller-retour jsonb : ce que la base rend.
  return JSON.parse(JSON.stringify(result.line.snapshot));
}

describe("STL de l'admin = export du Studio", () => {
  beforeAll(() => {
    setGlyphFont(parseGlyphFont(JSON.parse(readFileSync(JSON_PATH, "utf8"))));
  });
  afterAll(() => setGlyphFont(null));

  const cases: [string, StudioConfig, Record<string, string>, "fr" | "de"][] = [
    ["vase", LAVAUX_DEFAULT, {}, "fr"],
    [
      "carte de visite",
      CARTOUCHE_DEFAULT,
      {
        name: "Élodie Müller",
        role: "Ingénieure ETH",
        line1: "elodie@exemple.ch",
      },
      "fr",
    ],
    [
      "Montagne (étiquette, altitude 2 566 en français)",
      { ...MONTAGNE_DEFAULT, altMode: "saisie", altitude: 2566 },
      { peak: "Cervin" },
      "fr",
    ],
    [
      "Montagne (altitude 2’566 en allemand)",
      { ...MONTAGNE_DEFAULT, altMode: "saisie", altitude: 2566 },
      { peak: "Cervin" },
      "de",
    ],
    ["porte-nom", BORNE_DEFAULT, { text: "Léa" }, "fr"],
  ];

  for (const [label, config, texts, locale] of cases) {
    it(`${label} : mêmes octets, même hash, même nom de fichier`, () => {
      const line = snapshot(config, texts, locale);
      const admin = exportOrderStl(line);
      // Le chemin du Studio (Web Worker, runExport) : textes bruts du visiteur,
      // nettoyés par le moteur, puis exportStl(config, texts, { locale }).
      const studio = exportStl(line.config, sanitizeTexts(line.object, texts), {
        locale,
      });
      expect(admin.hash).toBe(studio.hash);
      expect(admin.fileName).toBe(studio.fileName);
      expect(admin.bytes).toBe(studio.bytes);
      expect(admin.triangles).toBe(studio.triangles);
      expect(Buffer.from(admin.buffer).equals(Buffer.from(studio.buffer))).toBe(
        true,
      );
      // L'empreinte gardée à l'achat est celle du fichier.
      expect(admin.hash).toBe(line.hash);
      expect(admin.fileName).toBe(`s3d-${line.object}-${line.hash}.stl`);
      // En-tête binaire : jamais « solid ».
      expect(
        Buffer.from(admin.buffer).subarray(0, 5).toString("ascii"),
      ).not.toBe("solid");
    });
  }

  it("le chemin du Studio est bien celui que ce test reproduit (runExport du Worker du Studio)", () => {
    const source = readFileSync(
      new URL("../../motion/studio/geometry-core.ts", import.meta.url),
      "utf8",
    );
    expect(source).toContain(
      "const texts = sanitizeTexts(config.object, rawTexts);",
    );
    expect(source).toContain("exportStl(config, texts, { locale })");
  });

  it("la police de glyphes n'est nécessaire que pour un objet qui imprime un texte", () => {
    expect(orderNeedsGlyphs(snapshot(LAVAUX_DEFAULT, {}))).toBe(false);
    expect(orderNeedsGlyphs(snapshot(BORNE_DEFAULT, { text: "Léa" }))).toBe(
      true,
    );
    expect(
      orderNeedsGlyphs(snapshot({ ...MONTAGNE_DEFAULT, label: false }, {})),
    ).toBe(false);
  });
});
