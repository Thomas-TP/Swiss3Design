import { describe, it, expect } from "vitest";
import { validateDiscount } from "./discounts";

type Row = Record<string, unknown>;

// Mini-mock du builder Drizzle : .select().from().where().limit() → [row].
// validateDiscount n'utilise la DB que pour lire la ligne du code promo.
function mockDb(row: Row | null) {
  const result = row ? [row] : [];
  const chain = {
    select: () => chain,
    from: () => chain,
    where: () => chain,
    limit: async () => result,
  };
  return chain as unknown as Parameters<typeof validateDiscount>[0];
}

const base = {
  code: "PROMO10",
  type: "percent" as const,
  value: 10,
  minSubtotalCents: null as number | null,
  maxUses: null as number | null,
  usedCount: 0,
  active: true,
  expiresAt: null as Date | null,
};

describe("validateDiscount", () => {
  it("applique un pourcentage (arrondi au centime)", async () => {
    const r = await validateDiscount(mockDb(base), "promo10", 1999);
    expect(r).toEqual({ code: "PROMO10", discountCents: 200 });
  });

  it("plafonne un montant fixe au sous-total", async () => {
    const r = await validateDiscount(
      mockDb({ ...base, type: "fixed", value: 5000 }),
      "X",
      3000,
    );
    expect(r?.discountCents).toBe(3000);
  });

  it("refuse un code inconnu", async () => {
    expect(await validateDiscount(mockDb(null), "NOPE", 5000)).toBeNull();
  });

  it("refuse un code inactif", async () => {
    expect(
      await validateDiscount(mockDb({ ...base, active: false }), "X", 5000),
    ).toBeNull();
  });

  it("refuse un code expiré", async () => {
    expect(
      await validateDiscount(
        mockDb({ ...base, expiresAt: new Date(Date.now() - 1000) }),
        "X",
        5000,
      ),
    ).toBeNull();
  });

  it("refuse un code épuisé", async () => {
    expect(
      await validateDiscount(
        mockDb({ ...base, maxUses: 5, usedCount: 5 }),
        "X",
        5000,
      ),
    ).toBeNull();
  });

  it("refuse si le minimum d'achat n'est pas atteint", async () => {
    expect(
      await validateDiscount(
        mockDb({ ...base, minSubtotalCents: 6000 }),
        "X",
        5000,
      ),
    ).toBeNull();
  });

  it("refuse une chaîne vide", async () => {
    expect(await validateDiscount(mockDb(base), "   ", 5000)).toBeNull();
  });
});
