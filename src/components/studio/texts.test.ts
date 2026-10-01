import { describe, expect, it } from "vitest";
import { DEFAULT_TEXTS } from "@/lib/studio/text/fields";
import { displayTexts, exampleTexts, hasTypedText, isEdited } from "./texts";
import { translators } from "./testing";

describe("textes affichés et textes saisis", () => {
  const examples = DEFAULT_TEXTS.cartouche;

  it("tant que rien n'est saisi, on AFFICHE l'exemple ; dès qu'un champ est touché, seulement la saisie", () => {
    expect(displayTexts("cartouche", {}, examples)).toBe(examples);
    expect(isEdited("cartouche", {})).toBe(false);
    const typed = { name: "Zoé" };
    expect(isEdited("cartouche", typed)).toBe(true);
    // Les autres champs restent VIDES : l'aperçu ne mélange pas exemple et saisie.
    expect(displayTexts("cartouche", typed, examples)).toBe(typed);
    // Vider un champ est un geste : il ne redonne pas l'exemple.
    expect(isEdited("cartouche", { name: "" })).toBe(true);
  });

  it("un objet sans texte n'affiche aucun texte", () => {
    expect(displayTexts("lavaux", { name: "x" }, examples)).toEqual({});
  });

  it("hasTypedText : au moins un caractère saisi dans un champ de l'objet", () => {
    expect(hasTypedText("cartouche", {})).toBe(false);
    expect(hasTypedText("cartouche", { name: "  " })).toBe(false);
    expect(hasTypedText("cartouche", { name: "Zoé" })).toBe(true);
    expect(hasTypedText("borne", { name: "Zoé" })).toBe(false);
  });

  it("les exemples viennent des messages de la langue, et le français reste celui du code", () => {
    const fr = translators("fr").core;
    expect(exampleTexts("cartouche", fr)).toEqual(DEFAULT_TEXTS.cartouche);
    expect(exampleTexts("borne", fr)).toEqual(DEFAULT_TEXTS.borne);
    expect(exampleTexts("lavaux", fr)).toEqual({});
    expect(exampleTexts("cartouche", translators("de").core).role).toBe(
      "Architektin",
    );
  });
});
