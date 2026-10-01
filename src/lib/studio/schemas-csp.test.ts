import { describe, expect, it } from "vitest";

// Sous la CSP de production (`script-src` sans 'unsafe-eval'), la sonde
// `Function("")` de zod est rapportée comme `securitypolicyviolation` (« eval »)
// sur chaque page du Studio, même quand l'exception est avalée (relevé de la
// vérification de la vague 2b). schemas.ts passe zod en `jitless` avant de
// construire le moindre schéma : plus aucune sonde. Ce fichier est seul de son
// module, zod n'y est donc chargé qu'après l'espion.

describe("schemas : aucune compilation à la volée", () => {
  it("ne sonde jamais Function() à la construction ni à la validation", async () => {
    const original = globalThis.Function;
    let probes = 0;
    const count = (args: unknown[]) => {
      if (args.length === 1 && args[0] === "") probes += 1;
    };
    globalThis.Function = new Proxy(original, {
      apply(target, thisArg, args) {
        count(args);
        return Reflect.apply(target, thisArg, args);
      },
      construct(target, args, newTarget) {
        count(args);
        return Reflect.construct(target, args, newTarget);
      },
    });
    try {
      const { parseConfig } = await import("./schemas");
      const { HERO_CONFIG, RELIEF_DEFAULT } = await import("./presets");
      expect(parseConfig("lavaux", HERO_CONFIG).ok).toBe(true);
      expect(parseConfig("relief", RELIEF_DEFAULT).ok).toBe(true);
      expect(parseConfig("lavaux", { object: "lavaux", h: -1 }).ok).toBe(false);
    } finally {
      globalThis.Function = original;
    }
    expect(probes).toBe(0);
  });
});
