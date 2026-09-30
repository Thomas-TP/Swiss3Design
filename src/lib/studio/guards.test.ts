// Garde-fous du vase « Lavaux » (brief « Strates », §6.6) et « Surprenez-moi ».
import { describe, expect, it } from "vitest";
import { buildLavaux } from "./objects/lavaux";
import { analyzeLavaux } from "./objects/lavaux-analysis";
import {
  checkLavaux,
  checkPrintability,
  nearVaseSpirale,
  OVERHANG_SLOPE,
  PLATE_MM,
} from "./guards";
import {
  HERO_CONFIG,
  HERO_PALETTE_KEYS,
  HERO_PATTERN_KEYS,
  LAVAUX_PRESETS,
  heroVariant,
  surpriseLavaux,
} from "./presets";
import { clampLavaux, gradinsDepthMax, LAVAUX_RANGES } from "./schemas";
import { computeStats } from "./stats";
import type { LavauxConfig, Printability } from "./types";

type Issues = Extract<Printability, { issues: unknown }>["issues"];
const issuesOf = (p: Printability): Issues =>
  p.status === "ok" ? [] : p.issues;
const codesOf = (p: Printability) => issuesOf(p).map((i) => i.code);

function withPattern(
  pattern: LavauxConfig["pattern"],
  extra: Partial<LavauxConfig> = {},
) {
  return { ...HERO_CONFIG, pattern, ...extra } as LavauxConfig;
}

describe("nearVaseSpirale", () => {
  const spirale = withPattern(
    { kind: "nervures", count: 40, depth: 1.2, twistDeg: 120 },
    { neck: 0.5 },
  );

  it("vrai pour « nervures 40, torsion 120°, col 0,5 » (le Vase spirale d'Ian)", () => {
    expect(nearVaseSpirale(spirale)).toBe(true);
    const printable = checkLavaux(spirale);
    expect(printable.status).toBe("error");
    expect(codesOf(printable)).toContain("near-vase-spirale");
    expect(computeStats(spirale).printable.status).toBe("error");
  });

  it("bornes de la règle : 28 ≤ nervures ≤ 56, |torsion| ≥ 45°, col ≤ 0,6", () => {
    const at = (count: number, twistDeg: number, neck: number) =>
      nearVaseSpirale(
        withPattern(
          { kind: "nervures", count, depth: 1.2, twistDeg },
          { neck },
        ),
      );
    expect(at(28, 45, 0.6)).toBe(true);
    expect(at(27, 120, 0.5)).toBe(false);
    expect(at(40, 40, 0.5)).toBe(false);
    expect(at(40, -120, 0.5)).toBe(true); // torsion dans l'autre sens
    expect(at(40, 120, 0.61)).toBe(false);
    expect(at(48, 120, 0.5)).toBe(true);
  });

  it("jamais vrai hors des nervures ni pour un autre objet", () => {
    expect(nearVaseSpirale(HERO_CONFIG)).toBe(false);
    expect(
      nearVaseSpirale(
        withPattern({
          kind: "vagues",
          wavelength: 14,
          amplitude: 1.2,
          lobes: 5,
        }),
      ),
    ).toBe(false);
  });

  it("faux pour HERO_CONFIG, les 12 variantes du héros et tous les préréglages", () => {
    expect(nearVaseSpirale(HERO_CONFIG)).toBe(false);
    let variants = 0;
    for (const palette of HERO_PALETTE_KEYS) {
      for (const pattern of HERO_PATTERN_KEYS) {
        expect(nearVaseSpirale(heroVariant(palette, pattern))).toBe(false);
        variants++;
      }
    }
    expect(variants).toBe(12);
    for (const preset of LAVAUX_PRESETS)
      expect(nearVaseSpirale(preset.config)).toBe(false);
  });

  it("faux pour 1 000 tirages « Surprenez-moi »", () => {
    for (let seed = 1; seed <= 1000; seed++) {
      const config = surpriseLavaux(seed);
      expect(nearVaseSpirale(config), `graine ${seed}`).toBe(false);
    }
  });

  it("le col est borné à 0,5 et il n'existe pas de profil « bouteille » par construction", () => {
    expect(LAVAUX_RANGES.neck.min).toBe(0.5);
    const clamped = clampLavaux({ ...HERO_CONFIG, neck: 0.1 });
    expect(clamped.neck).toBe(0.5);
    const profiles = LAVAUX_PRESETS.map((p) => p.config.profile);
    expect(profiles.every((p) => p !== ("bouteille" as string))).toBe(true);
  });
});

