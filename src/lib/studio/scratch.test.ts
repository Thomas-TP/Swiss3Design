import { describe, expect, it } from "vitest";
import { buildStudioMesh } from "./build";
import { checkManifold, meshVolume } from "./kernel/mesh";
import { BORNE_DEFAULT, CARTOUCHE_DEFAULT, RELIEF_DEFAULT } from "./presets";
import { loadTestFont } from "./testing";
import { DEFAULT_TEXTS } from "./text/fields";
import type { StudioConfig } from "./types";

describe("scratch", () => {
  loadTestFont();
  const cases: [string, StudioConfig][] = [
    ["cartouche relief", CARTOUCHE_DEFAULT],
    ["cartouche gravure", { ...CARTOUCHE_DEFAULT, mode: "gravure" }],
    ["cartouche cadre", { ...CARTOUCHE_DEFAULT, layout: "cartouche" }],
    [
      "cartouche mono",
      { ...CARTOUCHE_DEFAULT, layout: "monogramme", mode: "gravure" },
    ],
    ["borne", BORNE_DEFAULT],
    ["borne gravure pic", { ...BORNE_DEFAULT, shape: "pic", mode: "gravure" }],
    [
      "borne goutte droite",
      { ...BORNE_DEFAULT, shape: "goutte", ring: "droite" },
    ],
    ["borne etiquette", { ...BORNE_DEFAULT, shape: "etiquette" }],
    ["relief", RELIEF_DEFAULT],
  ];
  for (const [name, config] of cases) {
    it(name, () => {
      const t0 = performance.now();
      const texts = DEFAULT_TEXTS[config.object];
      const mesh = buildStudioMesh(config, texts, { lod: "export" });
      const ms = performance.now() - t0;
      const r = checkManifold(mesh);
      console.log(
        name,
        `${ms.toFixed(1)} ms`,
        mesh.triangles,
        "closed",
        r.closed,
        "open",
        r.openEdges,
        "nm",
        r.nonManifoldEdges,
        "or",
        r.orientationErrors,
        "deg",
        r.degenerateTriangles,
        "comps",
        r.components,
        "vol",
        meshVolume(mesh).toFixed(0),
        "bbox",
        mesh.bbox.map((v) => v.toFixed(1)).join(","),
      );
      expect(r.closed).toBe(true);
    });
  }
});
