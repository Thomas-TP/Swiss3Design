import { describe, expect, it } from "vitest";
import { isMissingTable } from "./stock-db";

describe("isMissingTable : la migration du stock n'est pas appliquée", () => {
  it("reconnaît le code Postgres 42P01, direct ou dans la cause (Drizzle enveloppe l'erreur)", () => {
    expect(isMissingTable({ code: "42P01" })).toBe(true);
    expect(
      isMissingTable(
        Object.assign(new Error("Failed query"), { cause: { code: "42P01" } }),
      ),
    ).toBe(true);
  });
  it("ne masque aucune autre erreur", () => {
    expect(isMissingTable({ code: "23505" })).toBe(false);
    expect(isMissingTable(new Error("boom"))).toBe(false);
    expect(isMissingTable(null)).toBe(false);
  });
});
