import { describe, expect, it } from "vitest";
import { routing } from "@/i18n/routing";
import { attributionFor, licenseDeedUrl } from "./attribution";

// Garde de l'attribution CC BY-ND 4.0 de Ian : si quelqu'un change une de ces
// valeurs, c'est l'obligation légale (nom, licence, lien) ou l'interdiction de
// dérivé qui bouge — le test doit le dire avant le déploiement.
describe("attribution — Vase spirale de Ian", () => {
  const vase = attributionFor("vase-spirale");

  it("donne le nom, la plateforme, la licence et le lien exigés", () => {
    expect(vase).toEqual({
      title: "Vase",
      author: "Ian",
      platform: "MakerWorld",
      url: "https://makerworld.com/fr/models/1262112-vase",
      license: "CC BY-ND 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-nd/4.0/",
      modified: false,
    });
  });

  it("n'a jamais modifié le modèle (BY-ND : pas d'œuvre dérivée)", () => {
    expect(vase?.modified).toBe(false);
  });

  it("ne crédite que les modèles d'un tiers (les nôtres n'ont aucune mention)", () => {
    expect(attributionFor("lampe-voronoi")).toBeNull();
    expect(attributionFor("")).toBeNull();
    // Pas de fuite par la chaîne de prototypes d'un objet ordinaire.
    expect(attributionFor("constructor")).toBeNull();
    expect(attributionFor("toString")).toBeNull();
  });

  it("pointe le deed Creative Commons dans chacune des 4 langues", () => {
    expect(vase).not.toBeNull();
    const deeds = routing.locales.map((l) => licenseDeedUrl(vase!, l));
    expect(deeds).toEqual([
      "https://creativecommons.org/licenses/by-nd/4.0/deed.fr",
      "https://creativecommons.org/licenses/by-nd/4.0/deed.de",
      "https://creativecommons.org/licenses/by-nd/4.0/deed.it",
      "https://creativecommons.org/licenses/by-nd/4.0/deed.en",
    ]);
  });
});
