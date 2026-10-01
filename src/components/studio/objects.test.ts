import { describe, expect, it } from "vitest";
import {
  BORNE_DEFAULT,
  CARTOUCHE_DEFAULT,
  LAVAUX_DEFAULT,
  RELIEF_DEFAULT,
} from "@/lib/studio/presets";
import {
  defaultView,
  flatViewOf,
  hasBandBar,
  hasTextFields,
  minBands,
  missingText,
  printedTexts,
  textFieldsFor,
  textsForObject,
  viewsFor,
} from "./objects";

describe("objets du Studio : ce que l'interface en sait", () => {
  it("l'Élévation n'existe que pour le vase ; le plan est le dessin exact des objets plats", () => {
    expect(viewsFor("lavaux")).toEqual([
      "orbit",
      "plan",
      "elevation",
      "layers",
    ]);
    for (const object of ["cartouche", "relief", "borne"] as const) {
      expect(viewsFor(object)).toEqual(["orbit", "plan", "layers"]);
      expect(flatViewOf(object)).toBe("plan");
    }
    expect(flatViewOf("lavaux")).toBe("elevation");
  });

  it("sans WebGL on démarre sur le dessin 2D exact, avec WebGL sur le 3/4", () => {
    expect(defaultView("lavaux", true)).toBe("orbit");
    expect(defaultView("lavaux", false)).toBe("elevation");
    expect(defaultView("borne", false)).toBe("plan");
  });

  it("la barre altimétrique est celle du vase et du sous-verre (2 bandes au moins pour le sous-verre)", () => {
    expect(hasBandBar("lavaux")).toBe(true);
    expect(hasBandBar("relief")).toBe(true);
    expect(hasBandBar("cartouche")).toBe(false);
    expect(hasBandBar("borne")).toBe(false);
    expect(minBands("relief")).toBe(2);
    expect(minBands("lavaux")).toBe(1);
  });

  it("champs de texte : seulement ceux de l'objet, l'étiquette du sous-verre suit son interrupteur", () => {
    expect(textFieldsFor(LAVAUX_DEFAULT)).toEqual([]);
    expect(textFieldsFor(CARTOUCHE_DEFAULT)).toEqual([
      "name",
      "role",
      "line1",
      "line2",
    ]);
    expect(textFieldsFor(BORNE_DEFAULT)).toEqual(["text"]);
    expect(textFieldsFor(RELIEF_DEFAULT)).toEqual(["peak"]);
    expect(textFieldsFor({ ...RELIEF_DEFAULT, label: false })).toEqual([]);
    expect(hasTextFields(LAVAUX_DEFAULT)).toBe(false);
  });

  it("« Envoyer » exige au moins un caractère : un porte-nom ou une carte vide n'est jamais envoyé", () => {
    expect(missingText(LAVAUX_DEFAULT, {})).toBeNull();
    expect(missingText(CARTOUCHE_DEFAULT, {})).toBe("name");
    expect(missingText(CARTOUCHE_DEFAULT, { name: "   " })).toBe("name");
    expect(missingText(CARTOUCHE_DEFAULT, { name: "Léa" })).toBeNull();
    // Seule la fonction ne suffit pas : le nom est la seule exigence de la carte.
    expect(missingText(CARTOUCHE_DEFAULT, { role: "Architecte" })).toBe("name");
    expect(missingText(BORNE_DEFAULT, {})).toBe("text");
    expect(missingText(BORNE_DEFAULT, { text: "Léa" })).toBeNull();
    expect(missingText(RELIEF_DEFAULT, {})).toBe("peak");
    expect(missingText({ ...RELIEF_DEFAULT, label: false }, {})).toBeNull();
  });

  it("textes à imprimer : nettoyés, dans l'ordre des champs, champs vides omis", () => {
    expect(
      printedTexts(CARTOUCHE_DEFAULT, {
        line1: " a@b.ch ",
        name: "Léa  Dubois",
        role: "",
      }),
    ).toEqual([
      { field: "name", value: "Léa Dubois" },
      { field: "line1", value: "a@b.ch" },
    ]);
    expect(printedTexts(LAVAUX_DEFAULT, { name: "ignoré" })).toEqual([]);
  });

  it("un objet n'emporte pas les textes saisis pour un autre", () => {
    const all = { name: "Léa", peak: "Pointe", text: "Léa" };
    expect(textsForObject("cartouche", all)).toEqual({ name: "Léa" });
    expect(textsForObject("relief", all)).toEqual({ peak: "Pointe" });
    expect(textsForObject("lavaux", all)).toEqual({});
  });
});
