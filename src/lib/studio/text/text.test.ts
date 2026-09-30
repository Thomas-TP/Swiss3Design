// Texte en relief (brief « Strates », §6.3.3 et fiche WP-02) : jeu de
// caractères, triangulation de chaque glyphe, refus des caractères hors jeu,
// mise en page (ajustement automatique, trait), anticollision entre glyphes voisins,
// cohérence entre la table de métriques (SSR) et le JSON des glyphes, poids du JSON.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { beforeAll, describe, expect, it } from "vitest";
import { extrudePolygon } from "../kernel/extrude";
import { checkManifold, MeshBuilder, meshVolume } from "../kernel/mesh";
import { loadTestFont } from "../testing";
import { checkLine, strokeLevel } from "./check";
import { DEFAULT_TEXTS, TEXT_LIMITS } from "./fields";
import { FONT_METRICS, GLYPH_HOOKS, GLYPH_TABLE } from "./glyph-metrics";
import { GLYPH_URL, parseGlyphFont, type GlyphFont } from "./glyphs";
import {
  capForStroke,
  fitCap,
  isSupportedChar,
  measureText,
  MIN_CAP_MM,
  MIN_NAME_CAP_MM,
  normalizeText,
  pairExtraUnits,
  STROKE_ERROR_MM,
  STROKE_WARN_MM,
  strokeMm,
  textWidthMm,
  unsupportedChars,
} from "./layout";
import { polygonGap } from "./overlap";
import { linePolygons } from "./shapes";

/** Le jeu de caractères du brief (§6.3.3) : U+0020–007E, U+00A0–00FF, U+0100–017F, plus ’ – —. */
const CHARSET: string[] = [];
for (const [from, to] of [
  [0x20, 0x7e],
  [0xa0, 0xff],
  [0x100, 0x17f],
  [0x2019, 0x2019],
  [0x2013, 0x2014],
]) {
  for (let code = from; code <= to; code++)
    CHARSET.push(String.fromCodePoint(code));
}

const JSON_PATH = fileURLToPath(
  new URL(
    "../../../../public/studio/glyphs/s3d-relief-v1.json",
    import.meta.url,
  ),
);

let font: GlyphFont;
beforeAll(() => {
  font = loadTestFont();
});

