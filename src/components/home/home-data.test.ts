import { describe, expect, it } from "vitest";
import { buildHomeData } from "./home-data-build";
import { HOME_DATA } from "./home-data.generated";

// La page n'importe que `home-data.generated.ts` (les bibliothèques du Studio
// pèsent ≈ 100 Kio gzip dans le Worker). Ce test est ce qui garde ce fichier
// honnête : un préréglage, un coefficient de prix, un générateur ou un texte
// d'exemple qui change donne d'autres chiffres, et la CI échoue jusqu'à la
// régénération.
describe("données précalculées de l'accueil", () => {
  it("home-data.generated.ts est à jour (bun src/components/home/generate-home-data.ts)", () => {
    // Aller-retour JSON : le fichier généré est du JSON, pas des objets vivants.
    const fresh = JSON.parse(JSON.stringify(buildHomeData()));
    expect(HOME_DATA).toEqual(fresh);
  });

  it("couvre les quatre langues et les quatre objets", () => {
    for (const locale of ["fr", "de", "it", "en"] as const) {
      expect(HOME_DATA.summit[locale].label).toMatch(/·/);
      for (const id of ["lavaux", "cartouche", "relief", "borne"] as const) {
        const card = HOME_DATA.objects[locale][id];
        expect(card.stats.grams).toBeGreaterThan(0);
        expect(card.stats.minutes).toBeGreaterThan(0);
      }
    }
  });

  it("aucun prix tant que le barème n'est pas validé (« Sur devis »)", () => {
    for (const locale of ["fr", "de", "it", "en"] as const)
      for (const id of ["lavaux", "cartouche", "relief", "borne"] as const)
        expect(HOME_DATA.objects[locale][id].estimate).toBeNull();
  });

  it("le lien du sous-verre porte la configuration, jamais un texte", () => {
    expect(HOME_DATA.reliefHref).toMatch(
      /^\/studio\/relief#c=v1\.[A-Za-z0-9_-]+$/,
    );
  });

  it("trois posters d'exemple dans le budget du brief (§5.7)", () => {
    const size = (poster: unknown) => JSON.stringify(poster).length;
    expect(HOME_DATA.posters.ghost.ghost).toHaveLength(75);
    expect(size(HOME_DATA.posters.ghost)).toBeLessThan(6 * 1024);
    expect(size(HOME_DATA.posters.final)).toBeLessThan(8 * 1024);
  });
});
