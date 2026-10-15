import { describe, expect, it, vi } from "vitest";

// Garde STRUCTURELLE : le chemin du prix (price-figures → stats) ne doit jamais
// importer la chaîne des contours de glyphes (`text/glyphs`, `text/shapes`),
// réservée au maillage. Ces deux modules sont remplacés par des modules qui
// lèvent une erreur dès qu'on les importe : si une dépendance apparaît un jour,
// ce test échoue bruyamment, avant qu'un prix ne diffère entre le serveur
// (sans police) et le navigateur (avec).
vi.mock("./text/glyphs", () => {
  throw new Error("text/glyphs ne doit pas être importé par le calcul du prix");
});
vi.mock("./text/shapes", () => {
  throw new Error("text/shapes ne doit pas être importé par le calcul du prix");
});

describe("le calcul du prix n'importe pas les contours de glyphes", () => {
  it("price-figures, stats et le barème se chargent sans text/glyphs ni text/shapes", async () => {
    const figures = await import("./price-figures");
    const { DEFAULT_CONFIGS } = await import("./presets");
    const { DEFAULT_TEXTS } = await import("./text/fields");
    const price = figures.studioPrice(
      DEFAULT_CONFIGS.cartouche,
      DEFAULT_TEXTS.cartouche,
      1,
    );
    expect(price.unitCents).toBe(1790);
  });

  it("la garde est effective : importer les contours de glyphes échoue ici", async () => {
    await expect(import("./text/glyphs")).rejects.toThrow(/mocking a module/);
    await expect(import("./text/shapes")).rejects.toThrow(/mocking a module/);
  });

  it("le panier (price, line-id, cart-data) est léger : aucun moteur de géométrie", async () => {
    await expect(import("./price")).resolves.toBeDefined();
    await expect(import("./line-id")).resolves.toBeDefined();
    await expect(import("../cart-data")).resolves.toBeDefined();
  });
});