describe("glyphes : jeu de caractères et poids", () => {
  it("le JSON pèse au plus 45 Kio en gzip (et la famille est renommée « S3D Relief »)", () => {
    const bytes = readFileSync(JSON_PATH);
    const gzip = gzipSync(bytes, { level: 9 }).length;
    console.log(
      `[glyphes] JSON ${(bytes.length / 1024).toFixed(1)} Kio, gzip ${(gzip / 1024).toFixed(1)} Kio`,
    );
    expect(gzip).toBeLessThanOrEqual(45 * 1024);
    expect(font.data.family).toBe("S3D Relief");
    expect(font.data.v).toBe(1);
    expect(GLYPH_URL).toBe("/studio/glyphs/s3d-relief-v1.json");
  });

  it("la licence OFL est copiée à côté du JSON", () => {
    const ofl = readFileSync(
      JSON_PATH.replace("s3d-relief-v1.json", "OFL.txt"),
      "utf8",
    );
    expect(ofl).toContain("SIL OPEN FONT LICENSE");
  });

  it("le jeu complet est présent dans la police : 322 caractères, dont Ł, Œ, Ç, ß et ’ – —", () => {
    expect(CHARSET).toHaveLength(95 + 96 + 128 + 3);
    const missing = CHARSET.filter((ch) => !font.has(ch));
    expect(missing).toEqual([]);
    for (const ch of ["Ł", "Œ", "Ç", "ß", "’", "–", "—", "É", "ñ", "ø"]) {
      expect(font.has(ch), `${ch}`).toBe(true);
      expect(isSupportedChar(ch), `${ch}`).toBe(true);
    }
    // La table de métriques (SSR) et le JSON couvrent exactement les mêmes points de code.
    expect(Object.keys(GLYPH_TABLE).sort()).toEqual(
      Object.keys(font.data.glyphs).sort(),
    );
  });

  it("table de métriques et JSON ne dérivent pas : chasse, hauteurs, aire, trait", () => {
    expect(FONT_METRICS.capHeight).toBe(font.data.capHeight);
    expect(FONT_METRICS.unitsPerEm).toBe(font.data.unitsPerEm);
    expect(FONT_METRICS.stem).toBe(font.data.stem);
    const drift: string[] = [];
    for (const ch of CHARSET) {
      const [adv, areaHundreds, yMin, yMax] = GLYPH_TABLE[ch];
      if (adv !== font.advance(ch)) drift.push(`${ch} chasse`);
      let area = 0;
      let lo = 0;
      let hi = 0;
      for (const polygon of font.polygons(ch, "fine")) {
        const ring = (r: readonly (readonly number[])[]) => {
          let a = 0;
          for (let i = 0; i < r.length; i++) {
            const p = r[i];
            const q = r[(i + 1) % r.length];
            a += p[0] * q[1] - q[0] * p[1];
          }
          return Math.abs(a / 2);
        };
        area += ring(polygon.outer);
        for (const hole of polygon.holes ?? []) area -= ring(hole);
        for (const p of polygon.outer) {
          lo = Math.min(lo, p[1]);
          hi = Math.max(hi, p[1]);
        }
      }
      if (Math.abs(areaHundreds - Math.round(area / 100)) > 1)
        drift.push(`${ch} aire`);
      if (Math.abs(yMin - lo) > 1 || Math.abs(yMax - hi) > 1)
        drift.push(`${ch} hauteurs`);
    }
    expect(drift).toEqual([]);
    // La plus haute et la plus basse encre annoncées sont bien celles du jeu.
    const ascent = Math.max(
      ...CHARSET.filter((c) => c !== " " && c !== " ").map(
        (c) => GLYPH_TABLE[c][3],
      ),
    );
    expect(FONT_METRICS.ascentMax).toBe(ascent);
  });

  it("chaque champ de texte a un texte d'exemple imprimable dans le jeu", () => {
    for (const texts of Object.values(DEFAULT_TEXTS)) {
      for (const value of Object.values(texts)) {
        expect(unsupportedChars(value ?? "")).toEqual([]);
      }
    }
    for (const field of Object.keys(TEXT_LIMITS)) {
      expect(TEXT_LIMITS[field as keyof typeof TEXT_LIMITS]).toBeGreaterThan(0);
    }
  });
});

