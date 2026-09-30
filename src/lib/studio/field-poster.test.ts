// Posters de champ de courbes (brief « Strates », §9.3) : poids ≤ 60 Ko chacun,
// périodicité du FBM, déterminisme et FRAÎCHEUR des fichiers commités
// (`public/posters/field-*-{light,dark}.svg` = sortie du générateur).
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FIELD_ANCHORS, FIELD_SIZES } from "./field-anchors";
import {
  FIELD_COLORS,
  FIELD_IDS,
  FIELD_MAX_BYTES,
  FIELD_SPECS,
  fieldFileName,
  fieldSvg,
  generateField,
  northShoreAt,
  type Theme,
} from "./field-poster";

const POSTERS = fileURLToPath(
  new URL("../../../public/posters/", import.meta.url),
);
const THEMES: Theme[] = ["light", "dark"];
const generated = Object.fromEntries(
  FIELD_IDS.map((id) => [id, generateField(FIELD_SPECS[id])]),
) as Record<(typeof FIELD_IDS)[number], ReturnType<typeof generateField>>;

describe("posters de champ : fichiers commités", () => {
  it("les 8 fichiers existent, pèsent ≤ 60 Ko et sont à jour (sortie exacte du générateur)", () => {
    expect(FIELD_IDS.slice().sort()).toEqual([
      "404",
      "footer",
      "home",
      "leman",
    ]);
    for (const id of FIELD_IDS) {
      for (const theme of THEMES) {
        const file = join(POSTERS, fieldFileName(id, theme));
        expect(existsSync(file), `${fieldFileName(id, theme)}`).toBe(true);
        const svg = readFileSync(file, "utf8");
        expect(Buffer.byteLength(svg), ``).toBeLessThanOrEqual(FIELD_MAX_BYTES);
        expect(
          svg,
          `${fieldFileName(id, theme)} est périmé : bun scripts/gen-field-posters.ts`,
        ).toBe(fieldSvg(generated[id], theme));
        expect(svg).not.toContain("Placeholder");
      }
    }
  });

  it("viewBox, tokens de couleur par thème, aucune balise active", () => {
    for (const id of FIELD_IDS) {
      const { width, height } = FIELD_SIZES[id];
      for (const theme of THEMES) {
        const svg = fieldSvg(generated[id], theme);
        expect(svg).toContain(`viewBox="0 0 ${width} ${height}"`);
        expect(svg).toContain(`stroke="${FIELD_COLORS[theme].iso}"`);
        expect(svg).toContain(`stroke="${FIELD_COLORS[theme].index}"`);
        expect(svg).toContain('preserveAspectRatio="xMidYMid slice"');
        expect(svg).not.toMatch(/<script|<foreignObject|<image|href=/i);
      }
      // Clair et sombre ne diffèrent que par les couleurs.
      const light = fieldSvg(generated[id], "light");
      const dark = fieldSvg(generated[id], "dark")
        .replaceAll(FIELD_COLORS.dark.iso, FIELD_COLORS.light.iso)
        .replaceAll(FIELD_COLORS.dark.index, FIELD_COLORS.light.index);
      expect(dark).toBe(light);
    }
  });

  it("couleurs = jetons iso et iso-index du brief §2.1", () => {
    expect(FIELD_COLORS.light).toEqual({ iso: "#C9C1B2", index: "#9C7650" });
    expect(FIELD_COLORS.dark).toEqual({ iso: "#3A352F", index: "#8A6C4E" });
  });
});

describe("génération", () => {
  it("déterministe : deux générations donnent les mêmes octets", () => {
    for (const id of FIELD_IDS) {
      expect(fieldSvg(generateField(FIELD_SPECS[id]), "light")).toBe(
        fieldSvg(generated[id], "light"),
      );
    }
  });

  it("des isolignes ordinaires et des courbes maîtresses, toutes fermées et relatives", () => {
    for (const id of FIELD_IDS) {
      const data = generated[id];
      expect(data.rings.iso, `${id}`).toBeGreaterThan(10);
      expect(data.rings.index, `${id}`).toBeGreaterThan(2);
      expect(data.iso.match(/M/g)).toHaveLength(data.rings.iso);
      expect(data.iso.match(/z/g)).toHaveLength(data.rings.iso);
      expect(data.index.match(/z/g)).toHaveLength(data.rings.index);
    }
  });

  it("FBM périodique : footer et accueil se raccordent sans couture (u et v)", () => {
    for (const id of ["footer", "home"] as const) {
      const f = FIELD_SPECS[id].height;
      const { width, height } = FIELD_SIZES[id];
      for (let i = 0; i < 40; i++) {
        const u = (i * 0.0713) % 1;
        const v = (i * 0.1337) % 1;
        expect(f(u + 1, v, width, height), `${id}`).toBeCloseTo(
          f(u, v, width, height),
          9,
        );
        expect(f(u, v + 1, width, height), `${id}`).toBeCloseTo(
          f(u, v, width, height),
          9,
        );
      }
    }
  });
});

describe("points d'ancrage", () => {
  it("dans le cadre, en fractions du viewBox", () => {
    const all = [
      FIELD_ANCHORS["404"].here,
      FIELD_ANCHORS.leman.gland,
      FIELD_ANCHORS.leman.pully,
    ];
    for (const p of all) {
      expect(p.u).toBeGreaterThan(0.05);
      expect(p.u).toBeLessThan(0.95);
      expect(p.v).toBeGreaterThan(0.05);
      expect(p.v).toBeLessThan(0.95);
    }
  });

  it("Gland et Pully sont sur la rive nord du lac ; Gland à l'ouest et plus au sud que Pully", () => {
    const aspect = FIELD_SIZES.leman.width / FIELD_SIZES.leman.height;
    for (const city of [FIELD_ANCHORS.leman.gland, FIELD_ANCHORS.leman.pully]) {
      const [, v] = northShoreAt(city.u, aspect);
      expect(Math.abs(city.v - v)).toBeLessThan(0.002);
    }
    expect(FIELD_ANCHORS.leman.gland.u).toBeLessThan(
      FIELD_ANCHORS.leman.pully.u,
    );
    expect(FIELD_ANCHORS.leman.gland.v).toBeGreaterThan(
      FIELD_ANCHORS.leman.pully.v,
    );
  });

  it("404 : le point « Vous êtes ici » est le sommet du champ", () => {
    const { width, height } = FIELD_SIZES["404"];
    const f = FIELD_SPECS["404"].height;
    const here = FIELD_ANCHORS["404"].here;
    const atHere = f(here.u, here.v, width, height);
    let higher = 0;
    for (let i = 0; i < 60; i++) {
      for (let j = 0; j < 40; j++) {
        if (f(i / 60, j / 40, width, height) > atHere + 1e-9) higher++;
      }
    }
    // Quasi sommet : au plus 1 % de la carte le dépasse (le bruit peut relever un coin).
    expect(higher).toBeLessThan(24);
  });
});
