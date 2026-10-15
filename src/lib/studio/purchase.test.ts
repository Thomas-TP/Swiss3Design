import { describe, expect, it } from "vitest";
import {
  BORNE_DEFAULT,
  CARTOUCHE_DEFAULT,
  LAVAUX_DEFAULT,
  MONTAGNE_DEFAULT,
} from "./presets";
import {
  readStudioOrderLine,
  studioDigest,
  studioLineInputSchema,
  validateStudioLine,
  type StudioLineInput,
} from "./purchase";
import { studioLineId } from "./line-id";
import { computeStats } from "./stats";
import { DEFAULT_TEXTS } from "./text/fields";
import { purchaseTexts } from "./text/rules";
import type { StudioConfig } from "./types";

function input(
  config: StudioConfig,
  texts: StudioLineInput["texts"] = {},
  extra: Partial<StudioLineInput> = {},
): StudioLineInput {
  return studioLineInputSchema.parse({
    kind: "studio",
    object: config.object,
    config: JSON.parse(JSON.stringify(config)),
    texts,
    locale: "fr",
    quantity: 1,
    ...extra,
  });
}

describe("schéma de la ligne reçue", () => {
  it("accepte une ligne valide et renvoie l'identité du navigateur", () => {
    const line = input(LAVAUX_DEFAULT, {}, { id: "abc" });
    expect(line.id).toBe("abc");
    expect(line.quantity).toBe(1);
  });

  it("refuse les clés inconnues, les quantités hors 1..20 et les textes trop longs", () => {
    const base = {
      kind: "studio",
      object: "lavaux",
      config: LAVAUX_DEFAULT,
      texts: {},
      locale: "fr",
      quantity: 1,
    };
    expect(studioLineInputSchema.safeParse({ ...base, extra: 1 }).success).toBe(
      false,
    );
    expect(
      studioLineInputSchema.safeParse({ ...base, quantity: 0 }).success,
    ).toBe(false);
    expect(
      studioLineInputSchema.safeParse({ ...base, quantity: 21 }).success,
    ).toBe(false);
    expect(
      studioLineInputSchema.safeParse({ ...base, quantity: 1.5 }).success,
    ).toBe(false);
    expect(
      studioLineInputSchema.safeParse({
        ...base,
        texts: { name: "x".repeat(129) },
      }).success,
    ).toBe(false);
    expect(
      studioLineInputSchema.safeParse({ ...base, texts: { hack: "x" } })
        .success,
    ).toBe(false);
    expect(
      studioLineInputSchema.safeParse({ ...base, object: "vase" }).success,
    ).toBe(false);
    expect(
      studioLineInputSchema.safeParse({ ...base, locale: "es" }).success,
    ).toBe(false);
  });
});

