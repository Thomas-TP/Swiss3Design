import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  FILAMENTS,
  FILAMENT_IDS,
  edgeShade,
  filamentHex,
  filamentInfo,
  hexToRgb,
  shade,
} from "./filaments";
import {
  elevationToSvg,
  heroPoster,
  lavauxElevation,
  posterToSvg,
} from "./poster";
import { cartoucheTopView, borneTopView, topViewToSvg } from "./poster-flat";
import { montagneElevation } from "./poster-montagne";
import {
  BORNE_DEFAULT,
  BORNE_PRESETS,
  CARTOUCHE_DEFAULT,
  CARTOUCHE_PRESETS,
  HERO_CONFIG,
  MONTAGNE_DEFAULT,
} from "./presets";
import type { FilamentId } from "./types";

// Décision du propriétaire du 15.10.2026 : les couleurs proposées sont EXACTEMENT
// les hex officiels de la gamme Bambu Lab PLA Matte (PDF « PLA Matte Hex Code »),
// au caractère près, et affichées sans transformation (ni tint, ni shade, ni
// transparence, ni filtre) : pastilles, puces, aplats des posters, couleur de
// base du matériau 3D.

const BAMBU: Record<FilamentId, [string, string, string]> = {
  "blanc-neve": ["#FFFFFF", "Ivory White", "11100"],
  "gris-molasse": ["#9B9EA0", "Ash Gray", "11102"],
  encre: ["#000000", "Charcoal", "11101"],
  "vert-foret": ["#68724D", "Dark Green", "11501"],
  "bleu-leman": ["#0078BF", "Marine Blue", "11600"],
  glacier: ["#A3D8E1", "Ice Blue", "11601"],
  gres: ["#D3B7A7", "Latte Brown", "11800"],
  "terre-cuite": ["#B15533", "Terracotta", "11203"],
  "rouge-signal": ["#DE4343", "Scarlet Red", "11200"],
  "rose-alpes": ["#E8AFCF", "Sakura Pink", "11201"],
};

