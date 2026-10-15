import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// occt-import-js (LGPL-2.1) est servi tel quel depuis public/vendor/occt/ : ces
// fichiers doivent rester IDENTIQUES au paquet npm épinglé (package.json, version
// exacte). Une mise à jour du paquet sans recopie des fichiers échoue ici.
const root = new URL("../../../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root));

describe("occt-import-js : fichiers de public/ et paquet épinglé", () => {
  const files = [
    "occt-import-js.js",
    "occt-import-js.wasm",
    "license.occt-import-js.txt",
    "license.occt.txt",
  ];

  it("la version du paquet est épinglée sans ^ ni ~", () => {
    const pkg = JSON.parse(read("package.json").toString("utf8")) as {
      devDependencies?: Record<string, string>;
      dependencies?: Record<string, string>;
    };
    const version =
      pkg.devDependencies?.["occt-import-js"] ??
      pkg.dependencies?.["occt-import-js"];
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it.skipIf(!existsSync(new URL("node_modules/occt-import-js/", root)))(
    "les fichiers servis sont ceux du paquet, octet pour octet",
    () => {
      const identical = files.filter((name) =>
        read(`public/vendor/occt/${name}`).equals(
          read(`node_modules/occt-import-js/dist/${name}`),
        ),
      );
      expect(identical).toEqual(files);
    },
  );

  it("le Worker du navigateur charge le moteur et le wasm depuis /vendor/occt/", () => {
    const worker = read("public/vendor/occt/occt-step-worker.js").toString(
      "utf8",
    );
    expect(worker).toContain('importScripts("/vendor/occt/occt-import-js.js")');
    expect(worker).toContain('"/vendor/occt/" + path');
  });
});
