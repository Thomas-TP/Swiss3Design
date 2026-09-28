import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CREATIONS_KEY,
  MAX_CREATIONS,
  MAX_THUMBNAIL_BYTES,
  listCreations,
  removeCreation,
  saveCreation,
  subscribeCreations,
} from "./creations";

// localStorage en mémoire, avec un quota réglable (octets de valeurs).
function installBrowser({ quota = Infinity, blocked = false } = {}) {
  const store = new Map<string, string>();
  const win = new EventTarget();
  vi.stubGlobal("window", win);
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => {
      if (blocked) throw new Error("SecurityError");
      return store.get(k) ?? null;
    },
    setItem: (k: string, v: string) => {
      if (blocked || v.length > quota) throw new Error("QuotaExceededError");
      store.set(k, v);
    },
    removeItem: (k: string) => void store.delete(k),
  });
  return { store, win };
}

const input = (label = "Vase « Lavaux » · 150 mm") => ({
  object: "lavaux" as const,
  fragment: "#c=v1.eyJoIjoxNTB9",
  label,
});

const thumb = (bytes: number) =>
  `data:image/webp;base64,${"A".repeat(bytes - 23)}`;

afterEach(() => vi.unstubAllGlobals());

describe("sans navigateur ou sans stockage", () => {
  it("serveur : liste vide, rien n'est gardé", () => {
    expect(listCreations()).toEqual([]);
    expect(saveCreation(input())).toBeNull();
  });

  it("stockage bloqué : liste vide, saveCreation renvoie null", () => {
    installBrowser({ blocked: true });
    expect(listCreations()).toEqual([]);
    expect(saveCreation(input())).toBeNull();
    expect(() => removeCreation("x")).not.toThrow();
  });
});

describe("Mes créations", () => {
  let env: ReturnType<typeof installBrowser>;
  beforeEach(() => {
    env = installBrowser();
  });

  it("garde une création avec id et date, et la relit", () => {
    const saved = saveCreation({ ...input(), texts: { name: "Léa" } });
    expect(saved).toMatchObject({ object: "lavaux", texts: { name: "Léa" } });
    expect(saved?.id).toBeTruthy();
    expect(typeof saved?.savedAt).toBe("number");
    expect(listCreations()).toEqual([saved]);
  });

  it("12 au plus : la plus ancienne sort d'abord", () => {
    for (let i = 0; i < MAX_CREATIONS + 3; i++) saveCreation(input(`n°${i}`));
    const labels = listCreations().map((c) => c.label);
    expect(labels).toHaveLength(MAX_CREATIONS);
    expect(labels[0]).toBe("n°3");
    expect(labels.at(-1)).toBe(`n°${MAX_CREATIONS + 2}`);
  });

  it("vignette ≤ 60 Ko gardée, au-delà omise (la création reste)", () => {
    const small = saveCreation({
      ...input(),
      thumbnail: thumb(MAX_THUMBNAIL_BYTES),
    });
    const big = saveCreation({
      ...input(),
      thumbnail: thumb(MAX_THUMBNAIL_BYTES + 1),
    });
    expect(small?.thumbnail).toBeDefined();
    expect(big).not.toBeNull();
    expect(big?.thumbnail).toBeUndefined();
  });

  it("vignette qui n'est pas une image en data: URL : omise", () => {
    const saved = saveCreation({
      ...input(),
      thumbnail: "javascript:alert(1)",
    });
    expect(saved?.thumbnail).toBeUndefined();
  });

  it("objet inconnu : refusé", () => {
    expect(
      saveCreation({ ...input(), object: "vase-spirale" as never }),
    ).toBeNull();
  });

  it("stockage plein : les vignettes sautent avant de renoncer", () => {
    vi.unstubAllGlobals();
    env = installBrowser({ quota: 40_000 });
    const first = saveCreation({ ...input("a"), thumbnail: thumb(30_000) });
    expect(first?.thumbnail).toBeDefined();
    const second = saveCreation({ ...input("b"), thumbnail: thumb(30_000) });
    expect(second).not.toBeNull();
    const list = listCreations();
    expect(list.map((c) => c.label)).toEqual(["a", "b"]);
    // L'ancienne a perdu sa vignette pour faire de la place à la nouvelle.
    expect(list[0].thumbnail).toBeUndefined();
    expect(list[1].thumbnail).toBeDefined();
  });

  it("supprime par id", () => {
    const a = saveCreation(input("a"));
    const b = saveCreation(input("b"));
    removeCreation(a!.id);
    expect(listCreations()).toEqual([b]);
    removeCreation("inconnue");
    expect(listCreations()).toHaveLength(1);
  });

  it("même contenu stocké : même tableau (snapshot stable)", () => {
    saveCreation(input());
    expect(listCreations()).toBe(listCreations());
  });

  it("données corrompues ou hostiles : ignorées sans lever", () => {
    env.store.set(CREATIONS_KEY, "{pas du json");
    expect(listCreations()).toEqual([]);
    env.store.set(
      CREATIONS_KEY,
      JSON.stringify([
        { id: "ok", object: "relief", fragment: "", label: "R", savedAt: 1 },
        {
          id: "ok",
          object: "relief",
          fragment: "",
          label: "doublon",
          savedAt: 2,
        },
        { id: "x", object: "autre", fragment: "", label: "?", savedAt: 3 },
        { id: "y", object: "borne", fragment: 42, label: "?", savedAt: 4 },
        null,
        {
          id: "z",
          object: "borne",
          fragment: "",
          label: "B",
          savedAt: 5,
          texts: { text: "Léa", evil: "<script>" },
        },
      ]),
    );
    expect(listCreations().map((c) => c.id)).toEqual(["ok", "z"]);
    expect(listCreations()[1].texts).toEqual({ text: "Léa" });
  });

  it("prévient les abonnés : cet onglet et les autres", () => {
    const cb = vi.fn<() => void>();
    const off = subscribeCreations(cb);
    saveCreation(input());
    expect(cb).toHaveBeenCalledTimes(1);
    const storage = Object.assign(new Event("storage"), { key: CREATIONS_KEY });
    env.win.dispatchEvent(storage);
    const other = Object.assign(new Event("storage"), { key: "theme" });
    env.win.dispatchEvent(other);
    expect(cb).toHaveBeenCalledTimes(2);
    off();
    saveCreation(input());
    expect(cb).toHaveBeenCalledTimes(2);
  });
});
