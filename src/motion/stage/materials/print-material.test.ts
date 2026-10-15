import { readFileSync } from "node:fs";
import { SRGBColorSpace } from "three";
import { describe, expect, it } from "vitest";
import { FILAMENTS, filamentHex } from "@/lib/studio/filaments";
import { createPrintMaterial } from "./print-material";

// Vue 3D : la couleur de base d'une bande est l'hex EXACT du filament, avec la
// gestion des couleurs de three (entrée sRGB convertie en linéaire pour le
// calcul, rendu en sRGB). Aucune teinte n'est ajoutée au-delà de l'éclairage
// normal de la scène.
describe("matériau d'impression : la couleur de base est l'hex exact du filament", () => {
  it("chaque bande, relue en sRGB, rend exactement l'hex Polymaker", () => {
    for (const filament of FILAMENTS) {
      const print = createPrintMaterial({
        heightMm: 100,
        bands: [{ topMm: 100, color: filamentHex(filament.id) }],
      });
      const written = print.uniforms.uBandColor.value[0];
      expect(`#${written.getHexString(SRGBColorSpace)}`.toUpperCase()).toBe(
        filament.hex,
      );
      print.dispose();
    }
  });

  it("quatre bandes : chaque palier garde sa propre teinte exacte", () => {
    const ids = ["encre", "vert-lavaux", "gris-molasse", "blanc-neve"] as const;
    const print = createPrintMaterial({
      heightMm: 80,
      bands: ids.map((id, k) => ({
        topMm: 20 * (k + 1),
        color: filamentHex(id),
      })),
    });
    ids.forEach((id, k) => {
      const color = print.uniforms.uBandColor.value[k];
      expect(`#${color.getHexString(SRGBColorSpace)}`.toUpperCase()).toBe(
        filamentHex(id),
      );
    });
    print.dispose();
  });

  it("le shader remplace la couleur de base par celle de la bande, sans la multiplier ni la teinter", () => {
    const source = readFileSync(
      new URL("../glsl/print.ts", import.meta.url),
      "utf8",
    );
    expect(source).toContain(
      "diffuseColor.rgb = (vZ <= uRippleZ) ? uBandColor[band] : uBandColorFrom[band];",
    );
  });

  it("le rendu est en sRGB (outputColorSpace) avec le mappage de tons neutre de Khronos", () => {
    const stage = readFileSync(new URL("../stage.ts", import.meta.url), "utf8");
    expect(stage).toContain("renderer.outputColorSpace = SRGBColorSpace");
    expect(stage).toContain("renderer.toneMapping = NeutralToneMapping");
  });
});
