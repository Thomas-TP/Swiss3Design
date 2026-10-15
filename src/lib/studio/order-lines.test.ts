import { describe, expect, it, vi } from "vitest";
import type { Translate } from "@/components/studio/summary";
import { resolveStudioLines } from "./order-lines";
import { BORNE_DEFAULT, CARTOUCHE_DEFAULT, LAVAUX_DEFAULT } from "./presets";
import { studioLineInputSchema, type StudioLineInput } from "./purchase";
import type { StudioConfig } from "./types";

const core: Translate = (key) =>
  key === "objects.borne.name"
    ? "Porte-nom « Borne »"
    : key === "objects.lavaux.name"
      ? "Vase « Lavaux »"
      : key === "units.dimensions"
        ? "{width} × {depth} × {height} mm"
        : key;

function input(
  config: StudioConfig,
  texts: Record<string, string>,
  extra: Partial<StudioLineInput> = {},
): StudioLineInput {
  return studioLineInputSchema.parse({
    kind: "studio",
    id: "c1",
    object: config.object,
    config: JSON.parse(JSON.stringify(config)),
    texts,
    locale: "fr",
    quantity: 1,
    ...extra,
  });
}

describe("résolution des lignes du Studio au paiement", () => {
  it("recalcule le prix, bâtit le libellé SANS texte saisi et renvoie l'instantané", () => {
    const result = resolveStudioLines(
      [input(BORNE_DEFAULT, { text: "Léa" }, { quantity: 3 })],
      core,
      "fr",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [line] = result.lines;
    expect(line.unitCents).toBeGreaterThan(0);
    expect(line.lineCents).toBe(line.unitCents * 3);
    expect(line.name).toMatch(/^Porte-nom « Borne » · /);
    expect(line.name).not.toContain("Léa");
    expect(line.snapshot.texts).toEqual({ text: "Léa" });
  });

  it("accepte un prix affiché identique et refuse (409) un prix affiché différent, avec les prix du serveur", () => {
    const ok = resolveStudioLines(
      [input(LAVAUX_DEFAULT, {}, { expectedUnitCents: 4490 })],
      core,
      "fr",
    );
    expect(ok.ok).toBe(true);
    const drift = resolveStudioLines(
      [input(LAVAUX_DEFAULT, {}, { expectedUnitCents: 4390 })],
      core,
      "fr",
    );
    expect(drift).toMatchObject({
      ok: false,
      status: 409,
      body: { error: "price_changed", lines: [{ id: "c1", unitCents: 4490 }] },
    });
  });

  it("sans prix affiché (client sans cet envoi), le prix du serveur s'applique", () => {
    const result = resolveStudioLines([input(LAVAUX_DEFAULT, {})], core, "fr");
    expect(result.ok && result.lines[0].unitCents).toBe(4490);
  });

  it("refuse tout le paiement à la première ligne invalide (400 / 422), sans jamais renvoyer un texte", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const invalid = resolveStudioLines(
      [input(LAVAUX_DEFAULT, {}), input(CARTOUCHE_DEFAULT, {}, { id: "c2" })],
      core,
      "fr",
    );
    expect(invalid).toMatchObject({
      ok: false,
      status: 400,
      body: { error: "studio_invalid", lineId: "c2", reason: "text_missing" },
    });
    const unprintable = resolveStudioLines(
      [input(BORNE_DEFAULT, { text: "Léa ✦" })],
      core,
      "fr",
    );
    expect(unprintable).toMatchObject({
      ok: false,
      status: 422,
      body: { error: "studio_unprintable", issues: ["text-char"] },
    });
    expect(JSON.stringify(unprintable)).not.toContain("Léa");
    // Le journal ne contient ni texte saisi ni configuration.
    expect(JSON.stringify(warn.mock.calls)).not.toContain("Léa");
    warn.mockRestore();
  });
});
