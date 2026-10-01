// Cœur du Worker de géométrie (brief « Strates », §6.9, §6.11) : maillages
// d'affichage et STL d'envoi, glyphes chargés à la demande, sans three.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BORNE_DEFAULT,
  CARTOUCHE_DEFAULT,
  HERO_CONFIG,
  RELIEF_DEFAULT,
} from "@/lib/studio/presets";
import { setGlyphFont } from "@/lib/studio/text/glyphs";
import { ensureGlyphs, runBuild, runExport } from "./geometry-core";
import { StudioWorkerError } from "./protocol";

const GLYPH_FILE = fileURLToPath(
  new URL("../../../public/studio/glyphs/s3d-relief-v1.json", import.meta.url),
);

/** `fetch` qui sert le JSON de glyphes du dépôt (le Worker le lit par URL). */
function serveGlyphs() {
  const fake = vi.fn<typeof fetch>(async () =>
    Response.json(JSON.parse(readFileSync(GLYPH_FILE, "utf8"))),
  );
  vi.stubGlobal("fetch", fake);
  return fake;
}

afterEach(() => {
  setGlyphFont(null);
  vi.unstubAllGlobals();
});

describe("construction d'affichage (Worker)", () => {
  it("le vase : maillage, bandes et hauteur renvoyés avec lui, sans glyphes", async () => {
    const fetchSpy = serveGlyphs();
    const built = await runBuild({
      config: HERO_CONFIG,
      texts: {},
      lod: "display",
      tier: 2,
      separate: false,
      locale: "fr",
    });
    expect(built.mesh.triangles).toBeGreaterThan(60_000);
    expect(built.mesh.triangles).toBeLessThan(130_000);
    expect(built.bands).toEqual([
      { filament: "bleu-leman", toMm: 42 },
      { filament: "vert-lavaux", toMm: 108 },
      { filament: "blanc-neve", toMm: 150 },
    ]);
    expect(built.heightMm).toBe(150);
    // Le vase n'a jamais besoin des 124 Ko de glyphes.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("palier C1 : moins de triangles que C2 ; basse définition : bien moins encore", async () => {
    const run = (lod: "drag" | "display", tier: 1 | 2) =>
      runBuild({
        config: HERO_CONFIG,
        texts: {},
        lod,
        tier,
        separate: false,
        locale: "fr",
      });
    const [c2, c1, drag] = await Promise.all([
      run("display", 2),
      run("display", 1),
      run("drag", 2),
    ]);
    expect(c1.mesh.triangles).toBeLessThan(c2.mesh.triangles);
    expect(drag.mesh.triangles).toBeLessThan(c1.mesh.triangles);
    expect(c1.mesh.triangles).toBeLessThan(45_000);
  });

  it("éclaté : une coque par bande, groupes numérotés par bande", async () => {
    const built = await runBuild({
      config: HERO_CONFIG,
      texts: {},
      lod: "display",
      tier: 1,
      separate: true,
      locale: "fr",
    });
    const bandsSeen = new Set(built.mesh.groups.map((g) => g.band));
    expect([...bandsSeen].sort()).toEqual([0, 1, 2]);
  });

  it("un objet à texte charge les glyphes une seule fois, puis construit", async () => {
    const fetchSpy = serveGlyphs();
    const job = {
      lod: "display" as const,
      tier: 1 as const,
      separate: false,
      locale: "fr" as const,
    };
    const card = await runBuild({
      ...job,
      config: CARTOUCHE_DEFAULT,
      texts: { name: "Zoé Sentinelle", role: "Cheffe de projet" },
    });
    expect(card.mesh.triangles).toBeGreaterThan(500);
    expect(card.bands.map((b) => b.filament)).toEqual(["blanc-neve", "encre"]);
    expect(card.heightMm).toBeCloseTo(2.2, 5); // plaque 1,6 + relief 0,6
    const tag = await runBuild({
      ...job,
      config: BORNE_DEFAULT,
      texts: { text: "Zoé" },
    });
    expect(tag.mesh.triangles).toBeGreaterThan(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("sous-verre : l'étiquette change avec la langue (POINTE / MOUNT)", async () => {
    serveGlyphs();
    const run = (locale: "fr" | "en") =>
      runBuild({
        config: RELIEF_DEFAULT,
        texts: { peak: "Zoé" },
        lod: "display",
        tier: 1,
        separate: false,
        locale,
      });
    const [fr, en] = await Promise.all([run("fr"), run("en")]);
    expect(fr.mesh.triangles).not.toBe(en.mesh.triangles);
  });

  it("des glyphes introuvables : une erreur typée « glyphs », qu'on peut réessayer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 404 })),
    );
    await expect(
      runBuild({
        config: BORNE_DEFAULT,
        texts: { text: "Zoé" },
        lod: "display",
        tier: 1,
        separate: false,
        locale: "fr",
      }),
    ).rejects.toMatchObject({ name: "StudioWorkerError", code: "glyphs" });
    // L'échec n'est pas mémorisé : le réseau revient, le texte se construit.
    serveGlyphs();
    await expect(ensureGlyphs()).resolves.toBeUndefined();
  });

  it("un texte vide n'a pas besoin de glyphes (carte sans nom)", async () => {
    const fetchSpy = serveGlyphs();
    await runBuild({
      config: CARTOUCHE_DEFAULT,
      texts: {},
      lod: "display",
      tier: 1,
      separate: false,
      locale: "fr",
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("export STL d'envoi (§6.9)", () => {
  it("le vase par défaut : 84 + 50 × n octets, 1 à 3 Mo, en-tête qui ne commence jamais par « solid »", async () => {
    const file = await runExport(HERO_CONFIG, {}, "fr");
    expect(file.bytes).toBe(84 + 50 * file.triangles);
    expect(file.buffer.byteLength).toBe(file.bytes);
    expect(file.bytes).toBeGreaterThan(1_000_000);
    expect(file.bytes).toBeLessThan(3_000_000);
    const header = new TextDecoder().decode(new Uint8Array(file.buffer, 0, 80));
    expect(header.startsWith("solid")).toBe(false);
    expect(header).toMatch(/^Swiss3Design Studio v1 lavaux [0-9a-f]{8}/);
    expect(new DataView(file.buffer).getUint32(80, true)).toBe(file.triangles);
    expect(file.fileName).toBe(`s3d-lavaux-${file.hash}.stl`);
  });

  it("dimensions en mm, Z vers le haut : la boîte du fichier est celle de l'objet", async () => {
    const file = await runExport(HERO_CONFIG, {}, "fr");
    const view = new DataView(file.buffer);
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let t = 0; t < file.triangles; t += 17) {
      for (let v = 0; v < 3; v++)
        for (let axis = 0; axis < 3; axis++) {
          const value = view.getFloat32(
            84 + t * 50 + 12 + v * 12 + axis * 4,
            true,
          );
          min[axis] = Math.min(min[axis], value);
          max[axis] = Math.max(max[axis], value);
        }
    }
    expect(min[2]).toBeCloseTo(0, 3); // posé sur le plateau
    expect(max[2]).toBeCloseTo(150, 2); // hauteur : Z vers le haut
    expect(max[0] - min[0]).toBeLessThanOrEqual(96.05);
    expect(max[0] - min[0]).toBeGreaterThan(90);
  });

  it("une carte avec texte : son STL porte le texte (plus de triangles que sans)", async () => {
    serveGlyphs();
    const plain = await runExport(CARTOUCHE_DEFAULT, {}, "fr");
    const typed = await runExport(
      CARTOUCHE_DEFAULT,
      { name: "Zoé Sentinelle" },
      "fr",
    );
    expect(typed.triangles).toBeGreaterThan(plain.triangles);
    expect(typed.hash).not.toBe(plain.hash);
    expect(typed.bytes).toBe(84 + 50 * typed.triangles);
  });

  it("le même réglage donne le même fichier, au bit près", async () => {
    const a = await runExport(HERO_CONFIG, {}, "fr");
    const b = await runExport(HERO_CONFIG, {}, "fr");
    expect(Buffer.from(a.buffer).equals(Buffer.from(b.buffer))).toBe(true);
  });

  it("l'erreur d'export est typée", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 500 })),
    );
    const error = await runExport(BORNE_DEFAULT, { text: "Zoé" }, "fr").catch(
      (e) => e,
    );
    expect(error).toBeInstanceOf(StudioWorkerError);
    expect(error.code).toBe("glyphs");
  });
});