describe("validateStudioLine", () => {
  it("valide les quatre objets par défaut et recalcule les prix attendus", () => {
    const cases: [StudioConfig, StudioLineInput["texts"], number][] = [
      [LAVAUX_DEFAULT, {}, 4490],
      [CARTOUCHE_DEFAULT, DEFAULT_TEXTS.cartouche, 1790],
      [MONTAGNE_DEFAULT, DEFAULT_TEXTS.montagne, 4990],
      [BORNE_DEFAULT, DEFAULT_TEXTS.borne, 2490],
    ];
    for (const [config, texts, unitCents] of cases) {
      const result = validateStudioLine(input(config, texts));
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.line.unitCents).toBe(unitCents);
      expect(result.line.lineCents).toBe(unitCents);
      expect(result.line.snapshot.v).toBe(1);
      expect(result.line.snapshot.price.unitCents).toBe(unitCents);
      expect(result.line.hash).toMatch(/^[0-9a-f]{8}$/);
    }
  });

  it("le prix de la ligne suit la quantité (Cartouche 10 × 4.90)", () => {
    const result = validateStudioLine(
      input(CARTOUCHE_DEFAULT, DEFAULT_TEXTS.cartouche, { quantity: 10 }),
    );
    expect(result.ok && result.line.unitCents).toBe(490);
    expect(result.ok && result.line.lineCents).toBe(4900);
  });

  it("le prix ne dépend pas de la langue envoyée", () => {
    const prices = (["fr", "de", "it", "en"] as const).map((locale) => {
      const r = validateStudioLine(
        input(MONTAGNE_DEFAULT, { peak: "Cervin" }, { locale }),
      );
      return r.ok ? r.line.unitCents : -1;
    });
    expect(new Set(prices).size).toBe(1);
  });

  it("refuse une configuration hors plage ou de forme inconnue", () => {
    const tooTall = { ...LAVAUX_DEFAULT, h: 5000 };
    expect(validateStudioLine(input(tooTall as StudioConfig))).toMatchObject({
      ok: false,
      error: "invalid_config",
    });
    const unknown = {
      ...CARTOUCHE_DEFAULT,
      hack: true,
    } as unknown as StudioConfig;
    expect(
      validateStudioLine(input(unknown, DEFAULT_TEXTS.cartouche)),
    ).toMatchObject({ ok: false, error: "invalid_config" });
  });

  it("refuse une configuration qui n'est pas sous sa forme bornée (canonique)", () => {
    // Un vase de 100 mm de haut : valide au schéma, mais les bandes ne finissent pas à h.
    const bad = { ...LAVAUX_DEFAULT, h: 100 };
    const result = validateStudioLine(input(bad as StudioConfig));
    expect(result.ok).toBe(false);
  });

  it("exige un texte quand l'objet en demande un", () => {
    expect(validateStudioLine(input(CARTOUCHE_DEFAULT, {}))).toMatchObject({
      ok: false,
      error: "text_missing",
      issues: ["name"],
    });
    expect(
      validateStudioLine(input(BORNE_DEFAULT, { text: "  " })),
    ).toMatchObject({
      ok: false,
      error: "text_missing",
    });
    expect(validateStudioLine(input(MONTAGNE_DEFAULT, {}))).toMatchObject({
      ok: false,
      error: "text_missing",
    });
  });

  it("une Montagne sans étiquette n'exige aucun texte et n'en garde aucun", () => {
    const config = { ...MONTAGNE_DEFAULT, label: false };
    const result = validateStudioLine(input(config, { peak: "Cervin" }));
    expect(result.ok).toBe(true);
    expect(result.ok && result.line.texts).toEqual({});
  });

  it("refuse un caractère non imprimable et un texte trop long, sans jamais renvoyer le texte", () => {
    const emoji = validateStudioLine(input(BORNE_DEFAULT, { text: "Léa ✦" }));
    expect(emoji).toMatchObject({ ok: false, error: "unprintable" });
    expect(emoji).toHaveProperty(
      "issues",
      expect.arrayContaining(["text-char"]),
    );
    expect(JSON.stringify(emoji)).not.toContain("Léa");
    const long = validateStudioLine(
      input(CARTOUCHE_DEFAULT, { name: "N".repeat(40) }),
    );
    expect(long).toMatchObject({ ok: false, error: "unprintable" });
  });

  it("garde des textes nettoyés (NFC, espaces) et limités aux champs de l'objet", () => {
    const result = validateStudioLine(
      input(BORNE_DEFAULT, { text: "  Léa  ", name: "ignoré" } as never),
    );
    expect(result.ok).toBe(true);
    expect(result.ok && result.line.texts).toEqual({ text: "Léa" });
  });

  it("le prix recalculé est celui de purchaseTexts + computeStats en français", () => {
    const texts = { name: "Élodie Müller", role: "Ingénieure" };
    const result = validateStudioLine(input(CARTOUCHE_DEFAULT, texts));
    const stats = computeStats(
      CARTOUCHE_DEFAULT,
      purchaseTexts(CARTOUCHE_DEFAULT, texts),
      undefined,
      "fr",
    );
    expect(result.ok && result.line.snapshot.stats.grams).toBe(stats.grams);
    expect(result.ok && result.line.snapshot.stats.changes).toBe(stats.changes);
  });

  it("l'identité recalculée est celle du navigateur (même fonction, même empreinte)", () => {
    const texts = { text: "Léa" };
    const result = validateStudioLine(input(BORNE_DEFAULT, texts));
    expect(result.ok && result.line.id).toBe(
      studioLineId(BORNE_DEFAULT, texts, "fr"),
    );
  });
});

describe("empreinte de reprise et relecture", () => {
  it("le condensé ne contient aucun texte saisi et change avec le texte et la quantité", async () => {
    const a = await studioDigest(input(BORNE_DEFAULT, { text: "Léa" }));
    const b = await studioDigest(input(BORNE_DEFAULT, { text: "Lea" }));
    const c = await studioDigest(
      input(BORNE_DEFAULT, { text: "Léa" }, { quantity: 2 }),
    );
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(new Set([a, b, c]).size).toBe(3);
    expect(a).not.toContain("Léa");
  });

  it("readStudioOrderLine relit défensivement le jsonb de la base", () => {
    const result = validateStudioLine(input(BORNE_DEFAULT, { text: "Léa" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const stored = JSON.parse(JSON.stringify(result.line.snapshot));
    expect(readStudioOrderLine(stored)).toEqual(stored);
    expect(readStudioOrderLine(null)).toBeNull();
    expect(readStudioOrderLine({ v: 2 })).toBeNull();
    expect(readStudioOrderLine({ ...stored, object: "vase" })).toBeNull();
    expect(readStudioOrderLine([])).toBeNull();
  });
});
