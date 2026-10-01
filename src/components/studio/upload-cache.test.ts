import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  CARTOUCHE_DEFAULT,
  LAVAUX_DEFAULT,
  RELIEF_DEFAULT,
} from "@/lib/studio/presets";
import { installFakeSession } from "./testing";
import {
  UPLOAD_CACHE_KEY,
  UPLOAD_CACHE_TTL_MS,
  clearCachedUploads,
  readCachedUpload,
  uploadHash,
  writeCachedUpload,
} from "./upload-cache";

const entry = (at: number, key = "quotes/abc-s3d-lavaux-0123abcd.stl") => ({
  key,
  name: "s3d-lavaux-0123abcd.stl",
  bytes: 2_600_000,
  triangles: 52_000,
  at,
});

describe("mémoire des envois (§6.8)", () => {
  let session: ReturnType<typeof installFakeSession>;
  beforeEach(() => {
    session = installFakeSession();
  });
  afterEach(() => session.uninstall());

  it("l'empreinte est FNV-1a 64 (16 hexadécimaux) de la configuration et des textes nettoyés", () => {
    const h = uploadHash(LAVAUX_DEFAULT, {}, "fr");
    expect(h).toMatch(/^[0-9a-f]{16}$/);
    expect(uploadHash(LAVAUX_DEFAULT, {}, "fr")).toBe(h);
    expect(uploadHash({ ...LAVAUX_DEFAULT, h: 151 }, {}, "fr")).not.toBe(h);
    // Les textes d'un autre objet, les espaces de bord et les doubles espaces ne changent pas l'empreinte.
    expect(uploadHash(LAVAUX_DEFAULT, { name: "autre objet" }, "fr")).toBe(h);
    expect(uploadHash(CARTOUCHE_DEFAULT, { name: " Léa  Dubois " }, "fr")).toBe(
      uploadHash(CARTOUCHE_DEFAULT, { name: "Léa Dubois" }, "fr"),
    );
    expect(uploadHash(CARTOUCHE_DEFAULT, { name: "Léa" }, "fr")).not.toBe(
      uploadHash(CARTOUCHE_DEFAULT, { name: "Léo" }, "fr"),
    );
  });

  it("la langue n'entre dans l'empreinte que pour l'étiquette du sous-verre", () => {
    expect(uploadHash(LAVAUX_DEFAULT, {}, "fr")).toBe(
      uploadHash(LAVAUX_DEFAULT, {}, "de"),
    );
    expect(uploadHash(RELIEF_DEFAULT, { peak: "Léa" }, "fr")).not.toBe(
      uploadHash(RELIEF_DEFAULT, { peak: "Léa" }, "de"),
    );
    expect(uploadHash(RELIEF_DEFAULT, {}, "fr")).toBe(
      uploadHash(RELIEF_DEFAULT, {}, "de"),
    );
  });

  it("un envoi est retrouvé tel quel, puis expire après 24 h", () => {
    const hash = uploadHash(LAVAUX_DEFAULT, {}, "fr");
    const now = 1_700_000_000_000;
    expect(readCachedUpload(hash, now)).toBeNull();
    writeCachedUpload(hash, entry(now), now);
    expect(readCachedUpload(hash, now + 1000)).toEqual(entry(now));
    expect(readCachedUpload(hash, now + UPLOAD_CACHE_TTL_MS)).toEqual(
      entry(now),
    );
    expect(readCachedUpload(hash, now + UPLOAD_CACHE_TTL_MS + 1)).toBeNull();
  });

  it("garde 12 envois au plus, les plus anciens sortent d'abord", () => {
    const now = 1_700_000_000_000;
    for (let i = 0; i < 15; i++) {
      const hash = i.toString(16).padStart(16, "0");
      writeCachedUpload(hash, entry(now + i), now + i);
    }
    const stored = JSON.parse(session.store.get(UPLOAD_CACHE_KEY)!);
    expect(Object.keys(stored)).toHaveLength(12);
    expect(readCachedUpload("0".repeat(16), now + 20)).toBeNull();
    expect(
      readCachedUpload((14).toString(16).padStart(16, "0"), now + 20),
    ).not.toBeNull();
  });

  it("une donnée douteuse du stockage est ignorée (clé hors quotes/, empreinte mal formée, date future)", () => {
    const now = 1_700_000_000_000;
    session.store.set(
      UPLOAD_CACHE_KEY,
      JSON.stringify({
        "0123456789abcdef": entry(now, "https://evil.example/x.stl"),
        nope: entry(now),
        fedcba9876543210: entry(now + 3_600_000),
      }),
    );
    expect(readCachedUpload("0123456789abcdef", now)).toBeNull();
    expect(readCachedUpload("fedcba9876543210", now)).toBeNull();
    session.store.set(UPLOAD_CACHE_KEY, "{pas du json");
    expect(readCachedUpload("0123456789abcdef", now)).toBeNull();
  });

  it("clearCachedUploads vide la mémoire", () => {
    const hash = uploadHash(LAVAUX_DEFAULT, {}, "fr");
    writeCachedUpload(hash, entry(Date.now()));
    clearCachedUploads();
    expect(readCachedUpload(hash)).toBeNull();
  });
});