describe("imprimabilité du héros et des préréglages", () => {
  it("le héros est imprimable, sans avertissement", () => {
    expect(checkLavaux(HERO_CONFIG)).toEqual({ status: "ok" });
    expect(checkPrintability(HERO_CONFIG)).toEqual({ status: "ok" });
  });

  it("ses 12 variantes et les préréglages ne sont jamais bloqués (pas d'erreur)", () => {
    for (const palette of HERO_PALETTE_KEYS) {
      for (const pattern of HERO_PATTERN_KEYS) {
        const c = heroVariant(palette, pattern);
        expect(checkLavaux(c).status, `${palette}/${pattern}`).toBe("ok");
      }
    }
    for (const p of LAVAUX_PRESETS) {
      expect(checkLavaux(p.config).status, p.id).toBe("ok");
    }
  });

  it("la pente extérieure maximale du héros reste sous le seuil de 45° (+6 %)", () => {
    const a = analyzeLavaux(HERO_CONFIG);
    expect(a.maxOutwardSlope).toBeLessThan(OVERHANG_SLOPE * 1.06);
    expect(a.maxOutwardSlope).toBeGreaterThan(0.5);
  });
});

describe("surplomb", () => {
  it("un galbe extrême donne un surplomb avec une correction qui le résout", () => {
    // Cône lisse très évasé : dr/dz énorme sur une hauteur courte.
    const steep = clampLavaux({
      ...HERO_CONFIG,
      h: 80,
      d: 140,
      profile: "tulipe",
      belly: 1,
      neck: 1,
      lip: 0.3,
      pattern: { kind: "lisse" },
    });
    const result = checkLavaux(steep);
    const overhang = issuesOf(result).find((i) => i.code === "overhang");
    expect(overhang, JSON.stringify(result)).toBeTruthy();
    expect(["warn", "error"]).toContain(result.status);
    if (overhang?.fix) {
      const fixed = clampLavaux({ ...steep, ...overhang.fix } as LavauxConfig);
      expect(analyzeLavaux(fixed).maxOutwardSlope).toBeLessThanOrEqual(
        OVERHANG_SLOPE + 1e-9,
      );
    }
  });

  it("un motif trop profond sur des vagues courtes est signalé puis corrigé", () => {
    const wavy = withPattern({
      kind: "vagues",
      wavelength: 6,
      amplitude: 3,
      lobes: 12,
    });
    const r = checkLavaux(wavy);
    expect(codesOf(r)).toContain("pattern-coupling");
    const fix = issuesOf(r).find((i) => i.code === "pattern-coupling")
      ?.fix as Partial<LavauxConfig>;
    expect(checkLavaux({ ...wavy, ...fix } as LavauxConfig).status).not.toBe(
      "error",
    );
    expect(
      issuesOf(checkLavaux({ ...wavy, ...fix } as LavauxConfig)).map(
        (i) => i.code,
      ),
    ).not.toContain("pattern-coupling");
  });
});

