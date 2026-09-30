import { describe, expect, it } from "vitest";
import { stripeAppearance } from "./stripe-appearance";

// Sélecteurs de l'Appearance API de Stripe que le site utilise : un sélecteur
// hors de cette liste fait échouer le rendu du Payment Element (voir l'en-tête
// de stripe-appearance.ts). Le test empêche d'en ajouter un par mégarde.
const SUPPORTED = new Set([
  ".Input",
  ".Input:hover",
  ".Input:focus",
  ".Input--invalid",
  ".Input::placeholder",
  ".Label",
  ".Error",
  ".AccordionItem",
  ".AccordionItem:hover",
  ".AccordionItem--selected",
  ".Dropdown",
  ".DropdownItem",
  ".DropdownItem--highlight",
]);

describe("stripeAppearance", () => {
  for (const dark of [false, true]) {
    const name = dark ? "thème sombre" : "thème clair";
    const appearance = stripeAppearance(dark);

    it(`${name} : n'utilise que des sélecteurs pris en charge`, () => {
      for (const selector of Object.keys(appearance.rules ?? {}))
        expect(SUPPORTED.has(selector), selector).toBe(true);
    });

    it(`${name} : rayons du système (4 px, accordéon 6 px) et police Geist`, () => {
      expect(appearance.variables?.borderRadius).toBe("4px");
      expect(appearance.variables?.fontFamily).toContain("Geist");
      expect(appearance.rules?.[".AccordionItem"]?.borderRadius).toBe("6px");
    });

    it(`${name} : rouge de marque en couleur primaire, rouge lisible pour les erreurs`, () => {
      expect(appearance.variables?.colorPrimary).toBe("#e5231c");
      // Texte d'erreur < 24 px : jeton accent-text, jamais le rouge graphique.
      expect(appearance.variables?.colorDanger).not.toBe("#e5231c");
      expect(appearance.rules?.[".Error"]?.color).toBe(
        appearance.variables?.colorDanger,
      );
    });
  }

  it("suit les jetons de globals.css (clair puis sombre)", () => {
    const light = stripeAppearance(false).variables;
    const dark = stripeAppearance(true).variables;
    expect(light?.colorText).toBe("#1a1614");
    expect(light?.colorBackground).toBe("#ffffff");
    expect(light?.colorDanger).toBe("#b3170f");
    expect(dark?.colorText).toBe("#f2ede4");
    expect(dark?.colorBackground).toBe("#211e1a");
    expect(dark?.colorDanger).toBe("#ff5b4e");
  });
});
