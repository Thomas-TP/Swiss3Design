// Codec d'URL du Studio (brief « Strates », §6.8) : fragment `#c=v1.…`,
// paramètres GET, schémas zod, bornage. Aucune clé de texte acceptée.
import { describe, expect, it } from "vitest";
import { mulberry32 } from "./kernel/rng";
import {
  BORNE_DEFAULT,
  CARTOUCHE_DEFAULT,
  HERO_CONFIG,
  RELIEF_DEFAULT,
  LAVAUX_PRESETS,
  defaultConfig,
  heroVariant,
} from "./presets";
import {
  clampConfig,
  clampLavaux,
  clampRange,
  LAVAUX_RANGES,
  normalizeBands,
  parseConfig,
} from "./schemas";
import { randomLavaux } from "./testing";
import {
  MAX_FRAGMENT_LENGTH,
  TEXT_KEYS,
  configFragment,
  decodeConfig,
  decodeFragment,
  decodeSearchParams,
  type DecodeResult,
  encodeConfig,
  encodeSearchParams,
  machineLine,
  toShortKeys,
} from "./url-state";
import type { LavauxConfig, StudioConfig, StudioObjectId } from "./types";

const b64 = (obj: unknown) =>
  `v1.${Buffer.from(JSON.stringify(obj)).toString("base64url")}`;

/** Le vase d'un décodage réussi ; lève (avec le détail) si le décodage a échoué. */
function lavauxOf(result: DecodeResult, label: string): LavauxConfig {
  if (!result.ok || result.config.object !== "lavaux") {
    throw new Error(`${label} : décodage en échec ${JSON.stringify(result)}`);
  }
  return result.config;
}

const DEFAULTS: Record<StudioObjectId, StudioConfig> = {
  lavaux: HERO_CONFIG,
  cartouche: CARTOUCHE_DEFAULT,
  relief: RELIEF_DEFAULT,
  borne: BORNE_DEFAULT,
};

describe("fragment : aller-retour", () => {
  it("le héros : clés courtes du brief, ≤ 600 caractères", () => {
    const short = toShortKeys(HERO_CONFIG);
    expect(short).toMatchObject({
      h: 150,
      d: 96,
      p: "galet",
      b: 0.5,
      n: 0.72,
      l: 0.08,
      m: "gradins",
      gs: 5,
      gd: 1.4,
      w: 1.6,
      bd: [
        ["bleu-leman", 42],
        ["vert-lavaux", 108],
        ["blanc-neve", 150],
      ],
    });
    const fragment = configFragment(HERO_CONFIG);
    expect(fragment.startsWith("#c=v1.")).toBe(true);
    expect(fragment.length).toBeLessThanOrEqual(MAX_FRAGMENT_LENGTH);
    const back = decodeFragment("lavaux", fragment, HERO_CONFIG);
    expect(back).toEqual({ ok: true, config: HERO_CONFIG });
  });

  it("les 4 objets par défaut et tous les préréglages font l'aller-retour", () => {
    for (const object of ["lavaux", "cartouche", "relief", "borne"] as const) {
      const config = defaultConfig(object);
      const decoded = decodeConfig(
        object,
        encodeConfig(config),
        DEFAULTS[object],
      );
      expect(decoded, `${object}`).toEqual({ ok: true, config });
    }
    for (const p of LAVAUX_PRESETS) {
      expect(
        decodeConfig("lavaux", encodeConfig(p.config), HERO_CONFIG),
      ).toEqual({
        ok: true,
        config: p.config,
      });
    }
  });

  it("200 vases aléatoires : aller-retour stable, fragment ≤ 600 caractères", () => {
    const rng = mulberry32(31415);
    for (let i = 0; i < 200; i++) {
      const config = randomLavaux(rng);
      const value = encodeConfig(config);
      expect(value.length, `#${i}`).toBeLessThanOrEqual(MAX_FRAGMENT_LENGTH);
      const decoded = decodeConfig("lavaux", value, HERO_CONFIG);
      const back = lavauxOf(decoded, `#${i}`);
      expect(back).toEqual(config);
      // Stable : encoder ce qu'on vient de décoder redonne les mêmes octets.
      expect(encodeConfig(back)).toBe(value);
    }
  });

  it("toutes les familles de motif, quatre bandes comprises, tiennent dans 600 caractères", () => {
    const worst = clampLavaux({
      ...HERO_CONFIG,
      pattern: { kind: "voronoi", cells: 120, relief: 2.5, seed: 9999 },
      bands: [
        { filament: "rouge-signal", toMm: 40.2 },
        { filament: "gris-molasse", toMm: 80.4 },
        { filament: "glacier", toMm: 120.6 },
        { filament: "ambre", toMm: 150 },
      ],
    });
    expect(encodeConfig(worst).length).toBeLessThan(MAX_FRAGMENT_LENGTH);
  });

  it("les clés absentes prennent les valeurs par défaut de l'objet", () => {
    const partial = decodeConfig(
      "lavaux",
      b64({ h: 200, m: "lisse" }),
      HERO_CONFIG,
    );
    const config = lavauxOf(partial, "clés absentes");
    expect(config.h).toBe(200);
    expect(config.pattern).toEqual({ kind: "lisse" });
    expect(config.profile).toBe("galet");
    // Les bandes du défaut suivent la nouvelle hauteur (dernière = h).
    expect(config.bands[config.bands.length - 1].toMm).toBe(200);
  });
});

