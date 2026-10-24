import { describe, expect, it } from "vitest";
import {
  bambuPresetFor,
  GENERIC_PRESET,
  projectSettings,
  type BambuTemplate,
} from "./bambu-project";
import template from "./bambu-template.json";
import { PaintDocument } from "./document";
import { cubePositions } from "./fixtures";
import { read3mf } from "./read";
import { readZipEntries, textOf } from "./zip";
import { paintSphere, paintTriangles } from "./tools";
import { write3mf } from "./write3mf";

const bambu = template as BambuTemplate;

describe("projet Bambu Studio", () => {
  it("modèle généré : chaque profil a toutes les clés par filament, une entrée chacune", () => {
    expect(bambu.application).toMatch(/^BambuStudio-\d+\.\d+\.\d+\.\d+$/);
    expect(bambu.presets[GENERIC_PRESET]).toBeDefined();
    for (const [name, values] of Object.entries(bambu.presets)) {
      expect(values.filament_settings_id).toEqual([name]);
      for (const key of bambu.perFilament) {
        expect(Array.isArray(values[key]), `${name} · ${key}`).toBe(true);
        expect(values[key].length, `${name} · ${key}`).toBeGreaterThan(0);
      }
    }
    // La partie commune vient des profils de la machine, pas des défauts.
    expect(bambu.shared.printable_area).toEqual([
      "0x0",
      "256x0",
      "256x256",
      "0x256",
    ]);
    expect(bambu.shared.printer_model).toBe("Bambu Lab P1S");
  });

  it("chaque référence du stock a un profil du modèle", () => {
    for (const [brand, range] of [
      ["Bambu Lab", "PLA Basic"],
      ["Bambu Lab", "PLA Matte"],
      ["Bambu Lab", "PLA Metal"],
      ["Bambu Lab", "PLA Silk Multi-Color"],
      ["Bambu Lab", "PLA Wood"],
      ["Polymaker", "PolyTerra PLA"],
      ["R3D", "eSilk Mystic-PLA"],
      ["Inconnue", "PLA"],
    ])
      expect(bambu.presets[bambuPresetFor(brand, range)]).toBeDefined();
    expect(bambuPresetFor("Polymaker", "PolyTerra PLA")).toBe(
      "PolyTerra PLA @BBL X1C",
    );
    expect(bambuPresetFor("R3D", "eSilk Mystic-PLA")).toBe("Generic PLA Silk");
  });

  it("configuration à N filaments : couleurs, profils, purge à la taille", () => {
    const config = projectSettings(bambu, [
      { hex: "#f4efeb", preset: "PolyTerra PLA @BBL X1C" },
      { hex: "#FEC600", preset: "Bambu PLA Basic @BBL X1C" },
      { hex: "#39699E", preset: "inconnu" },
    ]);
    expect(config.filament_colour).toEqual(["#F4EFEB", "#FEC600", "#39699E"]);
    expect(config.filament_settings_id).toEqual([
      "PolyTerra PLA @BBL X1C",
      "Bambu PLA Basic @BBL X1C",
      GENERIC_PRESET,
    ]);
    expect(config.filament_self_index).toEqual(["1", "2", "3"]);
    expect(config.different_settings_to_system).toHaveLength(5);
    const flush = config.flush_volumes_matrix as string[];
    expect(flush).toHaveLength(9);
    expect([flush[0], flush[4], flush[8]]).toEqual(["0", "0", "0"]);
    for (const key of bambu.perFilament) {
      const one = bambu.presets[GENERIC_PRESET][key].length;
      expect((config[key] as unknown[]).length).toBe(3 * one);
    }
  });

  it("3MF : découpage de Bambu Studio, peinture et couleurs relues", async () => {
    const doc = new PaintDocument({
      positions: new Float32Array([...cubePositions(10), ...cubePositions(4)]),
      parts: [
        { name: "Corps", first: 0, count: 12 },
        { name: "Bouton", first: 12, count: 12 },
      ],
    });
    doc.beginStep();
    paintTriangles(doc, [2, 3], 2);
    paintSphere(doc, [5, 0, 5], { state: 3, radius: 2, facing: null });
    doc.endStep();
    const filaments = [
      { hex: "#F4EFEB", preset: "PolyTerra PLA @BBL X1C" },
      { hex: "#FEC600", preset: "Bambu PLA Basic @BBL X1C" },
      { hex: "#39699E", preset: "Bambu PLA Metal @BBL X1C" },
    ];
    const blob = await write3mf(doc, {
      title: "Cube",
      colors: filaments.map((f) => f.hex),
      bambu: { template: bambu, filaments },
      now: new Date(2026, 9, 24),
    });
    const buffer = await blob.arrayBuffer();
    const entries = await readZipEntries(buffer, () => true);
    const names = [...entries.keys()];
    expect(names).toEqual(
      expect.arrayContaining([
        "3D/3dmodel.model",
        "3D/Objects/object_1.model",
        "3D/_rels/3dmodel.model.rels",
        "Metadata/model_settings.config",
        "Metadata/project_settings.config",
      ]),
    );
    const main = textOf(entries.get("3D/3dmodel.model")!);
    expect(main).toContain(
      `<metadata name="Application">${bambu.application}</metadata>`,
    );
    const settings = JSON.parse(
      textOf(entries.get("Metadata/project_settings.config")) ?? "{}",
    );
    expect(settings.filament_colour).toEqual(filaments.map((f) => f.hex));
    // Notre lecteur relit le projet : pièces, position, couleurs, peinture.
    const loaded = await read3mf(buffer);
    expect(loaded.parts.map((p) => [p.name, p.count])).toEqual([
      ["Corps", 12],
      ["Bouton", 12],
    ]);
    expect(loaded.filamentColors).toEqual(filaments.map((f) => f.hex));
    let minZ = Infinity;
    for (let i = 2; i < loaded.positions.length; i += 3)
      minZ = Math.min(minZ, loaded.positions[i]);
    expect(minZ).toBeCloseTo(0);
    for (let t = 0; t < doc.triangleCount; t++)
      expect(loaded.paint.get(t) ?? 0).toEqual(doc.node(t));
  });
});
