import { describe, expect, it } from "vitest";
import { defaultConfig } from "@/lib/studio/presets";
import type { LavauxConfig } from "@/lib/studio/types";
import { decodeSearchParams } from "@/lib/studio/url-state";
import { adaptBandsParam } from "./get-params";

describe("adaptBandsParam (formulaire GET sans JavaScript)", () => {
  const bands = "bleu-leman:42,vert-lavaux:108,blanc-neve:150";

  function decode(object: "lavaux" | "relief", query: Record<string, string>) {
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
      "vert-lavaux",
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

  it("le sous-verre cale ses bandes sur les sommets de strates", () => {
    const decoded = decode("relief", {
      ba: "3",
      re: "3.2",
      lv: "4",
      bd: "bleu-leman:3,vert-lavaux:4.1,blanc-neve:6.6",
    });
    expect(decoded.ok).toBe(true);
  });
});