describe("FILAMENTS : les dix hex officiels Bambu Lab PLA Matte, au caractère près", () => {
  it("contient exactement les dix filaments, dans l'ordre, avec leur hex", () => {
    expect(FILAMENTS.map((f) => [f.id, f.hex])).toEqual(
      Object.entries(BAMBU).map(([id, [hex]]) => [id, hex]),
    );
    expect(FILAMENT_IDS).toHaveLength(10);
  });

  it("chaque hex est écrit en #RRGGBB majuscules, tel que publié", () => {
    for (const f of FILAMENTS) expect(f.hex).toMatch(/^#[0-9A-F]{6}$/);
  });

  it("porte la marque, la gamme, le nom officiel et le code produit (affichés à l'atelier)", () => {
    for (const f of FILAMENTS) {
      expect(f.brand).toBe("Bambu Lab");
      expect(f.range).toBe("PLA Matte");
      expect(f.officialName).toBe(BAMBU[f.id][1]);
      expect(f.productCode).toBe(BAMBU[f.id][2]);
    }
  });

  it("filamentHex rend l'hex du tableau, sans transformation", () => {
    for (const id of FILAMENT_IDS) expect(filamentHex(id)).toBe(BAMBU[id][0]);
    expect(filamentInfo("encre").hex).toBe("#000000");
  });
});

const COMPONENTS = [
  "src/components/studio/swatch-radio.tsx",
  "src/components/studio/band-editor.tsx",
  "src/components/studio/scene-panel.tsx",
  "src/components/home/hero-controls.tsx",
  "src/components/home/map-body.tsx",
  "src/components/studio/line-summary.ts",
  "src/app/[locale]/cart/studio-line.tsx",
];

describe("pastilles et puces : filamentHex() sans transformation", () => {
  const root = new URL("../../../", import.meta.url);
  const read = (path: string) => readFileSync(new URL(path, root), "utf8");

  it("aucun composant de pastille n'importe ni n'appelle tint, shade ou hexToRgb", () => {
    const offenders = COMPONENTS.filter((path) =>
      /\b(tint|shade|hexToRgb)\b/.test(read(path)),
    );
    expect(offenders).toEqual([]);
  });

  it("les pastilles écrivent filamentHex(…) comme couleur de fond, directement", () => {
    const silent = COMPONENTS.filter(
      (path) =>
        path.endsWith(".tsx") && !/filamentHex\(|hex\b/.test(read(path)),
    );
    expect(silent).toEqual([]);
    // Les cinq composants qui dessinent une couleur de filament le font par l'hex brut.
    expect(read("src/components/studio/swatch-radio.tsx")).toContain(
      "backgroundColor: filamentHex(id)",
    );
    expect(read("src/components/studio/band-editor.tsx")).toContain(
      "backgroundColor: filamentHex(band.filament)",
    );
    expect(read("src/components/studio/scene-panel.tsx")).toContain(
      "backgroundColor: filamentHex(band.filament)",
    );
    expect(read("src/components/home/hero-controls.tsx")).toContain(
      "backgroundColor: filamentHex(band.filament)",
    );
    expect(read("src/app/[locale]/cart/studio-line.tsx")).toContain(
      "backgroundColor: color.hex",
    );
  });
});

describe("posters SVG : les aplats de bande sont l'hex exact", () => {
  it("vase : chaque strate, et la face haute d'un bloc éclaté, sont à l'hex exact", () => {
    for (const id of FILAMENT_IDS) {
      const config = {
        ...HERO_CONFIG,
        bands: [{ filament: id, toMm: HERO_CONFIG.h }],
      };
      const final = heroPoster(config, "final");
      expect(final.layers?.[0].fill).toBe(filamentHex(id));
      expect(posterToSvg(final)).toContain(filamentHex(id));
      const exploded = heroPoster(config, "exploded");
      expect(exploded.layers?.[0].fill).toBe(filamentHex(id));
      // La face haute n'est plus éclaircie : la teinte du bloc, exactement.
      expect(exploded.layers?.[0].cap?.topFill).toBe(filamentHex(id));
    }
  });

  it("élévations (vase, Montagne) : les bandes portent l'hex exact", () => {
    for (const id of FILAMENT_IDS) {
      const vase = lavauxElevation({
        ...HERO_CONFIG,
        bands: [{ filament: id, toMm: HERO_CONFIG.h }],
      });
      expect(vase.bands.map((b) => b.hex)).toEqual([filamentHex(id)]);
      expect(elevationToSvg(vase)).toContain(filamentHex(id));
    }
    const mont = montagneElevation(MONTAGNE_DEFAULT);
    expect(mont.bands.map((b) => b.hex)).toEqual(
      MONTAGNE_DEFAULT.bands.map((b) => filamentHex(b.filament)),
    );
  });

  it("vues de dessus (Cartouche, Borne) : plaque et encre à l'hex exact", () => {
    for (const id of FILAMENT_IDS) {
      const card = cartoucheTopView(
        { ...CARTOUCHE_DEFAULT, plate: id },
        { name: "Léa" },
      );
      expect(card.layers.find((l) => l.role === "plate")?.fill).toBe(
        filamentHex(id),
      );
      const holder = borneTopView(
        { ...BORNE_DEFAULT, base: id },
        { text: "Léa" },
      );
      expect(holder.layers.find((l) => l.role === "plate")?.fill).toBe(
        filamentHex(id),
      );
      expect(topViewToSvg(card)).toContain(filamentHex(id));
    }
  });
});

// Contraste WCAG (luminance relative sRGB) : un texte en relief ou gravé doit se
// lire sur sa plaque. Le blanc sur le gris Bambu (#9B9EA0) ne ferait que 2,7:1.
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = hexToRgb(hex).map((c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("lisibilité : plaque et encre des préréglages", () => {
  it("chaque préréglage de Cartouche et de Borne contraste au moins 3:1", () => {
    for (const preset of CARTOUCHE_PRESETS) {
      const { plate, ink } = preset.config;
      expect(contrast(filamentHex(plate), filamentHex(ink))).toBeGreaterThan(3);
    }
    for (const preset of BORNE_PRESETS) {
      const { base, ink } = preset.config;
      expect(contrast(filamentHex(base), filamentHex(ink))).toBeGreaterThan(3);
    }
  });
});

describe("edgeShade : le filet d'une strate reste visible, même sur l'encre noire", () => {
  it("assombrit une teinte claire, éclaircit une teinte très sombre", () => {
    expect(edgeShade("#FFFFFF", 0.38)).toBe(shade("#FFFFFF", 0.38));
    const ink = edgeShade("#000000", 0.38);
    expect(ink).not.toBe("#000000");
    expect(hexToRgb(ink)[0]).toBeLessThan(0x40);
  });
});