describe("fragment : rejets", () => {
  const decode = (value: string, object: StudioObjectId = "lavaux") =>
    decodeConfig(object, value, DEFAULTS[object]);

  it("clés inconnues refusées", () => {
    expect(decode(b64({ h: 150, zz: 1 }))).toMatchObject({
      ok: false,
      error: "unknown-key",
    });
    // Une clé d'un autre objet n'est pas acceptée non plus.
    expect(decode(b64({ t: 1.6 }))).toMatchObject({
      ok: false,
      error: "unknown-key",
    });
    // Une clé d'une autre famille de motif : refusée en mode strict.
    expect(decode(b64({ m: "gradins", rn: 12 }))).toMatchObject({
      ok: false,
      error: "unknown-key",
    });
  });

  it("AUCUNE clé de texte acceptée, pour aucun objet", () => {
    for (const key of TEXT_KEYS) {
      for (const object of [
        "lavaux",
        "cartouche",
        "relief",
        "borne",
      ] as const) {
        const result = decode(b64({ [key]: "Léa Dubois" }), object);
        expect(result, `${object}/${key}`).toMatchObject({
          ok: false,
          error: "text-key",
        });
      }
      const get = decodeSearchParams(
        "lavaux",
        new URLSearchParams({ [key]: "Léa" }),
        HERO_CONFIG,
      );
      expect(get, `${key}`).toMatchObject({ ok: false, error: "text-key" });
    }
    // Les clés de texte suivent StudioTexts : name, role, line1, line2, peak, text.
    expect([...TEXT_KEYS].sort()).toEqual([
      "line1",
      "line2",
      "name",
      "peak",
      "role",
      "text",
    ]);
  });

  it("aucun texte ne sort jamais d'une configuration encodée", () => {
    for (const object of ["lavaux", "cartouche", "relief", "borne"] as const) {
      const encoded = encodeConfig(defaultConfig(object));
      const json = Buffer.from(encoded.slice(3), "base64url").toString();
      for (const key of TEXT_KEYS) expect(json).not.toContain(`"${key}"`);
      expect(json).not.toContain("Léa");
    }
  });

  it("version, base64, JSON, taille, valeurs hors plage", () => {
    expect(decode("")).toMatchObject({ ok: false, error: "empty" });
    expect(decode("v2.e30")).toMatchObject({ ok: false, error: "version" });
    expect(decode("nodot")).toMatchObject({ ok: false, error: "version" });
    expect(decode("v1.%%%")).toMatchObject({ ok: false, error: "base64" });
    expect(
      decode(`v1.${Buffer.from("{oups").toString("base64url")}`),
    ).toMatchObject({
      ok: false,
      error: "json",
    });
    expect(decode(b64([1, 2]))).toMatchObject({
      ok: false,
      error: "not-object",
    });
    expect(decode(`v1.${"A".repeat(MAX_FRAGMENT_LENGTH)}`)).toMatchObject({
      ok: false,
      error: "too-long",
    });
    expect(decode(b64({ h: 9999 }))).toMatchObject({
      ok: false,
      error: "invalid",
    });
    expect(decode(b64({ p: "bouteille" }))).toMatchObject({
      ok: false,
      error: "invalid",
    });
    expect(decode(b64({ bd: [["inconnu", 150]] }))).toMatchObject({
      ok: false,
      error: "invalid",
    });
    expect(
      decode(
        b64({
          bd: [
            ["encre", 100],
            ["blanc-neve", 80],
          ],
        }),
      ),
    ).toMatchObject({
      ok: false,
      error: "invalid",
    });
    expect(decode(b64({ m: "nervures", rn: 3.5 }))).toMatchObject({
      ok: false,
      error: "invalid",
    });
  });

  it("un fragment sans c ni version se décode comme vide, avec ou sans #", () => {
    expect(decodeFragment("lavaux", "", HERO_CONFIG)).toMatchObject({
      ok: false,
      error: "empty",
    });
    expect(decodeFragment("lavaux", "#x=1", HERO_CONFIG)).toMatchObject({
      ok: false,
      error: "empty",
    });
    const hash = configFragment(HERO_CONFIG);
    expect(
      decodeFragment("lavaux", hash.slice(1) + "&autre=1", HERO_CONFIG),
    ).toMatchObject({
      ok: true,
    });
  });
});