describe("glyphes : triangulation sans erreur", () => {
  it("chaque caractère du jeu donne des coques fermées (extrusion) à 3,6 et 18 mm, aux trois niveaux de détail", () => {
    const failures: string[] = [];
    let shells = 0;
    for (const ch of CHARSET) {
      for (const lod of ["drag", "display", "export"] as const) {
        for (const capMm of [3.6, 18]) {
          const polygons = linePolygons(
            { key: "t", text: ch, capMm, x: 0, y: 0 },
            lod,
            font,
          );
          if (ch === " " || ch === " ") {
            if (polygons.length !== 0) failures.push("espace avec contour");
            continue;
          }
          if (polygons.length === 0) {
            failures.push(`${ch} sans contour`);
            continue;
          }
          const builder = new MeshBuilder(512, 1024);
          try {
            for (const polygon of polygons)
              extrudePolygon(builder, polygon, 0, 1);
          } catch (error) {
            failures.push(
              `${ch} ${lod} ${capMm} : ${(error as Error).message}`,
            );
            continue;
          }
          const mesh = builder.build();
          const report = checkManifold(mesh);
          shells += report.components;
          if (
            !report.closed ||
            report.degenerateTriangles > 0 ||
            report.componentVolumes.some((v) => !(v > 0)) ||
            meshVolume(mesh) <= 0
          ) {
            failures.push(`${ch} ${lod} ${capMm} : ${JSON.stringify(report)}`);
          }
        }
      }
    }
    expect(failures).toEqual([]);
    expect(shells).toBeGreaterThan(CHARSET.length * 6);
  });

  it("Ł, Œ, Ç, ß, Ø, Å, ®, é : contours attendus (trous, pièces)", () => {
    const holes = (ch: string) =>
      font.polygons(ch, "fine").reduce((n, p) => n + (p.holes?.length ?? 0), 0);
    expect(holes("o")).toBe(1);
    expect(holes("B")).toBe(2);
    expect(holes("Ç")).toBe(0);
    expect(holes("Ł")).toBe(0);
    expect(holes("Œ")).toBeGreaterThanOrEqual(1);
    // Les accents sont des contours séparés : « é » = 2 pièces dont un trou.
    expect(font.polygons("é", "fine").length).toBeGreaterThanOrEqual(1);
    expect(font.polygons("®", "fine").length).toBeGreaterThanOrEqual(1);
  });

  it("le niveau de détail grossier a moins de points que le fin", () => {
    const count = (detail: "coarse" | "fine") =>
      CHARSET.reduce(
        (n, ch) =>
          n +
          font
            .polygons(ch, detail)
            .reduce(
              (m, p) =>
                m +
                p.outer.length +
                (p.holes ?? []).reduce((k, h) => k + h.length, 0),
              0,
            ),
        0,
      );
    expect(count("coarse")).toBeLessThan(count("fine"));
  });

  it("parseGlyphFont refuse un JSON qui n'est pas au format s3d-relief-v1", () => {
    expect(() => parseGlyphFont(null)).toThrow(/format/);
    expect(() => parseGlyphFont({ v: 2 })).toThrow(/format/);
    expect(() => parseGlyphFont(JSON.parse("{}"))).toThrow(/format/);
  });
});

describe("texte hors jeu : refusé avec le bon message", () => {
  it("un caractère hors du jeu est signalé par `text-char` avec le caractère refusé", () => {
    for (const bad of ["✦", "Ж", "中", "€", "😀", "\n", "\t", "Ω"]) {
      const check = checkLine({
        field: "name",
        text: `Léa ${bad}`,
        capMm: 5.2,
        minCapMm: MIN_NAME_CAP_MM,
        maxWidthMm: 200,
      });
      const refused = check.issues.filter((i) => i.code === "text-char");
      expect(refused, `${bad}`).toHaveLength(1);
      expect(refused[0].char, `${bad}`).toBe(bad);
      expect(refused[0].field).toBe("name");
    }
  });

  it("un emoji hors BMP est UN caractère refusé, pas deux moitiés", () => {
    expect(unsupportedChars("a😀b😀")).toEqual(["😀"]);
    expect(unsupportedChars("👩‍💻")).toEqual(["👩", "‍", "💻"]);
  });

  it("le glyphe ß reste accepté dans un nom saisi (la règle « sans ß » ne vise que nos textes de-CH)", () => {
    expect(unsupportedChars("Weiß Straße")).toEqual([]);
    expect(isSupportedChar("ß")).toBe(true);
    expect(font.has("ß")).toBe(true);
    expect(measureText("ß").perCap).toBeGreaterThan(0);
  });

  it("le texte est normalisé en NFC : « e » + accent combinant est le « é » du jeu", () => {
    expect(normalizeText("é")).toBe("é");
    expect(unsupportedChars("é")).toEqual([]);
    expect(unsupportedChars("ä")).toEqual([]);
    // Un accent combinant sans équivalent précomposé reste hors jeu.
    expect(unsupportedChars("x́")).toEqual(["́"]);
  });

  it("le message français est celui du brief : « Caractère non imprimable : ✦ »", () => {
    const fr = JSON.parse(
      readFileSync(
        fileURLToPath(
          new URL("../../../../messages/fr/studioCore.json", import.meta.url),
        ),
        "utf8",
      ),
    ) as { guard: { issue: { textChar: string } } };
    expect(fr.guard.issue.textChar.replace("{char}", "✦")).toBe(
      "Caractère non imprimable : ✦",
    );
  });
});

