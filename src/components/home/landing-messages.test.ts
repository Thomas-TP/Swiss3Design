import { describe, expect, it } from "vitest";
import de from "../../../messages/de/landing.json";
import en from "../../../messages/en/landing.json";
import fr from "../../../messages/fr/landing.json";
import it_ from "../../../messages/it/landing.json";

// Ce que messages.test.ts ne dit pas : les textes de l'accueil tiennent dans les
// limites du brief (§4.9 : titre ≤ 60 caractères, description 110–160) et leurs
// titres suivent la règle du point rouge (§2.2 : un point final unique devient
// le disque rouge, jamais sur un titre qui finit par « ? »).
const locales = { fr, de, it: it_, en } as const;

describe("textes de l'accueil", () => {
  for (const [locale, messages] of Object.entries(locales)) {
    describe(locale, () => {
      it("titre ≤ 60 et description entre 110 et 160 caractères", () => {
        expect(messages.seo.title.length).toBeLessThanOrEqual(60);
        expect(messages.seo.description.length).toBeGreaterThanOrEqual(110);
        expect(messages.seo.description.length).toBeLessThanOrEqual(160);
      });

      it("les titres d'affichage finissent par un point (ou un « ? »)", () => {
        for (const title of [
          messages.hero.title,
          messages.map.title,
          messages.summit.title,
          messages.studio.title,
          messages.shop.title,
          messages.atelier.title,
        ])
          expect(title).toMatch(/\.$/);
        expect(messages.file.title).toMatch(/\?$/);
      });

      it("aucune exclamation, aucun superlatif creux (voix du brief §1.6)", () => {
        const text = JSON.stringify(messages);
        expect(text).not.toContain("!");
        expect(text.toLowerCase()).not.toMatch(
          /révolutionn|revolution|weltweit führend|rivoluzion/,
        );
      });
    });
  }
});
