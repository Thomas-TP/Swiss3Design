import { afterEach, describe, expect, it, vi } from "vitest";
import {
  STUDIO_TEXTS_KEY,
  clearStudioTexts,
  readStudioTexts,
  sanitizeStudioTexts,
  writeStudioTexts,
} from "./texts-store";

function installBrowser({ blocked = false } = {}) {
  const store = new Map<string, string>();
  vi.stubGlobal("window", {});
  vi.stubGlobal("sessionStorage", {
    getItem: (k: string) => {
      if (blocked) throw new Error("SecurityError");
      return store.get(k) ?? null;
    },
    setItem: (k: string, v: string) => {
      if (blocked) throw new Error("QuotaExceededError");
      store.set(k, v);
    },
    removeItem: (k: string) => void store.delete(k),
  });
  return store;
}

afterEach(() => vi.unstubAllGlobals());

describe("textes du Studio (sessionStorage)", () => {
  it("serveur : rien à lire, rien d'écrit", () => {
    expect(readStudioTexts("cartouche")).toEqual({});
    expect(() => writeStudioTexts("cartouche", { name: "Léa" })).not.toThrow();
  });

  it("par objet : écrire, relire, effacer", () => {
    const store = installBrowser();
    writeStudioTexts("cartouche", { name: "Léa Dubois", role: "Architecte" });
    writeStudioTexts("borne", { text: "Léa" });
    expect(readStudioTexts("cartouche")).toEqual({
      name: "Léa Dubois",
      role: "Architecte",
    });
    expect(readStudioTexts("relief")).toEqual({});
    expect(JSON.parse(store.get(STUDIO_TEXTS_KEY)!)).toEqual({
      cartouche: { name: "Léa Dubois", role: "Architecte" },
      borne: { text: "Léa" },
    });
    clearStudioTexts("cartouche");
    expect(readStudioTexts("cartouche")).toEqual({});
    expect(readStudioTexts("borne")).toEqual({ text: "Léa" });
    clearStudioTexts();
    expect(store.has(STUDIO_TEXTS_KEY)).toBe(false);
  });

  it("un champ vidé reste vide (on ne ressuscite pas l'exemple)", () => {
    installBrowser();
    writeStudioTexts("relief", { peak: "" });
    expect(readStudioTexts("relief")).toEqual({ peak: "" });
  });

  it("aucune clé : l'entrée de l'objet disparaît", () => {
    const store = installBrowser();
    writeStudioTexts("borne", { text: "Léa" });
    writeStudioTexts("borne", {});
    expect(store.has(STUDIO_TEXTS_KEY)).toBe(false);
  });

  it("renvoie une copie : muter le résultat ne touche pas le stockage", () => {
    installBrowser();
    writeStudioTexts("borne", { text: "Léa" });
    const texts = readStudioTexts("borne");
    texts.text = "Autre";
    expect(readStudioTexts("borne")).toEqual({ text: "Léa" });
  });

  it("stockage bloqué : jamais d'exception", () => {
    installBrowser({ blocked: true });
    expect(() => writeStudioTexts("borne", { text: "Léa" })).not.toThrow();
    expect(readStudioTexts("borne")).toEqual({});
    expect(() => clearStudioTexts()).not.toThrow();
  });

  it("données corrompues ou hostiles : filtrées", () => {
    const store = installBrowser();
    store.set(STUDIO_TEXTS_KEY, "[1,2]");
    expect(readStudioTexts("borne")).toEqual({});
    store.set(
      STUDIO_TEXTS_KEY,
      JSON.stringify({
        borne: { text: "Léa", html: "<b>", role: 42 },
        "vase-spirale": { text: "x" },
      }),
    );
    expect(readStudioTexts("borne")).toEqual({ text: "Léa" });
    store.set(STUDIO_TEXTS_KEY, "{oups");
    expect(readStudioTexts("borne")).toEqual({});
  });
});

describe("sanitizeStudioTexts", () => {
  it("ne garde que les clés connues, en chaînes bornées", () => {
    expect(sanitizeStudioTexts(null)).toBeUndefined();
    expect(sanitizeStudioTexts({ foo: "bar" })).toBeUndefined();
    const long = "x".repeat(500);
    expect(sanitizeStudioTexts({ name: long, line1: 3 })?.name).toHaveLength(
      120,
    );
  });
});
