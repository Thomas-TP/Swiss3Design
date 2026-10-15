import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  FILAMENTS,
  FILAMENT_IDS,
  filamentHex,
  filamentInfo,
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
  CARTOUCHE_DEFAULT,
  HERO_CONFIG,
  MONTAGNE_DEFAULT,
} from "./presets";
import type { FilamentId } from "./types";

// Décision du propriétaire du 14.10.2026 : les couleurs proposées sont EXACTEMENT
// les hex officiels de la gamme Polymaker Panchroma Matte (wiki Polymaker, « HEX
// Codes and Transmission Distances »), au caractère près, et affichées sans
// transformation (ni tint, ni shade, ni transparence, ni filtre) : pastilles,
// puces, aplats des posters, couleur de base du matériau 3D.

const POLYMAKER: Record<FilamentId, [string, string]> = {
  "blanc-neve": ["#F4EFEB", "Matte Cotton White"],
  encre: ["#2F2E30", "Matte Charcoal Black"],
  "rouge-signal": ["#ED2F2E", "Matte Lava Red"],
  "bleu-leman": ["#0163A6", "Matte Sapphire Blue"],
  "vert-lavaux": ["#5F6244", "Matte Army Dark Green"],
  "gris-molasse": ["#8A8C94", "Matte Fossil Grey"],
  ambre: ["#F88B17", "Matte Sunrise Orange"],
  glacier: ["#A4D0DF", "Matte Pastel Ice"],
};

describe("FILAMENTS : les huit hex officiels Polymaker, au caractère près", () => {
  it("contient exactement les huit filaments, dans l'ordre, avec leur hex", () => {
    expect(FILAMENTS.map((f) => [f.id, f.hex])).toEqual(
      Object.entries(POLYMAKER).map(([id, [hex]]) => [id, hex]),
    );
    expect(FILAMENT_IDS).toHaveLength(8);
  });

  it("chaque hex est écrit en #RRGGBB majuscules, tel que publié", () => {
    for (const f of FILAMENTS) expect(f.hex).toMatch(/^#[0-9A-F]{6}$/);
  });

  it("porte la marque, la gamme et le nom officiel de la bobine (affichés à l'atelier)", () => {
    for (const f of FILAMENTS) {
      expect(f.brand).toBe("Polymaker");
      expect(f.range).toBe("Panchroma Matte");
      expect(f.officialName).toBe(POLYMAKER[f.id][1]);
    }
  });

  it("filamentHex rend l'hex du tableau, sans transformation", () => {
    for (const id of FILAMENT_IDS)
      expect(filamentHex(id)).toBe(POLYMAKER[id][0]);
    expect(filamentInfo("encre").hex).toBe("#2F2E30");
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
