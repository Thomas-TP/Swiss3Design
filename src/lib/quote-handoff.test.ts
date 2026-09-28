import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  QUOTE_HANDOFF_KEY,
  QUOTE_HANDOFF_TTL_MS,
  clearQuoteHandoff,
  parseQuoteHandoff,
  readQuoteHandoff,
  writeQuoteHandoff,
  type QuoteHandoff,
} from "./quote-handoff";

const NOW = Date.UTC(2026, 8, 28, 12);

function installBrowser({ quota = Infinity } = {}) {
  const store = new Map<string, string>();
  vi.stubGlobal("window", {});
  vi.stubGlobal("location", { origin: "https://swiss3design.ch" });
  vi.stubGlobal("sessionStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (v.length > quota) throw new Error("QuotaExceededError");
      store.set(k, v);
    },
    removeItem: (k: string) => void store.delete(k),
  });
  return store;
}

const handoff = (patch: Partial<QuoteHandoff> = {}): QuoteHandoff => ({
  v: 1,
  source: "studio",
  object: "lavaux",
  link: "/fr/studio/lavaux#c=v1.eyJoIjoxNTB9",
  prefill: {
    description: "[Studio] Vase « Lavaux » · configuration v1",
    material: "PLA",
    colors: "Bleu Léman 0–42 mm · Vert Lavaux 42–108 mm",
    dimensions: "96 × 96 × 150 mm",
  },
  attachment: {
    key: "quotes/0b7e-s3d-lavaux-1a2b3c4d.stl",
    name: "s3d-lavaux-1a2b3c4d.stl",
    bytes: 2_921_084,
    triangles: 58_420,
  },
  thumbnail: "data:image/webp;base64,UklGRg==",
  createdAt: NOW,
  ...patch,
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("passage Studio → /custom", () => {
  it("serveur : rien à lire, rien d'écrit", () => {
    expect(writeQuoteHandoff(handoff())).toBe(false);
    expect(readQuoteHandoff()).toBeNull();
  });

  it("écrit puis relit à l'identique", () => {
    const store = installBrowser();
    expect(writeQuoteHandoff(handoff())).toBe(true);
    expect(store.has(QUOTE_HANDOFF_KEY)).toBe(true);
    expect(readQuoteHandoff()).toEqual(handoff());
    clearQuoteHandoff();
    expect(readQuoteHandoff()).toBeNull();
  });

  it("expire après 24 h (durée du cookie de l'upload) et s'efface", () => {
    const store = installBrowser();
    writeQuoteHandoff(handoff());
    vi.setSystemTime(NOW + QUOTE_HANDOFF_TTL_MS - 1);
    expect(readQuoteHandoff()).not.toBeNull();
    vi.setSystemTime(NOW + QUOTE_HANDOFF_TTL_MS + 1);
    expect(readQuoteHandoff()).toBeNull();
    expect(store.has(QUOTE_HANDOFF_KEY)).toBe(false);
  });

  it("sans pièce jointe ni vignette : valide", () => {
    installBrowser();
    const bare = handoff({ attachment: undefined, thumbnail: undefined });
    expect(writeQuoteHandoff(bare)).toBe(true);
    const read = readQuoteHandoff();
    expect(read?.attachment).toBeUndefined();
    expect(read?.thumbnail).toBeUndefined();
  });

  it("stockage plein : réécrit sans la vignette", () => {
    const store = installBrowser({ quota: 600 });
    const heavy = handoff({
      thumbnail: `data:image/webp;base64,${"A".repeat(400)}`,
    });
    expect(writeQuoteHandoff(heavy)).toBe(true);
    expect(JSON.parse(store.get(QUOTE_HANDOFF_KEY)!).thumbnail).toBeUndefined();
  });

  it("JSON corrompu : null, et l'entrée est effacée", () => {
    const store = installBrowser();
    store.set(QUOTE_HANDOFF_KEY, "{oups");
    expect(readQuoteHandoff()).toBeNull();
    expect(store.has(QUOTE_HANDOFF_KEY)).toBe(false);
  });
});

describe("validation (donnée non fiable)", () => {
  beforeEach(() => void installBrowser());

  it.each([
    ["version inconnue", { v: 2 }],
    ["source autre que studio", { source: "form" }],
    ["objet inconnu (Vase spirale)", { object: "vase-spirale" }],
    ["lien javascript:", { link: "javascript:alert(1)" }],
    ["lien protocole-relatif", { link: "//evil.example/fr/studio" }],
    ["lien \\ détourné", { link: "/\\evil.example" }],
    ["lien d'une autre origine", { link: "https://evil.example/fr/studio" }],
    ["lien vide", { link: "" }],
    ["createdAt dans le futur", { createdAt: NOW + 60 * 60 * 1000 }],
    ["createdAt absent", { createdAt: undefined }],
  ])("refuse : %s", (_label, patch) => {
    expect(parseQuoteHandoff({ ...handoff(), ...patch }, NOW)).toBeNull();
  });

  it.each([
    ["description > 4000", { description: "x".repeat(4001) }],
    ["couleurs > 200", { colors: "x".repeat(201) }],
    ["dimensions > 200", { dimensions: "x".repeat(201) }],
    ["matière autre que PLA", { material: "PETG" }],
  ])(
    "refuse un préremplissage hors limites de la Server Action : %s",
    (_l, p) => {
      const value = { ...handoff(), prefill: { ...handoff().prefill, ...p } };
      expect(parseQuoteHandoff(value, NOW)).toBeNull();
      expect(writeQuoteHandoff(value as QuoteHandoff)).toBe(false);
    },
  );

  it.each([
    ["clé hors de quotes/", { key: "products/x.stl" }],
    ["nom vide", { name: "" }],
    ["triangles non entiers", { triangles: 1.5 }],
    ["taille négative", { bytes: -1 }],
  ])("refuse une pièce jointe douteuse : %s", (_label, patch) => {
    const value = {
      ...handoff(),
      attachment: { ...handoff().attachment!, ...patch },
    };
    expect(parseQuoteHandoff(value, NOW)).toBeNull();
  });

  it("accepte l'URL absolue de la même origine", () => {
    const link = "https://swiss3design.ch/fr/studio/lavaux#c=v1.e30";
    expect(parseQuoteHandoff(handoff({ link }), NOW)?.link).toBe(link);
  });

  it("vignette hors format : omise, le reste passe", () => {
    const parsed = parseQuoteHandoff(
      handoff({ thumbnail: "blob:https://swiss3design.ch/1" }),
      NOW,
    );
    expect(parsed).not.toBeNull();
    expect(parsed?.thumbnail).toBeUndefined();
  });

  it("champs inconnus : écartés", () => {
    const parsed = parseQuoteHandoff(
      { ...handoff(), texts: { name: "Léa" } },
      NOW,
    );
    expect(parsed).not.toHaveProperty("texts");
  });
});