describe("pied, plateau, bandes, couplage des gradins", () => {
  it("pied trop étroit : avertissement avec la correction « cylindre »", () => {
    const narrow = clampLavaux({
      ...HERO_CONFIG,
      d: 50,
      profile: "amphore",
      belly: 1,
      pattern: { kind: "lisse" },
    });
    const r = checkLavaux(narrow);
    const issue = issuesOf(r).find((i) => i.code === "base-narrow");
    expect(issue).toBeTruthy();
    expect(issue?.fix).toEqual({ profile: "cylindre" });
  });

  it("plateau : > 250 mm est refusé (objet hors bornes seulement)", () => {
    const tall = {
      ...HERO_CONFIG,
      h: 260,
      bands: [{ filament: "encre", toMm: 260 }],
    } as LavauxConfig;
    const r = checkLavaux(tall);
    expect(r.status).toBe("error");
    expect(codesOf(r)).toContain("plate");
    expect(issuesOf(r).find((i) => i.code === "plate")?.fix).toMatchObject({
      h: PLATE_MM,
    });
    // Dans les plages du Studio, le plateau n'est jamais dépassé (h ≤ 240, d ≤ 140).
    expect(LAVAUX_RANGES.h.max).toBeLessThanOrEqual(PLATE_MM);
    expect(LAVAUX_RANGES.d.max).toBeLessThanOrEqual(PLATE_MM);
  });

  it("bande de moins de 2 mm : avertissement et fusion avec la voisine", () => {
    const thin = {
      ...HERO_CONFIG,
      bands: [
        { filament: "bleu-leman", toMm: 1 },
        { filament: "vert-lavaux", toMm: 100 },
        { filament: "blanc-neve", toMm: 150 },
      ],
    } as LavauxConfig;
    const r = checkLavaux(thin);
    expect(r.status).toBe("warn");
    const issue = issuesOf(r).find((i) => i.code === "band-thin")!;
    expect(issue.value).toBe(1);
    const merged = (issue.fix as Partial<LavauxConfig>).bands!;
    expect(merged).toHaveLength(2);
    expect(merged[merged.length - 1].toMm).toBe(150);
    expect(checkLavaux({ ...thin, bands: merged }).status).toBe("ok");
  });

  it("gradins : profondeur ≤ 0,5 × pas et ≤ paroi − 0,2 mm, bornée au bornage", () => {
    expect(gradinsDepthMax(5, 1.6)).toBeCloseTo(1.4, 9); // le héros passe
    expect(gradinsDepthMax(2, 2.4)).toBeCloseTo(1, 9);
    expect(gradinsDepthMax(12, 1.2)).toBeCloseTo(1, 9);
    expect(gradinsDepthMax(12, 2.4)).toBeCloseTo(2.2, 9);
    const deep = withPattern(
      { kind: "gradins", step: 10, depth: 2.6 },
      { wall: 1.6 },
    );
    const r = checkLavaux(deep);
    expect(codesOf(r)).toContain("pattern-coupling");
    // Gradin aussi profond que la paroi : étages disconnectés, erreur.
    expect(
      checkLavaux(withPattern({ kind: "gradins", step: 10, depth: 1.6 }))
        .status,
    ).toBe("error");
    const clamped = clampLavaux(deep);
    expect(clamped.pattern).toEqual({ kind: "gradins", step: 10, depth: 1.4 });
    expect(checkLavaux(clamped).status).toBe("ok");
  });

  it("un gradin aussi profond que la paroi donnait une arête à 4 triangles (non-régression)", () => {
    const pinched = {
      ...HERO_CONFIG,
      pattern: { kind: "gradins", step: 3.8, depth: 1.6 },
    } as LavauxConfig;
    // Bornage : le cas pathologique n'atteint jamais le maillage par l'interface.
    const safe = clampLavaux(pinched);
    expect((safe.pattern as { depth: number }).depth).toBeLessThan(1.6);
    expect(buildLavaux(safe, { lod: "export" }).triangles).toBeGreaterThan(0);
  });
});

describe("« Surprenez-moi »", () => {
  it("déterministe par graine, imprimable, dans les plages", () => {
    for (let seed = 1; seed <= 60; seed++) {
      const a = surpriseLavaux(seed);
      expect(surpriseLavaux(seed)).toEqual(a);
      expect(checkLavaux(a).status, `graine ${seed}`).toBe("ok");
      expect(a.h).toBeGreaterThanOrEqual(LAVAUX_RANGES.h.min);
      expect(a.h).toBeLessThanOrEqual(LAVAUX_RANGES.h.max);
      expect(a.neck).toBeGreaterThanOrEqual(0.5);
      expect(a.bands[a.bands.length - 1].toMm).toBe(a.h);
    }
  });

  it("varie : des motifs, profils et palettes différents", () => {
    const patterns = new Set<string>();
    const profiles = new Set<string>();
    const bandCounts = new Set<number>();
    for (let seed = 1; seed <= 200; seed++) {
      const c = surpriseLavaux(seed);
      patterns.add(c.pattern.kind);
      profiles.add(c.profile);
      bandCounts.add(c.bands.length);
    }
    expect(patterns.size).toBeGreaterThanOrEqual(4);
    expect(profiles.size).toBe(5);
    expect(bandCounts.size).toBeGreaterThanOrEqual(3);
  });

  it("teintes voisines contrastées : jamais deux bandes contiguës du même filament", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const { bands } = surpriseLavaux(seed);
      for (let k = 1; k < bands.length; k++) {
        expect(bands[k].filament, `graine ${seed}`).not.toBe(
          bands[k - 1].filament,
        );
      }
    }
  });
});
