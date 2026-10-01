import { describe, expect, it } from "vitest";
import { QuoteUploadError } from "@/lib/quote-upload-client";
import {
  attemptSubmit,
  formatBytes,
  formatCount,
  formatPercent,
  submitSteps,
  uploadErrorKey,
  userMessageOf,
} from "./quote-logic";

describe("attemptSubmit", () => {
  it("rend l'état de l'action quand elle répond", async () => {
    const outcome = await attemptSubmit(async () => ({ status: "success" }));
    expect(outcome).toEqual({ ok: true, state: { status: "success" } });
  });

  it("transforme une action qui échoue au niveau réseau en valeur", async () => {
    const failure = new TypeError("Failed to fetch");
    const outcome = await attemptSubmit(async () => {
      throw failure;
    });
    expect(outcome).toEqual({ ok: false, error: failure });
  });

  it("attrape aussi une erreur levée avant la première attente", async () => {
    const failure = new Error("An unexpected response was received");
    const outcome = await attemptSubmit(() => {
      throw failure;
    });
    expect(outcome).toEqual({ ok: false, error: failure });
  });
});

describe("uploadErrorKey", () => {
  it("reprend le code d'une QuoteUploadError", () => {
    expect(uploadErrorKey(new QuoteUploadError(429, 429))).toBe(429);
    expect(uploadErrorKey(new QuoteUploadError(413))).toBe(413);
    expect(uploadErrorKey(new QuoteUploadError(415))).toBe(415);
    expect(uploadErrorKey(new QuoteUploadError(400, 400))).toBe(400);
    expect(uploadErrorKey(new QuoteUploadError("network"))).toBe("network");
  });

  it("range toute autre erreur sous « unknown »", () => {
    expect(uploadErrorKey(new Error("boom"))).toBe("unknown");
    expect(uploadErrorKey("429")).toBe("unknown");
    expect(uploadErrorKey(undefined)).toBe("unknown");
  });
});

describe("userMessageOf", () => {
  it("lit la propriété userMessage d'une erreur du Studio", () => {
    const error = Object.assign(new Error("export"), {
      userMessage: "La configuration n'est pas imprimable.",
    });
    expect(userMessageOf(error)).toBe("La configuration n'est pas imprimable.");
  });

  it("ignore une valeur absente, vide ou qui n'est pas une chaîne", () => {
    expect(userMessageOf(new Error("x"))).toBeNull();
    expect(userMessageOf({ userMessage: "  " })).toBeNull();
    expect(userMessageOf({ userMessage: 42 })).toBeNull();
    expect(userMessageOf(null)).toBeNull();
    expect(userMessageOf("texte")).toBeNull();
  });
});

describe("formats suisses", () => {
  it("écrit les mégaoctets avec l'unité de la locale", () => {
    expect(formatBytes(2.9 * 1024 * 1024, "fr")).toMatch(/^2,9\s?Mo$/);
    expect(formatBytes(2.9 * 1024 * 1024, "de")).toMatch(/^2\.9\s?MB$/);
    expect(formatBytes(30 * 1024 * 1024, "fr")).toMatch(/^30\s?Mo$/);
  });

  it("passe en kilo-octets sous 100 Kio", () => {
    expect(formatBytes(4096, "fr")).toMatch(/^4\s?ko$/);
    expect(formatBytes(4096, "en")).toMatch(/^4\s?kB$/);
  });

  it("formate pourcentage et entiers par locale, bornés à 0–100 %", () => {
    expect(formatPercent(0.42, "fr")).toMatch(/^42\s?%$/);
    expect(formatPercent(1.4, "en")).toBe("100%");
    expect(formatPercent(-1, "en")).toBe("0%");
    // Le séparateur de milliers est celui de ICU pour `${locale}-CH` (espace
    // fine ou apostrophe selon la version des données CLDR) : on ne le fige pas.
    expect(formatCount(58420, "fr")).toMatch(/^58[\s’']420$/);
    expect(formatCount(58420, "de")).toMatch(/^58[\s’']420$/);
  });
});

describe("submitSteps", () => {
  it("compte trois étapes seulement quand le fichier se prépare à l'envoi", () => {
    expect(submitSteps(true)).toBe(3);
    expect(submitSteps(false)).toBe(1);
  });
});