describe("paramètres GET (formulaire sans JavaScript)", () => {
  it("aller-retour avec les bandes en bd=bleu-leman:42,…", () => {
    const qs = encodeSearchParams(HERO_CONFIG);
    expect(qs).toContain(
      "bd=bleu-leman%3A42%2Cvert-lavaux%3A108%2Cblanc-neve%3A150",
    );
    const back = decodeSearchParams(
      "lavaux",
      new URLSearchParams(qs),
      HERO_CONFIG,
    );
    expect(back).toMatchObject({ ok: true, config: HERO_CONFIG, ignored: [] });
  });

  it("aller-retour des quatre objets et de 50 vases aléatoires", () => {
    for (const object of ["cartouche", "relief", "borne"] as const) {
      const c = defaultConfig(object);
      expect(
        decodeSearchParams(
          object,
          new URLSearchParams(encodeSearchParams(c)),
          DEFAULTS[object],
        ),
      ).toMatchObject({ ok: true, config: c });
    }
    const rng = mulberry32(2718);
    for (let i = 0; i < 50; i++) {
      const c = randomLavaux(rng);
      const r = decodeSearchParams(
        "lavaux",
        new URLSearchParams(encodeSearchParams(c)),
        HERO_CONFIG,
      );
      expect(lavauxOf(r, `#${i}`)).toEqual(c);
    }
  });

  it("les clés inconnues d'un formulaire (bouton, suivi) sont ignorées, pas fatales", () => {
    const r = decodeSearchParams(
      "lavaux",
      { h: "120", m: "lisse", submit: "Appliquer", utm_source: "x" },
      HERO_CONFIG,
    );
    expect(r).toMatchObject({ ok: true, ignored: ["submit", "utm_source"] });
    expect(lavauxOf(r, "formulaire").h).toBe(120);
  });

  it("un formulaire envoie tous ses champs : les autres familles de motif sont ignorées", () => {
    const r = decodeSearchParams(
      "lavaux",
      {
        m: "vagues",
        wl: "14",
        wa: "1.2",
        wk: "5",
        gs: "5",
        gd: "1.4",
        rn: "16",
        ra: "1.2",
        rt: "0",
      },
      HERO_CONFIG,
    );
    expect(lavauxOf(r, "autres familles").pattern).toEqual({
      kind: "vagues",
      wavelength: 14,
      amplitude: 1.2,
      lobes: 5,
    });
  });

  it("valeurs invalides refusées ; bornage des valeurs valides mais non canoniques", () => {
    expect(
      decodeSearchParams("lavaux", { h: "abc" }, HERO_CONFIG),
    ).toMatchObject({ ok: false });
    expect(
      decodeSearchParams("lavaux", { bd: "encre" }, HERO_CONFIG),
    ).toMatchObject({ ok: false });
    // Pas de 0,2 mm : 100,07 est ramené à 100.
    const r = decodeSearchParams(
      "lavaux",
      { h: "100", d: "96", n: "0.7312" },
      HERO_CONFIG,
    );
    expect(r.ok).toBe(true);
    expect(lavauxOf(r, "bornage").neck).toBe(0.73);
  });

  it("accepte des tableaux (searchParams de Next) en prenant la première valeur", () => {
    const r = decodeSearchParams("lavaux", { h: ["90", "120"] }, HERO_CONFIG);
    expect(r.ok).toBe(true);
    expect(lavauxOf(r, "tableau").h).toBe(90);
  });
});