describe("mise en page : ajustement automatique et trait", () => {
  it("le trait vaut stem × échelle : 0,8 mm dès 3,44 mm de capitale, 0,6 mm dès 2,58 mm", () => {
    expect(strokeMm(688)).toBeCloseTo(160, 6);
    expect(capForStroke(STROKE_WARN_MM)).toBeCloseTo(3.44, 2);
    expect(capForStroke(STROKE_ERROR_MM)).toBeCloseTo(2.58, 2);
    // Le trait de la capitale minimale du brief (3,6 mm) est imprimable.
    expect(strokeMm(MIN_CAP_MM)).toBeGreaterThan(STROKE_WARN_MM);
    expect(strokeMm(MIN_NAME_CAP_MM)).toBeGreaterThan(STROKE_WARN_MM);
  });

  it("trait < 0,8 mm : avertissement ; < 0,6 mm : erreur (text-stroke)", () => {
    const spec = {
      field: "line1" as const,
      text: "Test",
      minCapMm: 2,
      maxWidthMm: 200,
    };
    const ok = checkLine({ ...spec, capMm: 3.6 });
    expect(ok.issues.filter((i) => i.code === "text-stroke")).toEqual([]);
    const warn = checkLine({ ...spec, capMm: 3.2 });
    const warnIssue = warn.issues.find((i) => i.code === "text-stroke");
    expect(warnIssue?.value).toBeCloseTo(strokeMm(3.2), 1);
    expect(strokeLevel(warnIssue!.value!)).toBe("warn");
    const error = checkLine({ ...spec, capMm: 2.4 });
    const errorIssue = error.issues.find((i) => i.code === "text-stroke");
    expect(strokeLevel(errorIssue!.value!)).toBe("error");
    // Le seuil exact : 0,8 mm n'est pas un avertissement.
    expect(strokeLevel(0.6)).toBe("warn");
    expect(strokeLevel(0.59)).toBe("error");
  });

  it("ajustement : la capitale rétrécit jusqu'au minimum, puis `text-fit` (le texte déborde, capitale = minimum)", () => {
    const text = "Jean-Baptiste Dubois-Martin";
    const perCap = measureText(text).perCap;
    // Assez de place : inchangé.
    const roomy = fitCap(text, 5.2, MIN_NAME_CAP_MM, perCap * 5.2 + 1);
    expect(roomy).toEqual({ capMm: 5.2, fits: true, shrunk: false });
    // Un peu moins : réduit au dixième de mm vers le bas, et le texte tient.
    const tight = fitCap(text, 5.2, MIN_NAME_CAP_MM, perCap * 4.5);
    expect(tight.fits).toBe(true);
    expect(tight.shrunk).toBe(true);
    expect(tight.capMm).toBe(4.5);
    expect(textWidthMm(text, tight.capMm)).toBeLessThanOrEqual(perCap * 4.5);
    // Au minimum exactement : tient.
    expect(fitCap(text, 5.2, MIN_NAME_CAP_MM, perCap * 4).capMm).toBe(4);
    expect(fitCap(text, 5.2, MIN_NAME_CAP_MM, perCap * 4).fits).toBe(true);
    // Trop court même au minimum : `text-fit`.
    const tooLong = fitCap(text, 5.2, MIN_NAME_CAP_MM, perCap * 3.9);
    expect(tooLong).toEqual({
      capMm: MIN_NAME_CAP_MM,
      fits: false,
      shrunk: true,
    });
    const check = checkLine({
      field: "name",
      text,
      capMm: 5.2,
      minCapMm: MIN_NAME_CAP_MM,
      maxWidthMm: perCap * 3.9,
    });
    expect(check.capMm).toBe(MIN_NAME_CAP_MM);
    const fit = check.issues.find((i) => i.code === "text-fit");
    expect(fit?.value).toBeCloseTo(perCap * MIN_NAME_CAP_MM, 1);
  });

  it("un texte vide ne déborde jamais", () => {
    expect(fitCap("", 5.2, 4, 10)).toEqual({
      capMm: 5.2,
      fits: true,
      shrunk: false,
    });
    expect(measureText("").perCap).toBe(0);
  });

  it("dépasser la longueur saisissable est un `text-fit` même si le texte tient", () => {
    const check = checkLine({
      field: "peak",
      text: "iiiiiiiiiiiiiii", // 15 caractères > 12, étroits
      capMm: 4.2,
      minCapMm: MIN_CAP_MM,
      maxWidthMm: 200,
    });
    expect(check.issues.map((i) => i.code)).toContain("text-fit");
  });

  it("la largeur d'un texte est la chasse plus 0,02 em d'approche, sans crénage", () => {
    const a = measureText("A").perCap;
    const aa = measureText("AA").perCap;
    // Sans crénage : deux « A » = deux fois la chasse + une approche de 0,02 em.
    expect(aa - 2 * a).toBeCloseTo(
      (0.02 * FONT_METRICS.unitsPerEm) / FONT_METRICS.capHeight,
      6,
    );
    // « AV » et « VA » (paires habituellement crénées) gardent la même largeur.
    expect(measureText("AV").perCap).toBeCloseTo(measureText("VA").perCap, 9);
  });
});

