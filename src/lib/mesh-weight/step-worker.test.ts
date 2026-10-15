import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { estimateFromMesh } from "./estimate";

// Le Worker STEP (public/vendor/occt/occt-step-worker.js) exécuté tel quel, avec le
// VRAI moteur occt-import-js (sous Node : mêmes calculs que dans le navigateur),
// sur les fichiers d'exemple du paquet. La page, elle, charge le wasm dans un Worker
// du navigateur ; ici on vérifie la lecture et le calcul volume/surface.
const root = new URL("../../../", import.meta.url);
const files = new URL("node_modules/occt-import-js/test/testfiles/", root);
const available = existsSync(new URL("cube-10x10mm/Cube 10x10.stp", files));

type Reply = {
  id: number;
  ok: boolean;
  volumeMm3?: number;
  areaMm2?: number;
  bbox?: number[];
  triangles?: number;
  reason?: string;
};

async function runWorker(content: Buffer): Promise<Reply> {
  const require = createRequire(import.meta.url);
  const engine = require("occt-import-js") as () => Promise<unknown>;
  const source = readFileSync(
    new URL("public/vendor/occt/occt-step-worker.js", root),
    "utf8",
  );
  return new Promise((resolve) => {
    const scope: Record<string, unknown> = {
      postMessage: (reply: Reply) => resolve(reply),
    };
    const context = vm.createContext({
      self: scope,
      importScripts: () => {},
      // Le Worker du navigateur reçoit le vrai chargeur ; sous Node, le module du paquet.
      occtimportjs: () => engine(),
      Uint8Array,
      Math,
      Infinity,
    });
    vm.runInContext(source, context);
    const onmessage = scope.onmessage as (event: unknown) => Promise<void>;
    const buffer = content.buffer.slice(
      content.byteOffset,
      content.byteOffset + content.byteLength,
    );
    void onmessage({ data: { id: 1, buffer } });
  });
}

describe.skipIf(!available)(
  "Worker STEP : volume et surface d'un solide",
  () => {
    const read = (name: string) => readFileSync(new URL(name, files));

    it("un cube de 10 mm : 1000 mm³, 600 mm², 1 g de filament", async () => {
      const reply = await runWorker(read("cube-10x10mm/Cube 10x10.stp"));
      expect(reply.ok).toBe(true);
      expect(reply.volumeMm3).toBeCloseTo(1000, 0);
      expect(reply.areaMm2).toBeCloseTo(600, 0);
      const size = reply.bbox!.slice(3).map((v, k) => v - reply.bbox![k]);
      for (const s of size) expect(s).toBeCloseTo(10, 3);
      const estimate = estimateFromMesh({
        volumeMm3: reply.volumeMm3!,
        areaMm2: reply.areaMm2!,
        bbox: reply.bbox as [number, number, number, number, number, number],
        triangles: reply.triangles!,
      });
      // Coque : min(1000, 600 × 0,8) = 480 ; + 15 % de 520 = 558 mm³ → 0,69 g → 1 g.
      expect(estimate).toEqual({ grams: 1, issue: null, blocking: false });
    });

    it("le même cube en pouces et en millimètres donne le même volume (unité convertie en millimètres)", async () => {
      const mm = await runWorker(read("cube-units/cube-mm.step"));
      const inch = await runWorker(read("cube-units/cube-in.step"));
      expect(inch.ok).toBe(true);
      expect(inch.volumeMm3).toBeCloseTo(mm.volumeMm3!, 0);
    });

    it("un cube aux arêtes arrondies a un peu moins de volume que son cube", async () => {
      const reply = await runWorker(read("rounded-cube/rounded-cube.step"));
      expect(reply.ok).toBe(true);
      expect(reply.volumeMm3!).toBeGreaterThan(0);
    });

    it("un fichier qui n'est pas un STEP : illisible, aucune estimation inventée", async () => {
      const reply = await runWorker(
        Buffer.from("ceci n'est pas un fichier STEP"),
      );
      expect(reply).toMatchObject({ ok: false, reason: "unreadable" });
    });
  },
);
