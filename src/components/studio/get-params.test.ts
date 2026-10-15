import { describe, expect, it } from "vitest";
import { defaultConfig } from "@/lib/studio/presets";
import type { LavauxConfig } from "@/lib/studio/types";
import { decodeSearchParams } from "@/lib/studio/url-state";
import { adaptBandsParam } from "./get-params";

describe("adaptBandsParam (formulaire GET sans JavaScript)", () => {
  const bands = "bleu-leman:42,vert-foret:108,blanc-neve:150";

  function decode(
    object: "lavaux" | "montagne",
    query: Record<string, string>,
  ) {
    return decodeSearchParams(
      object,
      adaptBandsParam(object, query),
      defaultConfig(object),
    );
  }

  /** Configuration décodée du vase ; échoue le test si la requête est refusée. */
  function lavaux(query: Record<string, string>): LavauxConfig {
    const decoded = decode("lavaux", query);
    if (!decoded.ok || decoded.config.object !== "lavaux")
      throw new Error("requête refusée");
    return decoded.config;
  }

  it("sans adaptation, une hauteur plus basse que les bandes est refusée", () => {
    const query = { h: "120", bd: bands };
    expect(
      decodeSearchParams("lavaux", query, defaultConfig("lavaux")).ok,
    ).toBe(false);
  });

  it("une hauteur plus basse ramène la dernière bande à cette hauteur", () => {
    const config = lavaux({ h: "120", bd: bands });
    expect(config.h).toBe(120);
    expect(config.bands.at(-1)?.toMm).toBe(120);
    expect(config.bands.map((b) => b.filament)).toEqual([
      "bleu-leman",
      "vert-foret",
      "blanc-neve",
    ]);
  });

  it("une hauteur plus haute prolonge la dernière bande", () => {
    const config = lavaux({ h: "200", bd: "bleu-leman:42,blanc-neve:150" });
    expect(config.bands.at(-1)?.toMm).toBe(200);
  });

  it("une bande qui deviendrait trop mince est retirée (2 mm au moins)", () => {
    const tops = lavaux({ h: "109", bd: bands }).bands.map((b) => b.toMm);
    expect(tops.at(-1)).toBe(109);
    const thicknesses = tops.map((top, k) => top - (tops[k - 1] ?? 0));
    expect(Math.min(...thicknesses)).toBeGreaterThanOrEqual(2);
  });

  it("une requête sans `bd`, ou illisible, est rendue telle quelle", () => {
    const noBands = { h: "120" };
    expect(adaptBandsParam("lavaux", noBands)).toBe(noBands);
    const bad = { h: "120", bd: "zzz" };
    expect(adaptBandsParam("lavaux", bad)).toBe(bad);
    expect(decode("lavaux", bad).ok).toBe(false);
  });

  it("les objets sans bandes ne changent pas", () => {
    const query = { t: "1.6", bd: bands };
    expect(adaptBandsParam("cartouche", query)).toBe(query);
  });

  it("la montagne ramène ses bandes au socle et à la hauteur annoncés", () => {
    // Socle 6 mm et montagne de 100 mm : la dernière bande finit à 106, la première à 6.
    const decoded = decode("montagne", {
      pl: "6",
      h: "100",
      bd: "encre:5,vert-foret:35,blanc-neve:80",
    });
    expect(decoded.ok).toBe(true);
    if (!decoded.ok || decoded.config.object !== "montagne") return;
    expect(decoded.config.bands.map((b) => b.toMm)).toEqual([6, 35, 106]);
  });

  it("la montagne borne la hauteur à 1,6 fois la base avant de ramener les bandes", () => {
    // Base 60 mm : 96 mm au plus ; une hauteur de 120 est ramenée à 96 (socle 5 → total 101).
    const decoded = decode("montagne", {
      s: "60",
      pl: "5",
      h: "120",
      bd: "encre:5,vert-foret:35,blanc-neve:125",
    });
    expect(decoded.ok).toBe(true);
    if (!decoded.ok || decoded.config.object !== "montagne") return;
    expect(decoded.config.height).toBe(96);
    expect(decoded.config.bands.at(-1)?.toMm).toBe(101);
  });
});
