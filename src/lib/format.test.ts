import { describe, it, expect } from "vitest";
import { formatChf } from "./format";

// Les locales suisses utilisent l'espace insécable comme séparateur ; on le
// normalise pour des assertions stables.
const norm = (s: string) => s.replace(/[  ]/g, " ");

describe("formatChf", () => {
  it("formate des centimes en CHF avec 2 décimales", () => {
    const out = norm(formatChf(1234, "fr"));
    expect(out).toContain("CHF");
    expect(out).toContain("12.34");
  });

  it("gère zéro", () => {
    expect(norm(formatChf(0, "de"))).toContain("0.00");
  });

  it("formate les milliers", () => {
    expect(norm(formatChf(123456, "fr"))).toContain("234.56");
  });
});