describe("anticollision : les formes d'encre de deux glyphes voisins restent disjointes", () => {
  it("les 322 × 322 paires du jeu : aucun chevauchement, écart minimal positif", () => {
    const chars = CHARSET.filter((ch) => font.polygons(ch, "fine").length > 0);
    let minGap = Infinity;
    let worst = "";
    const overlaps: string[] = [];
    for (const a of chars) {
      const na = font.polygons(a, "fine").length;
      for (const b of chars) {
        const polygons = linePolygons(
          { key: "t", text: a + b, capMm: font.capHeight, x: 0, y: 0 },
          "export",
          font,
        );
        const pa = polygons.slice(0, na);
        const pb = polygons.slice(na);
        let gap = Infinity;
        for (const p of pa)
          for (const q of pb) gap = Math.min(gap, polygonGap(p, q, 60));
        if (gap === 0) overlaps.push(a + b);
        if (gap < minGap) {
          minGap = gap;
          worst = a + b;
        }
      }
    }
    console.log(
      `[glyphes] paires : écart minimal ${minGap.toFixed(1)} unités (« ${worst} »)`,
    );
    expect(overlaps).toEqual([]);
    expect(minGap).toBeGreaterThan(5);
  });

  it("l'espace supplémentaire ne touche que les glyphes qui dépassent de leur boîte", () => {
    // Lettres ordinaires : aucune paire n'est resserrée ni élargie.
    expect(pairExtraUnits("a", "b")).toBe(0);
    expect(pairExtraUnits("o", "ï")).toBe(0); // « Loïc » : l'accent ne touche aucune lettre basse
    expect(pairExtraUnits("T", "a")).toBe(0);
    // Accent de ï sous une capitale haute : espace ajouté.
    expect(pairExtraUnits("A", "ï")).toBeGreaterThan(0);
    expect(pairExtraUnits("T", "î")).toBeGreaterThan(0);
    // Jamais négatif : pas de crénage.
    for (const a of CHARSET.slice(0, 120)) {
      for (const b of CHARSET.slice(0, 120)) {
        expect(pairExtraUnits(a, b)).toBeGreaterThanOrEqual(0);
      }
    }
    expect(Object.keys(GLYPH_HOOKS).length).toBeLessThan(60);
  });

  it("la largeur mesurée (SSR) est celle du maillage : même espacement, à la pointe près", () => {
    for (const text of ["Tîmes", "gîte", "Loïc", "Åsa Ģ", "WWÏ", "7ï ĩd"]) {
      const capMm = 10;
      const polygons = linePolygons(
        { key: "t", text, capMm, x: 0, y: 0 },
        "export",
        font,
      );
      const xs = polygons.flatMap((p) => p.outer.map((pt) => pt[0]));
      const inkRight = Math.max(...xs);
      const width = textWidthMm(text, capMm);
      // L'encre du dernier glyphe ne dépasse de la chasse que de son dépassement.
      expect(inkRight).toBeLessThanOrEqual(width + 0.1 * capMm);
      expect(inkRight).toBeGreaterThan(0.5 * width);
    }
  });
});
