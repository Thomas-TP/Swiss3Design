import { describe, expect, it } from "vitest";
import { bandStatsFor } from "@/lib/studio/band-stats";
import { PRICING } from "@/lib/studio/pricing-params";
import {
  BORNE_DEFAULT,
  CARTOUCHE_DEFAULT,
  LAVAUX_DEFAULT,
  RELIEF_DEFAULT,
} from "@/lib/studio/presets";
import { computeStats } from "@/lib/studio/stats";
import type { StudioConfig, StudioTexts } from "@/lib/studio/types";
import { machineLine, configFragment } from "@/lib/studio/url-state";
import { translators, type TestLocale } from "./testing";
import {
  liveSummary,
  measureItems,
  quoteColors,
  quoteDescription,
  quoteDimensions,
  summaryHasText,
  type SummaryInput,
} from "./summary";

const LOCALES: TestLocale[] = ["fr", "de", "it", "en"];

function input(
  config: StudioConfig,
  texts: StudioTexts,
  locale: TestLocale = "fr",
): SummaryInput {
  const { t, core } = translators(locale);
  return {
    config,
    texts,
    stats: computeStats(config, texts, PRICING, locale),
    bands: bandStatsFor(config, texts, PRICING, locale),
    locale,
    t,
    core,
  };
}

/** Espaces insécables (formats de la Suisse) → espaces ordinaires, pour comparer. */
const norm = (text: string) => text.replace(/[\u00a0\u202f]/g, " ");

const LEFTOVER = /\{[a-zA-Z]+\}|\bstudio(Core)?\.[a-z]/;

describe("demande de devis du Studio (§6.9)", () => {
  const link = "https://swiss3design.ch/fr/studio/lavaux#c=v1.eyJ";

  it("le vase par défaut : les lignes du brief, la ligne machine en dernier", () => {
    const lines = quoteDescription(input(LAVAUX_DEFAULT, {}), {
      link,
      quantity: 1,
      remark: "",
    }).split("\n");
    expect(lines[0]).toBe("[Studio] Vase « Lavaux » · configuration v1");
    expect(lines[1]).toBe(`Lien : ${link}`);
    expect(lines[2]).toMatch(
      /^Dimensions : 96 × 96 × 150 mm · 750 couches · paroi 1,6 mm · profil Galet$/,
    );
    expect(lines[3]).toBe("Motif : Gradins (pas 5 mm, profondeur 1,4 mm)");
    expect(lines[4]).toMatch(
      /^Couleurs \(changements à la couche\) : Bleu Léman 0–42 mm \(couches 1–210\) · Vert Lavaux 42–108 mm \(couches 211–540\) · Blanc névé 108–150 mm \(couches 541–750\)$/,
    );
    expect(lines[5]).toMatch(
      /^Estimation affichée : ≈ 92 g · ≈ 3 h 01 · 2 changements$/,
    );
    expect(lines[6]).toBe("Textes à imprimer : —");
    expect(lines[7]).toBe("Quantité : 1");
    expect(lines[8]).toBe("Remarque : —");
    expect(lines[9]).toBe(machineLine(LAVAUX_DEFAULT));
    expect(lines[9]).toMatch(
      /^S3D-STUDIO v1 lavaux h=150 d=96 p=galet b=0\.5 n=0\.72 l=0\.08 m=gradins gs=5 gd=1\.4 w=1\.6 bd=bleu-leman:42,vert-lavaux:108,blanc-neve:150$/,
    );
    expect(lines).toHaveLength(10);
  });

  it("couleurs ≤ 200 caractères, dimensions « 96 × 96 × 150 mm », espaces ordinaires (e-mail en texte brut)", () => {
    const i = input(LAVAUX_DEFAULT, {});
    expect(quoteColors(i)).toBe(
      "Bleu Léman 0–42 mm · Vert Lavaux 42–108 mm · Blanc névé 108–150 mm",
    );
    expect(quoteDimensions(i)).toBe("96 × 96 × 150 mm");
    const description = quoteDescription(i, {
      link,
      quantity: 3,
      remark: "À livrer avant Noël",
    });
    expect(description).not.toMatch(/[\u00a0\u202f]/); // pas d'espace insécable
    expect(description.length).toBeLessThanOrEqual(4000);
    expect(description).toContain("Quantité : 3");
    expect(description).toContain("Remarque : À livrer avant Noël");
  });

  it("le texte saisi n'est que dans la ligne « Textes à imprimer », jamais dans le lien ni la ligne machine", () => {
    const texts = { name: "Zoé Sentinelle", role: "Cheffe de projet" };
    const lines = quoteDescription(input(CARTOUCHE_DEFAULT, texts), {
      link: `https://swiss3design.ch/fr/studio/cartouche${configFragment(CARTOUCHE_DEFAULT)}`,
      quantity: 1,
      remark: "",
    }).split("\n");
    const withText = lines.filter((line) => line.includes("Sentinelle"));
    expect(withText).toEqual([
      "Textes à imprimer : nom : « Zoé Sentinelle » · fonction : « Cheffe de projet »",
    ]);
    expect(lines.at(-1)).toMatch(/^S3D-STUDIO v1 cartouche /);
    expect(lines.at(-1)).not.toContain("Zoé");
  });

  for (const locale of LOCALES) {
    it(`${locale} : les quatre objets se décrivent sans clé manquante ni argument oublié`, () => {
      const texts: StudioTexts = { name: "Zoé", peak: "Zoé", text: "Zoé" };
      for (const config of [
        LAVAUX_DEFAULT,
        CARTOUCHE_DEFAULT,
        RELIEF_DEFAULT,
        BORNE_DEFAULT,
      ]) {
        const i = input(config, texts, locale);
        const description = quoteDescription(i, {
          link,
          quantity: 2,
          remark: "",
        });
        expect(description, `${locale} ${config.object}`).not.toMatch(LEFTOVER);
        expect(description.split("\n").length).toBeGreaterThanOrEqual(10);
        expect(liveSummary(i), `${locale} ${config.object}`).not.toMatch(
          LEFTOVER,
        );
        expect(measureItems(i).join(" ")).not.toMatch(LEFTOVER);
      }
    });
  }

  it("toutes les motifs du vase se décrivent (gradins, vagues, voronoï, nervures, lisse)", () => {
    const patterns = [
      { kind: "lisse" },
      { kind: "gradins", step: 5, depth: 1.4 },
      { kind: "vagues", wavelength: 14, amplitude: 1.2, lobes: 5 },
      { kind: "voronoi", cells: 48, relief: 1.2, seed: 4812 },
      { kind: "nervures", count: 16, depth: 1.2, twistDeg: 0 },
    ] as const;
    for (const pattern of patterns) {
      const config = { ...LAVAUX_DEFAULT, pattern };
      const line = quoteDescription(input(config, {}), {
        link,
        quantity: 1,
        remark: "",
      }).split("\n")[3];
      expect(line).toMatch(/^Motif : /);
      expect(line).not.toMatch(LEFTOVER);
    }
  });
});

