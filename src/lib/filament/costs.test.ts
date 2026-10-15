import { describe, expect, it } from "vitest";
import { summarizeCosts } from "./costs";

const spool = (
  id: string,
  costCents: number | null,
  remainingGrams: number,
  status: "ordered" | "in_stock" | "empty" | "retired" = "in_stock",
) => ({ id, costCents, initialGrams: 1000, remainingGrams, status });

describe("summarizeCosts", () => {
  it("coût moyen au kilo réel : somme payée / somme des grammes", () => {
    const s = summarizeCosts(
      [spool("a", 1200, 500), spool("b", 2000, 1000), spool("c", null, 400)],
      [],
    );
    expect(s.avgCentsPerKg).toBe(1600);
    expect(s.stockWithoutCost).toBe(1);
  });

  it("une bobine commandée n'entre pas dans le coût moyen ni dans la valeur", () => {
    const s = summarizeCosts([spool("a", 1000, 1000, "ordered")], []);
    expect(s.avgCentsPerKg).toBeNull();
    expect(s.stockValueCents).toBe(0);
  });

  it("valeur du stock : restant × coût au gramme de chaque bobine", () => {
    const s = summarizeCosts(
      [spool("a", 1200, 500), spool("b", 2000, 250)],
      [],
    );
    expect(s.stockValueCents).toBe(600 + 500);
  });

  it("consommation par mois, valorisée au coût de la bobine, la plus récente d'abord", () => {
    const s = summarizeCosts(
      [spool("a", 2000, 500)],
      [
        { spoolId: "a", grams: 100, at: new Date("2026-09-30T10:00:00Z") },
        { spoolId: "a", grams: 50, at: new Date("2026-10-02T10:00:00Z") },
        { spoolId: "a", grams: 25, at: new Date("2026-10-20T10:00:00Z") },
      ],
    );
    expect(s.monthly).toEqual([
      { month: "2026-10", grams: 75, costCents: 150 },
      { month: "2026-09", grams: 100, costCents: 200 },
    ]);
  });
});
