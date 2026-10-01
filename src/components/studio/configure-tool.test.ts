import { describe, expect, it } from "vitest";
import { nearVaseSpirale } from "@/lib/studio/guards";
import { FILAMENT_IDS } from "@/lib/studio/filaments";
import { decodeFragment } from "@/lib/studio/url-state";
import { defaultConfig } from "@/lib/studio/presets";
import {
  configureFromTool,
  describeConfiguration,
  STUDIO_TOOL_OBJECTS,
} from "./configure-tool";

describe("outil WebMCP studio_configure (§6.13)", () => {
  it("construit un lien partageable et ses chiffres, sans aucun texte", () => {
    const result = configureFromTool({
      object: "lavaux",
      params: { h: 180, m: "vagues" },
      palette: ["encre", "gris-molasse", "blanc-neve"],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config).toMatchObject({
      object: "lavaux",
      h: 180,
      pattern: { kind: "vagues" },
    });
    expect(
      result.config.object === "lavaux" &&
        result.config.bands.map((b) => b.filament),
    ).toEqual(["encre", "gris-molasse", "blanc-neve"]);
    const answer = describeConfiguration(
      result.config,
      "https://swiss3design.ch",
      "fr",
    );
    expect(answer.link).toMatch(
      /^https:\/\/swiss3design\.ch\/fr\/studio\/lavaux#c=v1\.[A-Za-z0-9_-]+$/,
    );
    expect(answer.stats.height_mm).toBe(180);
    expect(answer.stats.layers).toBe(900);
    expect(answer.stats.changes).toBe(2);
    expect(answer.stats.grams).toBeGreaterThan(50);
    expect(answer.printable).toBe("ok");
    // Le lien rouvre exactement cette configuration.
    const hash = answer.link.slice(answer.link.indexOf("#"));
    const back = decodeFragment("lavaux", hash, defaultConfig("lavaux"));
    expect(back.ok && back.config).toEqual(result.config);
    // Pas de prix tant que le barème n'est pas validé.
    expect(answer.stats).not.toHaveProperty("estimate_chf");
  });

  it("les quatre objets se configurent ; les valeurs hors plage sont ramenées à la plage", () => {
    for (const object of STUDIO_TOOL_OBJECTS) {
      const result = configureFromTool({ object });
      expect(result.ok).toBe(true);
    }
    const clamped = configureFromTool({
      object: "lavaux",
      params: { h: 99999, d: -5 },
    });
    expect(clamped.ok && clamped.config).toMatchObject({ h: 240, d: 50 });
  });

  it("refuse une clé de texte : les noms et contacts se saisissent sur la page", () => {
    for (const key of ["name", "role", "line1", "line2", "peak", "text"]) {
      const result = configureFromTool({
        object: "cartouche",
        params: { [key]: "Zoé Sentinelle" },
      });
      expect(result.ok).toBe(false);
      const message = result.ok ? "" : result.error;
      expect(message).toContain("never accepted");
      expect(message).not.toContain("Sentinelle");
    }
  });

  it("refuse un objet inconnu, des paramètres mal formés, un filament inconnu, une palette trop longue", () => {
    expect(configureFromTool({ object: "vase" }).ok).toBe(false);
    expect(configureFromTool({ object: "lavaux", params: [1, 2] }).ok).toBe(
      false,
    );
    expect(configureFromTool({ object: "lavaux", params: { h: {} } }).ok).toBe(
      false,
    );
    expect(
      configureFromTool({ object: "lavaux", params: { h: "pas un nombre" } })
        .ok,
    ).toBe(false);
    expect(
      configureFromTool({ object: "lavaux", palette: ["fuchsia"] }).ok,
    ).toBe(false);
    expect(
      configureFromTool({
        object: "lavaux",
        palette: ["encre", "ambre", "glacier", "blanc-neve", "rouge-signal"],
      }).ok,
    ).toBe(false);
  });

  it("palette : plaque puis texte pour une carte, base puis texte pour un porte-nom, strates pour un sous-verre", () => {
    const card = configureFromTool({
      object: "cartouche",
      palette: ["ambre", "encre"],
    });
    expect(card.ok && card.config).toMatchObject({
      plate: "ambre",
      ink: "encre",
    });
    const tag = configureFromTool({ object: "borne", palette: ["glacier"] });
    expect(tag.ok && tag.config).toMatchObject({
      base: "glacier",
      ink: "blanc-neve",
    });
    const relief = configureFromTool({
      object: "relief",
      palette: ["bleu-leman", "blanc-neve"],
    });
    expect(
      relief.ok && relief.config.object === "relief" && relief.config.bands,
    ).toHaveLength(2);
  });

  it("une combinaison proche du Vase spirale est signalée non imprimable, jamais fabriquée en silence", () => {
    const result = configureFromTool({
      object: "lavaux",
      params: { m: "nervures", rn: 40, rt: 90, n: 0.55 },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(nearVaseSpirale(result.config)).toBe(true);
    const answer = describeConfiguration(
      result.config,
      "https://swiss3design.ch",
      "fr",
    );
    expect(answer.printable).toBe("error");
    expect(answer.issues).toContain("near-vase-spirale");
  });

  it("la palette de l'outil couvre tous les filaments", () => {
    for (const id of FILAMENT_IDS)
      expect(configureFromTool({ object: "cartouche", palette: [id] }).ok).toBe(
        true,
      );
  });
});