describe("résumé vivant et bande de mesure (§6.7, §6.10)", () => {
  it("le résumé du vase : nom, hauteur, motif, couleurs nommées, statut", () => {
    expect(norm(liveSummary(input(LAVAUX_DEFAULT, {})))).toBe(
      "Vase « Lavaux », 150 mm, Gradins, 3 couleurs : Bleu Léman, Vert Lavaux, Blanc névé ; Imprimable.",
    );
  });

  it("le résumé d'un objet à texte porte le texte, donc `.ph-mask`", () => {
    const texts = { name: "Zoé" };
    expect(liveSummary(input(CARTOUCHE_DEFAULT, texts))).toContain("« Zoé »");
    expect(summaryHasText(CARTOUCHE_DEFAULT, texts)).toBe(true);
    expect(summaryHasText(LAVAUX_DEFAULT, {})).toBe(false);
    expect(summaryHasText(CARTOUCHE_DEFAULT, {})).toBe(false);
  });

  it("la bande de mesure : chaque chiffre vient de computeStats, « Prix confirmé sous 48 h » tant que le barème n'est pas validé", () => {
    const i = input(LAVAUX_DEFAULT, {});
    expect(measureItems(i).map(norm)).toEqual([
      "H 150,0 mm",
      "Ø 96,0 mm",
      "750 couches",
      "≈ 92 g",
      "≈ 3 h 01",
      "2 changements",
      "purge ≈ 1,6 g",
      "Prix confirmé sous 48 h",
    ]);
    expect(PRICING.validated).toBe(false);
    // Un objet sans changement n'affiche pas de purge.
    const mono = {
      ...LAVAUX_DEFAULT,
      bands: [{ filament: "encre" as const, toMm: 150 }],
    };
    expect(measureItems(input(mono, {}))).not.toContain("purge ≈ 0 g");
  });
});
