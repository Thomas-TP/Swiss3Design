import { describe, expect, it } from "vitest";
import {
  computeAvailability,
  covers,
  publicCapacity,
  quoteNeedGrams,
  remainingFromGross,
} from "./availability";

describe("remainingFromGross : pesée rapide", () => {
  it("restant = brut − tare", () => {
    expect(remainingFromGross(463, 212)).toBe(251);
    expect(remainingFromGross(1036, 140)).toBe(896);
  });
  it("jamais négatif (support vide, balance à zéro)", () => {
    expect(remainingFromGross(190, 212)).toBe(0);
  });
});

const refs = [
  { id: "r-white", studioId: "blanc-neve" },
  { id: "r-red", studioId: "rouge-signal" },
  { id: "r-silk", studioId: null },
];
const spool = (
  refId: string,
  remainingGrams: number,
  extra: Partial<{
    status: "ordered" | "in_stock" | "empty" | "retired";
    sealed: boolean;
    initialGrams: number;
  }> = {},
) => ({
  refId,
  remainingGrams,
  status: "in_stock" as const,
  sealed: false,
  initialGrams: 1000,
  ...extra,
});

describe("computeAvailability : disponible = restant − réservé", () => {
  it("additionne les bobines en stock et retranche Studio + devis", () => {
    const map = computeAvailability(
      refs,
      [spool("r-white", 400), spool("r-white", 1000, { sealed: true })],
      { studio: { "blanc-neve": 300 }, quote: { "r-white": 120 }, shop: {} },
    );
    const white = map.get("r-white")!;
    expect(white.remaining).toBe(1400);
    expect(white.reserved).toBe(420);
    expect(white.available).toBe(980);
    expect(white.sealedCount).toBe(1);
  });

  it("une bobine commandée, vide ou retirée n'est pas du stock", () => {
    const map = computeAvailability(
      refs,
      [
        spool("r-red", 1000, { status: "ordered", sealed: true }),
        spool("r-red", 0, { status: "empty" }),
        spool("r-red", 500, { status: "retired" }),
      ],
      { studio: {}, quote: {}, shop: {} },
    );
    const red = map.get("r-red")!;
    expect(red.remaining).toBe(0);
    expect(red.orderedCount).toBe(1);
    expect(red.orderedGrams).toBe(1000);
  });

  it("une référence hors Studio ne subit que les réservations de devis", () => {
    const map = computeAvailability(refs, [spool("r-silk", 250)], {
      studio: { "r-silk": 999 },
      quote: { "r-silk": 100 },
      shop: {},
    });
    expect(map.get("r-silk")!.available).toBe(150);
  });

  it("le disponible peut devenir négatif (sur-réservation visible à l'admin)", () => {
    const map = computeAvailability(refs, [spool("r-white", 100)], {
      studio: { "blanc-neve": 250 },
      quote: {},
      shop: {},
    });
    expect(map.get("r-white")!.available).toBe(-150);
  });

  it("les lignes de la boutique réservent par id de référence, avec le Studio et les devis", () => {
    const map = computeAvailability(
      refs,
      [spool("r-white", 1000), spool("r-silk", 300)],
      {
        studio: { "blanc-neve": 100 },
        quote: { "r-white": 50 },
        shop: { "r-white": 200, "r-silk": 120 },
      },
    );
    expect(map.get("r-white")!.reserved).toBe(350);
    expect(map.get("r-white")!.available).toBe(650);
    expect(map.get("r-silk")!.reserved).toBe(120);
    expect(map.get("r-silk")!.available).toBe(180);
  });
});

describe("covers et publicCapacity : jamais le niveau exact", () => {
  it("garde 20 g de réserve de fin de bobine", () => {
    expect(covers(120, 100)).toBe(true);
    expect(covers(119, 100)).toBe(false);
  });
  it("arrondit à la baisse à 10 g", () => {
    expect(publicCapacity(237)).toBe(210); // 237 − 20 = 217 → 210
    expect(publicCapacity(20)).toBe(0);
    expect(publicCapacity(-50)).toBe(0);
  });
  it("plafonne à 1500 g", () => {
    expect(publicCapacity(9000)).toBe(1500);
  });
});

describe("quoteNeedGrams : ×1,15 + 15 g", () => {
  it("85 g, une pièce : 113 g", () => {
    expect(quoteNeedGrams(85, 1)).toBe(Math.ceil(85 * 1.15 + 15));
    expect(quoteNeedGrams(85, 1)).toBe(113);
  });
  it("multiplie par la quantité avant la marge", () => {
    expect(quoteNeedGrams(10, 5)).toBe(Math.ceil(50 * 1.15 + 15)); // 73
  });
  it("une quantité inférieure à 1 vaut 1", () => {
    expect(quoteNeedGrams(10, 0)).toBe(quoteNeedGrams(10, 1));
  });
});