describe("schémas et bornage", () => {
  it("parseConfig : le héros et les défauts passent, une clé en trop non", () => {
    for (const object of ["lavaux", "cartouche", "relief", "borne"] as const) {
      expect(parseConfig(object, defaultConfig(object)).ok, `${object}`).toBe(
        true,
      );
    }
    expect(
      parseConfig("lavaux", { ...HERO_CONFIG, name: "Léa" }),
    ).toMatchObject({ ok: false });
    expect(parseConfig("lavaux", { ...HERO_CONFIG, neck: 0.4 })).toMatchObject({
      ok: false,
    });
    expect(parseConfig("lavaux", { ...HERO_CONFIG, wall: 1.8 })).toMatchObject({
      ok: false,
    });
    expect(
      parseConfig("lavaux", {
        ...HERO_CONFIG,
        pattern: { kind: "gradins", step: 5, depth: 1, texte: "x" },
      }),
    ).toMatchObject({ ok: false });
    expect(
      parseConfig("cartouche", { ...CARTOUCHE_DEFAULT, nom: "Léa" }),
    ).toMatchObject({ ok: false });
  });

  it("aucun schéma n'a de champ de texte", () => {
    for (const object of ["lavaux", "cartouche", "relief", "borne"] as const) {
      const keys = Object.keys(defaultConfig(object));
      for (const k of TEXT_KEYS) expect(keys).not.toContain(k);
    }
  });

  it("clampRange : borne, ramène au pas, sans traîne de virgule flottante", () => {
    const r = LAVAUX_RANGES.neck;
    expect(clampRange(0.1, r)).toBe(0.5);
    expect(clampRange(2, r)).toBe(1);
    expect(clampRange(0.7312, r)).toBe(0.73);
    expect(clampRange(Number.NaN, r)).toBe(r.default);
    expect(
      clampRange(0.1 + 0.2, { min: 0, max: 1, step: 0.1, default: 0 }),
    ).toBe(0.3);
    expect(clampRange(3.35, LAVAUX_RANGES.gradins.step)).toBe(3.4);
  });

  it("normalizeBands : frontières à la couche, épaisseur ≥ 2 mm, 4 bandes au plus, finit à h", () => {
    const out = normalizeBands(
      [
        { filament: "encre", toMm: 0.3 },
        { filament: "rouge-signal", toMm: 50.07 },
        { filament: "ambre", toMm: 50.3 },
        { filament: "glacier", toMm: 90 },
        { filament: "blanc-neve", toMm: 100 },
      ],
      120,
    );
    expect(out).toHaveLength(4);
    expect(out[out.length - 1].toMm).toBe(120);
    let prev = 0;
    for (const b of out) {
      expect(b.toMm - prev).toBeGreaterThanOrEqual(2 - 1e-9);
      prev = b.toMm;
    }
    for (const b of out.slice(0, -1))
      expect(Math.abs(b.toMm * 5 - Math.round(b.toMm * 5))).toBeLessThan(1e-9);
    expect(normalizeBands([], 100)).toEqual([
      { filament: "blanc-neve", toMm: 100 },
    ]);
  });

  it("clampConfig est idempotent et laisse le héros inchangé", () => {
    expect(clampLavaux(HERO_CONFIG)).toEqual(HERO_CONFIG);
    const rng = mulberry32(77);
    for (let i = 0; i < 40; i++) {
      const c = randomLavaux(rng);
      expect(clampConfig(c)).toEqual(c);
    }
    for (const p of LAVAUX_PRESETS)
      expect(clampLavaux(p.config)).toEqual(p.config);
    for (const v of [
      heroVariant("uni", "vagues"),
      heroVariant("signal", "voronoi"),
    ]) {
      expect(clampLavaux(v)).toEqual(v);
    }
  });
});

describe("ligne machine du devis", () => {
  it("le héros : exactement la ligne du brief (§6.9)", () => {
    expect(machineLine(HERO_CONFIG)).toBe(
      "S3D-STUDIO v1 lavaux h=150 d=96 p=galet b=0.5 n=0.72 l=0.08 m=gradins gs=5 gd=1.4 w=1.6 bd=bleu-leman:42,vert-lavaux:108,blanc-neve:150",
    );
  });

  it("aucun texte, pas de saut de ligne, tous les objets", () => {
    for (const object of ["lavaux", "cartouche", "relief", "borne"] as const) {
      const line = machineLine(defaultConfig(object));
      expect(line.startsWith(`S3D-STUDIO v1 ${object} `)).toBe(true);
      expect(line).not.toMatch(/[\n\r]/);
      for (const key of TEXT_KEYS) expect(line).not.toContain(`${key}=`);
    }
  });
});
